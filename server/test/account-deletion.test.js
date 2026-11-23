import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { signSessionToken } from '../src/lib/auth.js';
import {
  createScratchDatabase,
  dropScratchDatabase,
  startTestServer,
  stopTestServer,
  waitForServer,
} from '../scripts/test-db-helper.mjs';

describe('Part 3: Account Deletion Scratch Integration Test', () => {
  let scratchDb;
  let prisma;
  let serverProcess;
  const testPort = 4182;
  const baseUrl = `http://127.0.0.1:${testPort}`;

  beforeAll(async () => {
    // 1. Create scratch DB with baseline data
    scratchDb = await createScratchDatabase({ loadData: true });
    prisma = new PrismaClient({
      datasources: { db: { url: scratchDb.testMongoUrl } },
    });

    // 2. Start server against scratch DB
    serverProcess = startTestServer({
      port: testPort,
      mongoUrl: scratchDb.testMongoUrl,
    });
    await waitForServer(baseUrl, 15000);
  }, 40000);

  afterAll(async () => {
    if (serverProcess) {
      stopTestServer(serverProcess);
    }
    if (prisma) {
      await prisma.$disconnect();
    }
    if (scratchDb?.testDbName) {
      await dropScratchDatabase(scratchDb.testDbName, scratchDb.testMongoUrl);
    }
  });

  it('rejects deletion with invalid confirmation text or wrong password', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword1!', 10);
    const user = await prisma.user.create({
      data: {
        name: 'Pass User',
        email: `passuser-${Date.now()}@example.com`,
        passwordHash,
      },
    });

    const token = signSessionToken(user.id);

    // 1. Invalid confirm string
    const resBadConfirm = await fetch(`${baseUrl}/api/user/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `skillswap_session=${token}`,
      },
      body: JSON.stringify({ confirm: 'REMOVE', password: 'CorrectPassword1!' }),
    });
    expect(resBadConfirm.status).toBe(400);

    // 2. Missing password for password-only account
    const resMissingPass = await fetch(`${baseUrl}/api/user/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `skillswap_session=${token}`,
      },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    expect(resMissingPass.status).toBe(400);

    // 3. Wrong password
    const resWrongPass = await fetch(`${baseUrl}/api/user/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `skillswap_session=${token}`,
      },
      body: JSON.stringify({ confirm: 'DELETE', password: 'WrongPassword999!' }),
    });
    expect(resWrongPass.status).toBe(403);
    const errBody = await resWrongPass.json();
    expect(errBody.error).toBe('Invalid password');
  });

  it('deletes rich user account and leaves ZERO orphaned records across all collections', async () => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Secret123!', salt);

    // 1. Create target user and peer user
    const targetUser = await prisma.user.create({
      data: {
        name: 'Rich Target User',
        email: `rich-${Date.now()}@example.com`,
        passwordHash: hash,
        bio: 'Will be deleted soon',
      },
    });

    const peerUser = await prisma.user.create({
      data: {
        name: 'Peer User',
        email: `peer-${Date.now()}@example.com`,
        passwordHash: hash,
        bio: 'Will stay intact',
      },
    });

    const skill = await prisma.skill.findFirst();

    // 2. Skills
    await prisma.userSkillsTeach.create({
      data: {
        userId: targetUser.id,
        skillId: skill.id,
        proficiency: 'Advanced',
      },
    });
    await prisma.userSkillsLearn.create({
      data: {
        userId: targetUser.id,
        skillId: skill.id,
      },
    });

    // 3. OAuthAccount
    await prisma.oAuthAccount.create({
      data: {
        userId: targetUser.id,
        provider: 'google',
        providerAccountId: `google-sub-${Date.now()}`,
      },
    });

    // 4. Match and messages
    const match = await prisma.match.create({
      data: {
        userAId: targetUser.id,
        userBId: peerUser.id,
        matchedSkillId: skill.id,
        status: 'ACCEPTED',
      },
    });
    await prisma.message.create({
      data: {
        matchId: match.id,
        senderId: targetUser.id,
        content: 'Hello from target user',
      },
    });
    await prisma.message.create({
      data: {
        matchId: match.id,
        senderId: peerUser.id,
        content: 'Hello back from peer user',
      },
    });

    // 5. Events & Attendances
    // Event hosted by target, attended by peer
    const targetHostedEvent = await prisma.event.create({
      data: {
        hostId: targetUser.id,
        title: 'Target User Workshop',
        description: 'Going away workshop',
        location: 'Online',
        dateTime: new Date(Date.now() + 86400000),
      },
    });
    await prisma.eventAttendee.create({
      data: {
        eventId: targetHostedEvent.id,
        userId: peerUser.id,
        status: 'GOING',
      },
    });

    // Event hosted by peer, attended by target
    const peerHostedEvent = await prisma.event.create({
      data: {
        hostId: peerUser.id,
        title: 'Peer User Workshop',
        description: 'Staying workshop',
        location: 'Library',
        dateTime: new Date(Date.now() + 172800000),
      },
    });
    await prisma.eventAttendee.create({
      data: {
        eventId: peerHostedEvent.id,
        userId: targetUser.id,
        status: 'GOING',
      },
    });

    // 6. Reviews given and received
    await prisma.review.create({
      data: {
        fromUserId: targetUser.id,
        toUserId: peerUser.id,
        rating: 5,
        comment: 'Great peer!',
      },
    });
    await prisma.review.create({
      data: {
        fromUserId: peerUser.id,
        toUserId: targetUser.id,
        rating: 4,
        comment: 'Good student!',
      },
    });

    // 7. AvatarFile
    const avatarFileName = `${targetUser.id}-0123456789abcdef.webp`;
    await prisma.avatarFile.create({
      data: {
        id: avatarFileName,
        userId: targetUser.id,
        contentType: 'image/webp',
        size: 100,
        data: Buffer.from('fake-avatar-bytes'),
      },
    });

    // 8. Execute DELETE /api/user/account as targetUser
    // Since targetUser has an OAuthAccount, password is not required
    const token = signSessionToken(targetUser.id);
    const deleteRes = await fetch(`${baseUrl}/api/user/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `skillswap_session=${token}`,
      },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });

    expect(deleteRes.status).toBe(200);
    const resBody = await deleteRes.json();
    expect(resBody.message).toBe('Account successfully deleted');

    // Verify session cookie was cleared
    const setCookie = deleteRes.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('skillswap_session=;');

    const uid = targetUser.id;

    // 9. Check EVERY collection in MongoDB: zero documents may reference uid
    const usersWithUid = await prisma.user.count({ where: { id: uid } });
    expect(usersWithUid).toBe(0);

    const teachWithUid = await prisma.userSkillsTeach.count({ where: { userId: uid } });
    expect(teachWithUid).toBe(0);

    const learnWithUid = await prisma.userSkillsLearn.count({ where: { userId: uid } });
    expect(learnWithUid).toBe(0);

    const oauthWithUid = await prisma.oAuthAccount.count({ where: { userId: uid } });
    expect(oauthWithUid).toBe(0);

    const hostedEventsWithUid = await prisma.event.count({ where: { hostId: uid } });
    expect(hostedEventsWithUid).toBe(0);

    const attendeesWithUid = await prisma.eventAttendee.count({ where: { userId: uid } });
    expect(attendeesWithUid).toBe(0);

    const attendeesInTargetEvent = await prisma.eventAttendee.count({
      where: { eventId: targetHostedEvent.id },
    });
    expect(attendeesInTargetEvent).toBe(0);

    const matchesWithUid = await prisma.match.count({
      where: { OR: [{ userAId: uid }, { userBId: uid }] },
    });
    expect(matchesWithUid).toBe(0);

    const messagesWithUid = await prisma.message.count({ where: { senderId: uid } });
    expect(messagesWithUid).toBe(0);

    const messagesInTargetMatch = await prisma.message.count({
      where: { matchId: match.id },
    });
    expect(messagesInTargetMatch).toBe(0);

    const reviewsWithUid = await prisma.review.count({
      where: { OR: [{ fromUserId: uid }, { toUserId: uid }] },
    });
    expect(reviewsWithUid).toBe(0);

    const avatarsWithUid = await prisma.avatarFile.count({ where: { userId: uid } });
    expect(avatarsWithUid).toBe(0);

    // 10. Check other user's data remains intact
    const intactPeer = await prisma.user.findUnique({ where: { id: peerUser.id } });
    expect(intactPeer).not.toBeNull();
    expect(intactPeer.name).toBe('Peer User');

    const intactPeerEvent = await prisma.event.findUnique({ where: { id: peerHostedEvent.id } });
    expect(intactPeerEvent).not.toBeNull();

    // 11. Check a second delete fails cleanly
    const secondDeleteRes = await fetch(`${baseUrl}/api/user/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `skillswap_session=${token}`,
      },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    // The user no longer exists, so it returns 404
    expect(secondDeleteRes.status).toBe(404);
  });
});
