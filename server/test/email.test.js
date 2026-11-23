import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  escapeHtml,
  sanitizeSubject,
  buildNewConnectionRequestTemplate,
  buildConnectionAcceptedTemplate,
  buildEventCancelledTemplate,
} from '../src/lib/email-templates.js';
import {
  sendEmail,
  checkEmailRateLimits,
  checkConnectionPairLimit,
} from '../src/lib/email.js';
import { defaultStore } from '../src/lib/rate-limit.js';
import { signSessionToken } from '../src/lib/auth.js';
import {
  createScratchDatabase,
  dropScratchDatabase,
  stopTestServer,
  waitForServer,
} from '../scripts/test-db-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Part 5: Email Notifications (Resend API & Templates)', () => {
  describe('Email Templates & Sanitization Unit Tests', () => {
    it('escapes HTML special characters for dynamic values', () => {
      const malicious = '<script>alert(1)</script>&"\'';
      const escaped = escapeHtml(malicious);
      expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;&amp;&quot;&#39;');
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
    });

    it('strips CR and LF from subjects to prevent header injection and limits to 100 chars', () => {
      const injection = 'New Request\r\nBcc: hacker@example.com\r\nSubject: Injected';
      const clean = sanitizeSubject(injection);
      expect(clean).not.toContain('\r');
      expect(clean).not.toContain('\n');
      expect(clean).toBe('New Request Bcc: hacker@example.com Subject: Injected');

      const veryLong = 'A'.repeat(150);
      const capped = sanitizeSubject(veryLong);
      expect(capped.length).toBe(100);
    });

    it('templates include opt-out links and NEVER include chat message content', () => {
      const reqTpl = buildNewConnectionRequestTemplate({
        recipientName: 'Alice',
        requesterName: 'Bob',
        skillName: 'Guitar',
        matchId: 'm123',
      });
      expect(reqTpl.subject).toContain('Bob');
      expect(reqTpl.text).toContain('/profile/setup');
      expect(reqTpl.html).toContain('/profile/setup');
      // Verify no message text is in the template signature or output
      expect(reqTpl.text).not.toContain('chat message text:');

      const accTpl = buildConnectionAcceptedTemplate({
        requesterName: 'Bob',
        recipientName: 'Alice',
        skillName: 'Guitar',
        matchId: 'm123',
      });
      expect(accTpl.subject).toContain('Alice');
      expect(accTpl.text).toContain('/profile/setup');

      const cancelTpl = buildEventCancelledTemplate({
        attendeeName: 'Alice',
        eventTitle: 'Spanish Workshop',
        hostName: 'Carlos',
      });
      expect(cancelTpl.subject).toBe('Event Cancelled: Spanish Workshop');
      expect(cancelTpl.text).toContain('/profile/setup');
    });
  });

  describe('Abuse Limits & Rate Limiting', () => {
    beforeAll(() => {
      defaultStore.reset();
    });

    afterAll(() => {
      defaultStore.reset();
    });

    it('enforces recipient limits (5/hr, 20/day)', () => {
      const recipient = 'testlimits@example.com';

      // 5 emails pass
      for (let i = 0; i < 5; i++) {
        const check = checkEmailRateLimits(recipient);
        expect(check.ok).toBe(true);
      }

      // 6th email fails hourly limit
      const blocked = checkEmailRateLimits(recipient);
      expect(blocked.ok).toBe(false);
      expect(blocked.reason).toContain('hourly');
    });

    it('enforces connection request pair limit (1 email per pair per 24h)', () => {
      const senderId = 'sender-1';
      const recipientId = 'recipient-1';

      expect(checkConnectionPairLimit(senderId, recipientId)).toBe(true);
      expect(checkConnectionPairLimit(senderId, recipientId)).toBe(false);
    });
  });

  describe('Dormancy and Dry Run Mode', () => {
    it('sendEmail resolves { skipped: true } when dormant / unconfigured', async () => {
      const res = await sendEmail({
        to: 'anyone@example.com',
        subject: 'Test',
        text: 'Hello',
        html: '<p>Hello</p>',
      });
      // In default test environment without RESEND_API_KEY, it is dormant
      expect(res.skipped).toBe(true);
    });
  });

  describe('Scratch Integration Test with Local Mock Resend Server', () => {
    let scratchDb;
    let prisma;
    let mockResendServer;
    let mockResendBase;
    let appServerProcess;
    const testPort = 4188;
    const appBaseUrl = `http://127.0.0.1:${testPort}`;

    const sentEmails = [];
    let mockResendStatus = 200;

    beforeAll(async () => {
      // 1. Mock Resend HTTP API server
      mockResendServer = http.createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        if (mockResendStatus !== 200) {
          res.writeHead(mockResendStatus, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Resend API internal error' }));
          return;
        }

        try {
          const parsed = JSON.parse(body);
          sentEmails.push(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: `email_${Date.now()}` }));
        } catch {
          res.writeHead(400);
          res.end();
        }
      });

      await new Promise((resolve) => mockResendServer.listen(0, resolve));
      mockResendBase = `http://127.0.0.1:${mockResendServer.address().port}`;

      // 2. Scratch DB
      scratchDb = await createScratchDatabase({ loadData: true });
      prisma = new PrismaClient({
        datasources: { db: { url: scratchDb.testMongoUrl } },
      });

      // 3. Start App Server configured with mock Resend API
      const customEnv = {
        PORT: String(testPort),
        MONGODB_URL: scratchDb.testMongoUrl,
        NODE_ENV: 'test',
        PUBLIC_URL: appBaseUrl,
        RESEND_API_KEY: 're_mock_test_key_123',
        EMAIL_FROM: 'notifications@skillswap.app',
        RESEND_API_URL: `${mockResendBase}/emails`,
        EMAIL_DRY_RUN: 'false',
      };

      const serverDir = path.resolve(__dirname, '..');
      const { spawn } = await import('node:child_process');
      appServerProcess = spawn('node', ['src/index.js'], {
        cwd: serverDir,
        env: {
          ...process.env,
          ...customEnv,
        },
        stdio: 'pipe',
      });

      await waitForServer(appBaseUrl, 15000);
    }, 45000);

    afterAll(async () => {
      if (appServerProcess) {
        stopTestServer(appServerProcess);
      }
      if (mockResendServer) {
        await new Promise((resolve) => mockResendServer.close(resolve));
      }
      if (prisma) {
        await prisma.$disconnect();
      }
      if (scratchDb?.testDbName) {
        await dropScratchDatabase(scratchDb.testDbName, scratchDb.testMongoUrl);
      }
    });

    it('sends new connection request email to recipient fire-and-forget', async () => {
      sentEmails.length = 0;

      const userA = await prisma.user.findFirst();
      const userB = await prisma.user.findFirst({
        where: { id: { not: userA.id } },
      });

      const tokenA = signSessionToken(userA.id);

      const res = await fetch(`${appBaseUrl}/api/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `skillswap_session=${tokenA}`,
        },
        body: JSON.stringify({
          targetUserId: userB.id,
          matchedSkillName: 'Pottery',
        }),
      });

      expect([200, 201]).toContain(res.status);

      // Wait a moment for fire-and-forget email delivery
      await new Promise((resolve) => setTimeout(resolve, 600));

      // If this pair was newly created, email was dispatched to userB
      if (res.status === 201) {
        expect(sentEmails.length).toBeGreaterThan(0);
        const lastEmail = sentEmails[sentEmails.length - 1];
        expect(lastEmail.to).toEqual([userB.email]);
        expect(lastEmail.subject).toContain('connection request');
      }
    });

    it('event cancellation notifies attendees with status GOING except host', async () => {
      sentEmails.length = 0;

      const host = await prisma.user.findFirst();
      const attendee1 = await prisma.user.findFirst({
        where: { id: { not: host.id } },
      });

      // Create an event hosted by host
      const event = await prisma.event.create({
        data: {
          hostId: host.id,
          title: 'Email Cancellation Test Workshop',
          description: 'Testing cancellation emails',
          location: 'Library',
          dateTime: new Date(Date.now() + 86400000),
        },
      });

      // Add attendee with GOING status
      await prisma.eventAttendee.create({
        data: {
          eventId: event.id,
          userId: attendee1.id,
          status: 'GOING',
        },
      });

      const tokenHost = signSessionToken(host.id);

      const cancelRes = await fetch(`${appBaseUrl}/api/events/${event.id}/cancel`, {
        method: 'POST',
        headers: {
          Cookie: `skillswap_session=${tokenHost}`,
        },
      });

      expect(cancelRes.status).toBe(200);

      // Wait a moment for fire-and-forget email delivery
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(sentEmails.length).toBeGreaterThan(0);
      const matchEmail = sentEmails.find((e) => e.to.includes(attendee1.email));
      expect(matchEmail).toBeTruthy();
      expect(matchEmail.subject).toContain('Event Cancelled: Email Cancellation Test Workshop');
    });

    it('failing Resend provider (HTTP 500) does not change route response', async () => {
      mockResendStatus = 500;

      const host = await prisma.user.findFirst();
      const attendee = await prisma.user.findFirst({
        where: { id: { not: host.id } },
      });

      const event = await prisma.event.create({
        data: {
          hostId: host.id,
          title: 'Resend Failure Resilience Event',
          description: 'Event testing resilience',
          location: 'Park',
          dateTime: new Date(Date.now() + 86400000),
        },
      });

      await prisma.eventAttendee.create({
        data: {
          eventId: event.id,
          userId: attendee.id,
          status: 'GOING',
        },
      });

      const tokenHost = signSessionToken(host.id);

      // Route MUST succeed with 200 even though email delivery fails behind the scenes
      const cancelRes = await fetch(`${appBaseUrl}/api/events/${event.id}/cancel`, {
        method: 'POST',
        headers: {
          Cookie: `skillswap_session=${tokenHost}`,
        },
      });

      expect(cancelRes.status).toBe(200);
      mockResendStatus = 200;
    });

    it('respects user emailNotifications opt-out', async () => {
      sentEmails.length = 0;

      // Create an opted-out attendee
      const optedOutUser = await prisma.user.create({
        data: {
          name: 'Opted Out User',
          email: `optout-${Date.now()}@example.com`,
          emailNotifications: false,
        },
      });

      const host = await prisma.user.findFirst();

      const event = await prisma.event.create({
        data: {
          hostId: host.id,
          title: 'Opt Out Test Event',
          description: 'Testing opt out',
          location: 'Hall',
          dateTime: new Date(Date.now() + 86400000),
        },
      });

      await prisma.eventAttendee.create({
        data: {
          eventId: event.id,
          userId: optedOutUser.id,
          status: 'GOING',
        },
      });

      const tokenHost = signSessionToken(host.id);

      await fetch(`${appBaseUrl}/api/events/${event.id}/cancel`, {
        method: 'POST',
        headers: {
          Cookie: `skillswap_session=${tokenHost}`,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 600));

      const found = sentEmails.find((e) => e.to.includes(optedOutUser.email));
      expect(found).toBeUndefined();
    });
  });
});
