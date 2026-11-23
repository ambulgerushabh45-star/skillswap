import { describe, it, expect } from "vitest";
import {
  canEditEvent,
  canCancelEvent,
  validateCapacityChange,
  computeIsFull,
  shouldShowCancelled,
} from "../src/lib/event-rules.js";

describe("Event Rules (P3.5) Pure Logic Tests", () => {
  const mockActiveEvent = {
    id: "event-1",
    hostId: "user-host",
    title: "React Workshop",
    cancelledAt: null,
  };

  const mockCancelledEvent = {
    id: "event-2",
    hostId: "user-host",
    title: "Cancelled Workshop",
    cancelledAt: new Date(),
  };

  describe("canEditEvent", () => {
    it("allows the host to edit an active event", () => {
      const res = canEditEvent(mockActiveEvent, "user-host");
      expect(res).toEqual({ allowed: true });
    });

    it("blocks a non-host with 403 Forbidden", () => {
      const res = canEditEvent(mockActiveEvent, "user-stranger");
      expect(res).toEqual({
        allowed: false,
        status: 403,
        error: "Forbidden: Only the event host can edit this event",
      });
    });

    it("returns 404 when the event is null or undefined", () => {
      expect(canEditEvent(null, "user-host")).toEqual({
        allowed: false,
        status: 404,
        error: "Event not found",
      });
    });

    it("blocks editing a cancelled event with 409 Conflict", () => {
      const res = canEditEvent(mockCancelledEvent, "user-host");
      expect(res).toEqual({
        allowed: false,
        status: 409,
        error: "Cannot edit a cancelled event",
      });
    });
  });

  describe("canCancelEvent", () => {
    it("allows the host to cancel an active event", () => {
      const res = canCancelEvent(mockActiveEvent, "user-host");
      expect(res).toEqual({ allowed: true });
    });

    it("blocks a non-host with 403 Forbidden", () => {
      const res = canCancelEvent(mockActiveEvent, "user-stranger");
      expect(res).toEqual({
        allowed: false,
        status: 403,
        error: "Forbidden: Only the event host can cancel this event",
      });
    });

    it("returns 404 when event is missing", () => {
      expect(canCancelEvent(null, "user-host")).toEqual({
        allowed: false,
        status: 404,
        error: "Event not found",
      });
    });

    it("blocks cancelling an already-cancelled event with 409 Conflict", () => {
      const res = canCancelEvent(mockCancelledEvent, "user-host");
      expect(res).toEqual({
        allowed: false,
        status: 409,
        error: "Event is already cancelled",
      });
    });
  });

  describe("validateCapacityChange", () => {
    it("allows setting null or undefined (removing attendee limit)", () => {
      expect(validateCapacityChange(5, null)).toEqual({ valid: true });
      expect(validateCapacityChange(5, undefined)).toEqual({ valid: true });
    });

    it("allows setting capacity greater than current going count", () => {
      expect(validateCapacityChange(5, 10)).toEqual({ valid: true });
    });

    it("allows setting capacity exactly equal to current going count", () => {
      expect(validateCapacityChange(5, 5)).toEqual({ valid: true });
    });

    it("rejects setting capacity below current going count", () => {
      const res = validateCapacityChange(5, 4);
      expect(res.valid).toBe(false);
      expect(res.error).toBe("maxAttendees cannot be set below the current attendee count (5)");
    });
  });

  describe("computeIsFull", () => {
    it("returns false when maxAttendees is null or undefined", () => {
      expect(computeIsFull(100, null)).toBe(false);
      expect(computeIsFull(100, undefined)).toBe(false);
    });

    it("returns false when going count is less than capacity", () => {
      expect(computeIsFull(4, 5)).toBe(false);
      expect(computeIsFull(0, 1)).toBe(false);
    });

    it("returns true when going count equals capacity", () => {
      expect(computeIsFull(5, 5)).toBe(true);
    });

    it("returns true when going count exceeds capacity", () => {
      expect(computeIsFull(6, 5)).toBe(true);
    });
  });

  describe("shouldShowCancelled", () => {
    it("shows active events to everyone, including anonymous viewers", () => {
      expect(shouldShowCancelled(mockActiveEvent, null, false)).toBe(true);
      expect(shouldShowCancelled(mockActiveEvent, "user-stranger", false)).toBe(true);
    });

    it("hides cancelled events from anonymous viewers", () => {
      expect(shouldShowCancelled(mockCancelledEvent, null, false)).toBe(false);
    });

    it("hides cancelled events from strangers who did not RSVP", () => {
      expect(shouldShowCancelled(mockCancelledEvent, "user-stranger", false)).toBe(false);
    });

    it("shows cancelled events to the host", () => {
      expect(shouldShowCancelled(mockCancelledEvent, "user-host", false)).toBe(true);
    });

    it("shows cancelled events to users who have an RSVP record", () => {
      expect(shouldShowCancelled(mockCancelledEvent, "user-attendee", true)).toBe(true);
    });
  });
});

