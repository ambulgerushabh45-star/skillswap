// client/src/lib/events.js
// Pure helper functions for events: date formatting, patch building, and business logic

/**
 * Converts a Date or ISO string to local datetime-local input string (YYYY-MM-DDTHH:mm).
 * Preserves local time components.
 */
export function toLocalInputValue(dateOrIso) {
  if (!dateOrIso) return '';
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a local datetime-local string (YYYY-MM-DDTHH:mm) to an ISO UTC string.
 */
export function fromLocalInputValue(localStr) {
  if (!localStr) return null;
  const d = new Date(localStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Compares original event with form state and returns a differential patch.
 * Returns an empty object if no fields have changed.
 */
export function buildEventPatch(original, form) {
  if (!original || !form) return {};
  const patch = {};

  if (form.title !== undefined && form.title.trim() !== (original.title || '').trim()) {
    patch.title = form.title.trim();
  }

  if (form.description !== undefined && form.description.trim() !== (original.description || '').trim()) {
    patch.description = form.description.trim();
  }

  if (form.location !== undefined && form.location.trim() !== (original.location || '').trim()) {
    patch.location = form.location.trim();
  }

  if (form.dateTime) {
    const formIso = form.dateTime.includes('Z')
      ? new Date(form.dateTime).toISOString()
      : fromLocalInputValue(form.dateTime);
    const origIso = original.dateTime ? new Date(original.dateTime).toISOString() : null;

    if (formIso && origIso !== formIso) {
      patch.dateTime = formIso;
    }
  }

  if (form.lat !== undefined && form.lat !== '') {
    const formLat = Number(form.lat);
    const origLat = original.lat != null ? Number(original.lat) : null;
    if (!isNaN(formLat) && (origLat === null || Math.abs(origLat - formLat) > 0.000001)) {
      patch.lat = formLat;
    }
  }

  if (form.lng !== undefined && form.lng !== '') {
    const formLng = Number(form.lng);
    const origLng = original.lng != null ? Number(original.lng) : null;
    if (!isNaN(formLng) && (origLng === null || Math.abs(origLng - formLng) > 0.000001)) {
      patch.lng = formLng;
    }
  }

  if (form.maxAttendees !== undefined) {
    const formMax = form.maxAttendees === '' || form.maxAttendees === null
      ? null
      : Number(form.maxAttendees);
    const origMax = original.maxAttendees != null ? Number(original.maxAttendees) : null;

    if (formMax !== origMax) {
      patch.maxAttendees = formMax;
    }
  }

  return patch;
}

/**
 * Evaluates RSVP eligibility for a user against an event.
 */
export function canRsvp(event, viewer) {
  if (!event) {
    return { canRsvp: false, reason: 'missing_event' };
  }

  if (event.cancelled) {
    return { canRsvp: false, reason: 'cancelled' };
  }

  // Already RSVP'd: always allowed to toggle off, even if full
  if (event.isGoing) {
    return { canRsvp: true, reason: 'going' };
  }

  // If full and viewer is not already going: cannot join
  if (event.isFull) {
    return { canRsvp: false, reason: 'full' };
  }

  return { canRsvp: true, reason: 'open' };
}

/**
 * Returns status badge metadata for an event.
 */
export function eventStatusLabel(event) {
  if (!event) return null;

  if (event.cancelled) {
    return {
      label: 'Cancelled',
      variant: 'destructive',
      className: 'bg-red-100 text-red-800 border-red-200',
    };
  }

  if (event.isFull) {
    return {
      label: 'Full',
      variant: 'secondary',
      className: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }

  if (event.isHost) {
    return {
      label: 'Your Event',
      variant: 'default',
      className: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    };
  }

  return null;
}

/**
 * Formats event date and time string in user's local timezone.
 * e.g., "Wed, Oct 28 at 07:18 PM"
 */
export function formatEventDateTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  if (isNaN(d.getTime())) return '';

  const datePart = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${datePart} at ${timePart}`;
}

