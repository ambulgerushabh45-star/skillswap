import { describe, it, expect } from 'vitest';
import {
  toLocalInputValue,
  fromLocalInputValue,
  buildEventPatch,
  canRsvp,
  eventStatusLabel,
  formatEventDateTime,
} from '@/lib/events';

describe('events pure helpers', () => {
  describe('toLocalInputValue', () => {
    it('returns empty string for null, undefined, or invalid input', () => {
      expect(toLocalInputValue(null)).toBe('');
      expect(toLocalInputValue(undefined)).toBe('');
      expect(toLocalInputValue('not-a-date')).toBe('');
    });

    it('formats a date to YYYY-MM-DDTHH:mm preserving local time', () => {
      const d = new Date(2026, 9, 28, 19, 18); // Oct 28 2026, 19:18 local
      expect(toLocalInputValue(d)).toBe('2026-10-28T19:18');
    });

    it('handles dates near midnight correctly', () => {
      const nearMidnight = new Date(2026, 11, 31, 23, 59); // Dec 31, 23:59
      expect(toLocalInputValue(nearMidnight)).toBe('2026-12-31T23:59');

      const pastMidnight = new Date(2027, 0, 1, 0, 5); // Jan 1, 00:05
      expect(toLocalInputValue(pastMidnight)).toBe('2027-01-01T00:05');
    });

    it('converts ISO string to local input format', () => {
      const iso = '2026-06-15T12:00:00.000Z';
      const d = new Date(iso);
      const expected = toLocalInputValue(d);
      expect(toLocalInputValue(iso)).toBe(expected);
    });
  });

  describe('fromLocalInputValue', () => {
    it('returns null for empty or invalid input', () => {
      expect(fromLocalInputValue('')).toBeNull();
      expect(fromLocalInputValue(null)).toBeNull();
      expect(fromLocalInputValue('invalid-date')).toBeNull();
    });

    it('converts local input string to valid ISO UTC string', () => {
      const input = '2026-10-28T19:18';
      const iso = fromLocalInputValue(input);
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Round-trip check: converting ISO back to local input should match original input
      const backToLocal = toLocalInputValue(iso);
      expect(backToLocal).toBe(input);
    });
  });

  describe('buildEventPatch', () => {
    const baseEvent = {
      id: 'event-123',
      title: 'Original Title',
      description: 'Original Description',
      location: 'Original Location',
      dateTime: '2026-10-28T14:00:00.000Z',
      lat: 12.9716,
      lng: 77.5946,
      maxAttendees: 20,
    };

    it('returns empty object if no fields have changed', () => {
      const form = {
        title: 'Original Title',
        description: 'Original Description',
        location: 'Original Location',
        dateTime: toLocalInputValue(baseEvent.dateTime),
        lat: '12.9716',
        lng: '77.5946',
        maxAttendees: 20,
      };

      const patch = buildEventPatch(baseEvent, form);
      expect(patch).toEqual({});
    });

    it('detects changes in text fields and trims whitespace', () => {
      const form = {
        title: '  New Title  ',
        description: 'New Description',
        location: 'Original Location',
        dateTime: toLocalInputValue(baseEvent.dateTime),
        lat: '12.9716',
        lng: '77.5946',
        maxAttendees: 20,
      };

      const patch = buildEventPatch(baseEvent, form);
      expect(patch).toEqual({
        title: 'New Title',
        description: 'New Description',
      });
    });

    it('detects changes in coordinates and parses numeric values', () => {
      const form = {
        title: 'Original Title',
        description: 'Original Description',
        location: 'Original Location',
        dateTime: toLocalInputValue(baseEvent.dateTime),
        lat: '13.0001',
        lng: '77.5946',
        maxAttendees: 20,
      };

      const patch = buildEventPatch(baseEvent, form);
      expect(patch).toEqual({ lat: 13.0001 });
    });

    it('detects changes in maxAttendees (setting to null or number)', () => {
      // Clearing limit
      const formClear = {
        title: 'Original Title',
        description: 'Original Description',
        location: 'Original Location',
        dateTime: toLocalInputValue(baseEvent.dateTime),
        lat: '12.9716',
        lng: '77.5946',
        maxAttendees: '',
      };
      expect(buildEventPatch(baseEvent, formClear)).toEqual({ maxAttendees: null });

      // Changing number
      const formUpdate = {
        title: 'Original Title',
        description: 'Original Description',
        location: 'Original Location',
        dateTime: toLocalInputValue(baseEvent.dateTime),
        lat: '12.9716',
        lng: '77.5946',
        maxAttendees: 50,
      };
      expect(buildEventPatch(baseEvent, formUpdate)).toEqual({ maxAttendees: 50 });
    });

    it('returns empty object if inputs are missing', () => {
      expect(buildEventPatch(null, {})).toEqual({});
      expect(buildEventPatch({}, null)).toEqual({});
    });
  });

  describe('canRsvp', () => {
    it('returns canRsvp: false for cancelled events', () => {
      const event = { cancelled: true, isGoing: false, isFull: false };
      expect(canRsvp(event)).toEqual({ canRsvp: false, reason: 'cancelled' });
    });

    it('returns canRsvp: true for user who is already going (even if full)', () => {
      const fullGoingEvent = { cancelled: false, isGoing: true, isFull: true };
      expect(canRsvp(fullGoingEvent)).toEqual({ canRsvp: true, reason: 'going' });

      const normalGoingEvent = { cancelled: false, isGoing: true, isFull: false };
      expect(canRsvp(normalGoingEvent)).toEqual({ canRsvp: true, reason: 'going' });
    });

    it('returns canRsvp: false for full events when user is not going', () => {
      const fullEvent = { cancelled: false, isGoing: false, isFull: true };
      expect(canRsvp(fullEvent)).toEqual({ canRsvp: false, reason: 'full' });
    });

    it('returns canRsvp: true for active open events', () => {
      const openEvent = { cancelled: false, isGoing: false, isFull: false };
      expect(canRsvp(openEvent)).toEqual({ canRsvp: true, reason: 'open' });
    });
  });

  describe('eventStatusLabel', () => {
    it('returns Cancelled badge for cancelled events', () => {
      const label = eventStatusLabel({ cancelled: true, isFull: true, isHost: true });
      expect(label?.label).toBe('Cancelled');
      expect(label?.className).toContain('text-red-800');
    });

    it('returns Full badge for full non-cancelled events', () => {
      const label = eventStatusLabel({ cancelled: false, isFull: true, isHost: false });
      expect(label?.label).toBe('Full');
      expect(label?.className).toContain('text-amber-800');
    });

    it('returns Your Event badge for host events that are not cancelled or full', () => {
      const label = eventStatusLabel({ cancelled: false, isFull: false, isHost: true });
      expect(label?.label).toBe('Your Event');
      expect(label?.className).toContain('text-indigo-800');
    });

    it('returns null for normal attendee events', () => {
      expect(eventStatusLabel({ cancelled: false, isFull: false, isHost: false })).toBeNull();
      expect(eventStatusLabel(null)).toBeNull();
    });
  });

  describe('formatEventDateTime', () => {
    it('formats ISO string to readable string', () => {
      const formatted = formatEventDateTime('2026-10-28T19:18:00.000Z');
      expect(formatted).toContain(' at ');
      expect(typeof formatted).toBe('string');
    });

    it('returns empty string for invalid date', () => {
      expect(formatEventDateTime(null)).toBe('');
      expect(formatEventDateTime('invalid')).toBe('');
    });
  });
});

