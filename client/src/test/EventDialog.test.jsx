import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventDialog from '@/components/EventDialog';
import * as apiModule from '@/lib/api';

describe('EventDialog component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseEvent = {
    id: 'event-uuid-1',
    title: 'React & Vite Workshop',
    description: 'Learn modern Vite and React concepts together.',
    location: 'Bangalore Tech Hub',
    dateTime: '2026-11-20T14:00:00.000Z',
    lat: 12.9716,
    lng: 77.5946,
    maxAttendees: 15,
    cancelled: false,
  };

  describe('Create Mode', () => {
    it('renders create event form when event prop is null', () => {
      render(
        <EventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={null}
          onSaved={vi.fn()}
        />
      );

      expect(screen.getByText('Host a Skill Swap Event')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /publish meetup event/i })
      ).toBeInTheDocument();
    });

    it('validates required fields on client-side before sending request', async () => {
      render(
        <EventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={null}
          onSaved={vi.fn()}
        />
      );

      const form = screen.getByRole('dialog').querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(/please fix the highlighted fields/i)).toBeInTheDocument();
      });
    });

    it('submits POST /api/events with valid payload including maxAttendees', async () => {
      const onOpenChange = vi.fn();
      const onSaved = vi.fn();

      vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
        message: 'Event created successfully!',
        event: { id: 'new-event-id' },
      });

      render(
        <EventDialog
          open={true}
          onOpenChange={onOpenChange}
          event={null}
          onSaved={onSaved}
        />
      );

      // Fill in fields
      fireEvent.change(
        screen.getByPlaceholderText(/JavaScript & React Coffee Study Session/i),
        { target: { value: 'TypeScript to JS Study' } }
      );
      fireEvent.change(
        screen.getByPlaceholderText(/What will you teach\/practice/i),
        { target: { value: 'Discussion on plain ESM and React 19' } }
      );
      fireEvent.change(
        screen.getByPlaceholderText(/Central Library Cafe/i),
        { target: { value: 'MG Road Community Hall' } }
      );
      fireEvent.change(screen.getByLabelText(/Date & Time/i), {
        target: { value: '2026-11-25T18:30' },
      });
      fireEvent.change(
        screen.getByPlaceholderText(/Unlimited if empty/i),
        { target: { value: '25' } }
      );

      const submitBtn = screen.getByRole('button', { name: /publish meetup event/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(apiModule.apiFetch).toHaveBeenCalledWith(
          '/api/events',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"title":"TypeScript to JS Study"'),
          })
        );
      });

      const body = JSON.parse(apiModule.apiFetch.mock.calls[0][1].body);
      expect(body.title).toBe('TypeScript to JS Study');
      expect(body.maxAttendees).toBe(25);
      expect(body.lat).toBe(12.9716);
      expect(body.lng).toBe(77.5946);

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onSaved).toHaveBeenCalled();
      });
    });

    it('populates location and coordinates when AddressSearch item is selected without overwriting non-empty location', async () => {
      vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
        results: [
          {
            label: 'Cubbon Park Metro Station',
            latitude: 12.981,
            longitude: 77.597,
          },
        ],
      });

      render(
        <EventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={null}
          onSaved={vi.fn()}
        />
      );

      // 1. When location is empty: selection fills location
      const addressInput = screen.getByPlaceholderText(/Cubbon Park, Bengaluru/i);
      fireEvent.change(addressInput, { target: { value: 'Cubbon' } });
      fireEvent.click(screen.getByRole('button', { name: /search address/i }));

      await waitFor(() => {
        expect(screen.getByText('Cubbon Park Metro Station')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cubbon Park Metro Station'));

      const locationInput = screen.getByPlaceholderText(/Central Library Cafe/i);
      expect(locationInput.value).toBe('Cubbon Park Metro Station');

      // 2. Now user customizes the location address
      fireEvent.change(locationInput, { target: { value: 'Gate 2 Entrance, Cubbon' } });

      // Search again with another result
      vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
        results: [
          {
            label: 'Lalbagh Botanical Garden',
            latitude: 12.950,
            longitude: 77.584,
          },
        ],
      });

      fireEvent.change(addressInput, { target: { value: 'Lalbagh' } });
      fireEvent.click(screen.getByRole('button', { name: /search address/i }));

      await waitFor(() => {
        expect(screen.getByText('Lalbagh Botanical Garden')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Lalbagh Botanical Garden'));

      // Location address display must NOT be overwritten since it already has typed text
      expect(locationInput.value).toBe('Gate 2 Entrance, Cubbon');
    });
  });

  describe('Edit Mode (P3.5)', () => {
    it('pre-populates existing event fields and disables Save Changes when unchanged', () => {
      render(
        <EventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={baseEvent}
          onSaved={vi.fn()}
        />
      );

      expect(screen.getByText('Edit Meetup Event')).toBeInTheDocument();
      const titleInput = screen.getByDisplayValue('React & Vite Workshop');
      expect(titleInput).toBeInTheDocument();

      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      expect(saveBtn).toBeDisabled();
    });

    it('enables Save Changes when field is edited and sends differential PATCH', async () => {
      const onOpenChange = vi.fn();
      const onSaved = vi.fn();

      vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
        message: 'Event updated successfully',
        event: { ...baseEvent, title: 'Updated Workshop Title' },
      });

      render(
        <EventDialog
          open={true}
          onOpenChange={onOpenChange}
          event={baseEvent}
          onSaved={onSaved}
        />
      );

      const titleInput = screen.getByDisplayValue('React & Vite Workshop');
      fireEvent.change(titleInput, { target: { value: 'Updated Workshop Title' } });

      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      expect(saveBtn).not.toBeDisabled();
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(apiModule.apiFetch).toHaveBeenCalledWith(
          `/api/events/${baseEvent.id}`,
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ title: 'Updated Workshop Title' }),
          })
        );
      });

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onSaved).toHaveBeenCalled();
      });
    });

    it('displays 409 conflict message when server rejects capacity reduction below current attendee count', async () => {
      vi.spyOn(apiModule, 'apiFetch').mockRejectedValue(
        new apiModule.ApiError(
          'maxAttendees cannot be set below the current attendee count (5)',
          409
        )
      );

      render(
        <EventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={baseEvent}
          onSaved={vi.fn()}
        />
      );

      const maxInput = screen.getByDisplayValue('15');
      fireEvent.change(maxInput, { target: { value: '3' } });

      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/maxAttendees cannot be set below the current attendee count/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Cancellation Flow (P3.5)', () => {
    it('opens cancellation confirmation sub-dialog when Cancel Event button is clicked', () => {
      render(
        <EventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={baseEvent}
          onSaved={vi.fn()}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /cancel event/i });
      fireEvent.click(cancelBtn);

      expect(
        screen.getByText(/cancel this event\? attendees will see it as cancelled/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /yes, cancel event/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /keep event/i })
      ).toBeInTheDocument();
    });

    it('returns to edit form without cancelling when Keep Event is clicked', () => {
      render(
        <EventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={baseEvent}
          onSaved={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel event/i }));
      expect(
        screen.getByText(/cancel this event\? attendees will see it as cancelled/i)
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /keep event/i }));
      expect(
        screen.queryByText(/cancel this event\? attendees will see it as cancelled/i)
      ).not.toBeInTheDocument();
    });

    it('submits POST /api/events/:id/cancel upon confirmation', async () => {
      const onOpenChange = vi.fn();
      const onSaved = vi.fn();

      vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
        message: 'Event cancelled successfully',
      });

      render(
        <EventDialog
          open={true}
          onOpenChange={onOpenChange}
          event={baseEvent}
          onSaved={onSaved}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel event/i }));
      const confirmBtn = screen.getByRole('button', { name: /yes, cancel event/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(apiModule.apiFetch).toHaveBeenCalledWith(
          `/api/events/${baseEvent.id}/cancel`,
          expect.objectContaining({ method: 'POST' })
        );
      });

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onSaved).toHaveBeenCalled();
      });
    });
  });
});
