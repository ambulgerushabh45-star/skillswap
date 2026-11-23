// client/src/components/EventDialog.jsx
// Modal dialog for hosting a new meetup event or editing/cancelling an existing event (P3.5)

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  MapPin,
  Sparkles,
  AlertCircle,
  ChevronDown,
  Users,
  Edit2,
  Trash2,
} from 'lucide-react';
import AddressSearch from '@/components/AddressSearch';
import { apiFetch, ApiError } from '@/lib/api';
import {
  toLocalInputValue,
  fromLocalInputValue,
  buildEventPatch,
} from '@/lib/events';

function EventFormContent({ event, onClose, onSaved }) {
  const isEdit = Boolean(event);

  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [location, setLocation] = useState(event?.location || '');
  const [dateTime, setDateTime] = useState(
    event?.dateTime ? toLocalInputValue(event.dateTime) : ''
  );
  const [lat, setLat] = useState(
    event?.lat != null ? String(event.lat) : '12.9716'
  );
  const [lng, setLng] = useState(
    event?.lng != null ? String(event.lng) : '77.5946'
  );
  const [maxAttendees, setMaxAttendees] = useState(
    event?.maxAttendees != null ? String(event.maxAttendees) : ''
  );
  const [selectedLocationLabel, setSelectedLocationLabel] = useState(
    event?.location || null
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Cancellation state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleSelectResult = (result) => {
    setLat(result.latitude.toFixed(6));
    setLng(result.longitude.toFixed(6));
    setSelectedLocationLabel(result.label);

    // If location input is empty, copy label; do NOT overwrite already typed text
    if (!location.trim()) {
      setLocation(result.label);
    }
  };

  // Compute pending patch for edit mode
  const currentPatch = useMemo(() => {
    if (!isEdit || !event) return {};
    return buildEventPatch(event, {
      title,
      description,
      location,
      dateTime,
      lat,
      lng,
      maxAttendees,
    });
  }, [isEdit, event, title, description, location, dateTime, lat, lng, maxAttendees]);

  const hasChanges = isEdit ? Object.keys(currentPatch).length > 0 : true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setFieldErrors({});

    // Client-side validation
    const errors = {};
    if (!title.trim()) errors.title = 'Title is required';
    if (!description.trim()) errors.description = 'Description is required';
    if (!location.trim()) errors.location = 'Location is required';
    if (!dateTime.trim()) errors.dateTime = 'Date and time is required';

    if (maxAttendees.trim() !== '') {
      const num = Number(maxAttendees);
      if (isNaN(num) || !Number.isInteger(num) || num < 1 || num > 1000) {
        errors.maxAttendees = 'Attendee limit must be an integer between 1 and 1000';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please fix the highlighted fields.');
      return;
    }

    setSubmitting(true);

    try {
      if (isEdit) {
        // Edit mode (PATCH /api/events/:id)
        if (!hasChanges) {
          setError('No changes detected.');
          setSubmitting(false);
          return;
        }

        await apiFetch(`/api/events/${event.id}`, {
          method: 'PATCH',
          body: JSON.stringify(currentPatch),
        });
      } else {
        // Create mode (POST /api/events)
        const isoDateTime = fromLocalInputValue(dateTime);
        const payload = {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          dateTime: isoDateTime,
          lat: lat !== '' ? Number(lat) : undefined,
          lng: lng !== '' ? Number(lng) : undefined,
        };

        if (maxAttendees.trim() !== '') {
          payload.maxAttendees = Number(maxAttendees);
        }

        await apiFetch('/api/events', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      onClose();
      if (onSaved) onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && Array.isArray(err.details)) {
          const detailMap = {};
          err.details.forEach((d) => {
            const field = d.path?.[0] || 'general';
            detailMap[field] = d.message;
          });
          setFieldErrors(detailMap);
        }
        setError(err.message || 'Failed to save event');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEvent = async () => {
    if (!event || cancelling) return;
    setCancelling(true);
    setError(null);

    try {
      await apiFetch(`/api/events/${event.id}/cancel`, {
        method: 'POST',
      });
      setShowCancelConfirm(false);
      onClose();
      if (onSaved) onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to cancel event');
      } else {
        setError('An unexpected error occurred while cancelling.');
      }
      setShowCancelConfirm(false);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-indigo-600">
          {isEdit ? (
            <>
              <Edit2 className="h-5 w-5" />
              Edit Meetup Event
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Host a Skill Swap Event
            </>
          )}
        </DialogTitle>
        <DialogDescription className="text-xs">
          {isEdit
            ? 'Update event details, location, or attendee limits.'
            : 'Create a local meetup or study group for peers to practice skills together.'}
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div
          data-testid="event-dialog-error"
          className="p-3 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Cancellation confirmation sub-dialog overlay */}
      {showCancelConfirm ? (
        <div className="py-4 space-y-4">
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 space-y-2">
            <h4 className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
              <Trash2 className="h-4 w-4 text-red-600" />
              Cancel Event Confirmation
            </h4>
            <p className="text-xs text-red-700 leading-relaxed">
              Cancel this event? Attendees will see it as cancelled. This cannot be undone.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCancelConfirm(false)}
              disabled={cancelling}
            >
              Keep Event
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleCancelEvent}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Yes, cancel event'}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label htmlFor="event-title" className="text-xs font-medium text-slate-700 block mb-1">
              Event Title *
            </label>
            <Input
              id="event-title"
              placeholder="e.g. JavaScript & React Coffee Study Session"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            {fieldErrors.title && (
              <p className="text-[11px] text-red-600 mt-1">{fieldErrors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="event-description" className="text-xs font-medium text-slate-700 block mb-1">
              Description & Goals *
            </label>
            <Textarea
              id="event-description"
              placeholder="What will you teach/practice during this meetup? What should attendees bring?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-20"
              required
            />
            {fieldErrors.description && (
              <p className="text-[11px] text-red-600 mt-1">{fieldErrors.description}</p>
            )}
          </div>

          {/* Address Search (Nominatim Geocoding) */}
          <AddressSearch
            onSelect={handleSelectResult}
            selectedLabel={selectedLocationLabel}
            selectedCoordinates={{ lat, lng }}
            showCoordinates={true}
            placeholder="e.g. Cubbon Park, Bengaluru"
            label="Search Address or Landmark"
          />

          <div>
            <label htmlFor="event-location" className="text-xs font-medium text-slate-700 flex items-center gap-1 mb-1">
              <MapPin className="h-3.5 w-3.5 text-indigo-600" />
              Location Address Display *
            </label>
            <Input
              id="event-location"
              placeholder="e.g. Central Library Cafe, Main St"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
            {fieldErrors.location && (
              <p className="text-[11px] text-red-600 mt-1">{fieldErrors.location}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="event-datetime" className="text-xs font-medium text-slate-700 flex items-center gap-1 mb-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                Date & Time *
              </label>
              <Input
                id="event-datetime"
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                required
              />
              {fieldErrors.dateTime && (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.dateTime}</p>
              )}
            </div>

            <div>
              <label htmlFor="event-max-attendees" className="text-xs font-medium text-slate-700 flex items-center gap-1 mb-1">
                <Users className="h-3.5 w-3.5 text-indigo-600" />
                Maximum Attendees (Optional)
              </label>
              <Input
                id="event-max-attendees"
                type="number"
                min="1"
                max="1000"
                step="1"
                placeholder="Unlimited if empty"
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(e.target.value)}
              />
              {fieldErrors.maxAttendees && (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.maxAttendees}</p>
              )}
            </div>
          </div>

          {/* Collapsible Manual Coordinates Section (Advanced Fallback) */}
          <details className="border-t border-slate-100 pt-2 text-xs group">
            <summary className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-700 select-none flex items-center justify-between py-1">
              <span>Enter coordinates manually (Advanced fallback)</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">
                  Map Lat
                </label>
                <Input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">
                  Map Lng
                </label>
                <Input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </details>

          <DialogFooter className="pt-4 border-t border-slate-100 flex-col sm:flex-row gap-2 sm:justify-between items-center">
            <div>
              {isEdit && !event?.cancelled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Cancel Event
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={submitting || (isEdit && !hasChanges)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {submitting
                  ? isEdit
                    ? 'Saving...'
                    : 'Publishing...'
                  : isEdit
                  ? 'Save Changes'
                  : 'Publish Meetup Event'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      )}
    </>
  );
}

export default function EventDialog({ open, onOpenChange, event = null, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {open && (
          <EventFormContent
            key={event?.id || 'new-event'}
            event={event}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
