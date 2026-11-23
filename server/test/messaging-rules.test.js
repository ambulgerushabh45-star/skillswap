import { describe, it, expect } from 'vitest';
import { evaluateMessagingEligibility } from '../src/lib/api-auth.js';

describe('Messaging Eligibility Rules (evaluateMessagingEligibility)', () => {
  const matchPending = {
    id: 'match-1',
    userAId: 'user-a',
    userBId: 'user-b',
    status: 'PENDING',
  };

  const matchAccepted = {
    id: 'match-2',
    userAId: 'user-a',
    userBId: 'user-b',
    status: 'ACCEPTED',
  };

  const matchDeclined = {
    id: 'match-3',
    userAId: 'user-a',
    userBId: 'user-b',
    status: 'DECLINED',
  };

  it('rejects messaging on missing match with 404', () => {
    const res = evaluateMessagingEligibility({ match: null, senderId: 'user-a' });
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(404);
  });

  it('rejects messaging on DECLINED match with 409', () => {
    const res = evaluateMessagingEligibility({
      match: matchDeclined,
      senderId: 'user-a',
      messageCount: 0,
    });
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(409);
    expect(res.error).toBe('This connection request was declined.');
  });

  it('rejects recipient sending on PENDING match with 409', () => {
    const res = evaluateMessagingEligibility({
      match: matchPending,
      senderId: 'user-b', // recipient
      messageCount: 0,
    });
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(409);
    expect(res.error).toBe('Accept the request to reply.');
  });

  it('allows requester sending on PENDING match when messageCount < 3', () => {
    for (const count of [0, 1, 2]) {
      const res = evaluateMessagingEligibility({
        match: matchPending,
        senderId: 'user-a', // requester
        messageCount: count,
      });
      expect(res.allowed).toBe(true);
    }
  });

  it('rejects requester sending on PENDING match when messageCount >= 3 with 409', () => {
    for (const count of [3, 4, 10]) {
      const res = evaluateMessagingEligibility({
        match: matchPending,
        senderId: 'user-a',
        messageCount: count,
      });
      expect(res.allowed).toBe(false);
      expect(res.status).toBe(409);
      expect(res.error).toBe('You can send up to 3 messages until the request is accepted.');
    }
  });

  it('allows both requester and recipient to send unlimited messages on ACCEPTED match', () => {
    const resA = evaluateMessagingEligibility({
      match: matchAccepted,
      senderId: 'user-a',
      messageCount: 15,
    });
    expect(resA.allowed).toBe(true);

    const resB = evaluateMessagingEligibility({
      match: matchAccepted,
      senderId: 'user-b',
      messageCount: 15,
    });
    expect(resB.allowed).toBe(true);
  });
});

