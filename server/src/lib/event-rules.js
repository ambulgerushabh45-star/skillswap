/**
 * Pure business rules for Event management (P3.5)
 * Zero database, zero network, zero side effects
 */

/**
 * Checks whether a user is authorized to edit an event.
 */
export function canEditEvent(event, userId) {
  if (!event) {
    return { allowed: false, status: 404, error: "Event not found" };
  }
  if (event.hostId !== userId) {
    return {
      allowed: false,
      status: 403,
      error: "Forbidden: Only the event host can edit this event",
    };
  }
  if (event.cancelledAt) {
    return {
      allowed: false,
      status: 409,
      error: "Cannot edit a cancelled event",
    };
  }
  return { allowed: true };
}

/**
 * Checks whether a user is authorized to cancel an event.
 */
export function canCancelEvent(event, userId) {
  if (!event) {
    return { allowed: false, status: 404, error: "Event not found" };
  }
  if (event.hostId !== userId) {
    return {
      allowed: false,
      status: 403,
      error: "Forbidden: Only the event host can cancel this event",
    };
  }
  if (event.cancelledAt) {
    return {
      allowed: false,
      status: 409,
      error: "Event is already cancelled",
    };
  }
  return { allowed: true };
}

/**
 * Validates whether a new maxAttendees capacity limit can be set against the current going attendees.
 */
export function validateCapacityChange(currentGoingCount, newMaxAttendees) {
  if (newMaxAttendees === null || newMaxAttendees === undefined) {
    return { valid: true };
  }
  if (newMaxAttendees < currentGoingCount) {
    return {
      valid: false,
      error: `maxAttendees cannot be set below the current attendee count (${currentGoingCount})`,
    };
  }
  return { valid: true };
}

/**
 * Computes whether an event has reached capacity.
 */
export function computeIsFull(goingCount, maxAttendees) {
  if (maxAttendees === null || maxAttendees === undefined) {
    return false;
  }
  return goingCount >= maxAttendees;
}

/**
 * Determines whether a cancelled event should be visible to the viewer.
 * Active events are always visible.
 * Cancelled events are visible only to the event host or users who have an RSVP record.
 */
export function shouldShowCancelled(event, userId, hasRsvpRecord = false) {
  if (!event.cancelledAt) {
    return true;
  }
  if (!userId) {
    return false;
  }
  return event.hostId === userId || Boolean(hasRsvpRecord);
}

