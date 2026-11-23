import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventsPage from '@/pages/EventsPage';
import * as AuthContextModule from '@/context/AuthContext';
import * as apiModule from '@/lib/api';

// Mock Leaflet for MapView sub-component
vi.mock('leaflet', () => ({
  default: {
    map: () => ({
      setView: vi.fn().mockReturnThis(),
      fitBounds: vi.fn().mockReturnThis(),
      invalidateSize: vi.fn(),
      remove: vi.fn(),
    }),
    layerGroup: () => ({
      addTo: vi.fn().mockReturnThis(),
      clearLayers: vi.fn(),
    }),
    marker: () => ({
      bindPopup: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
    }),
    tileLayer: () => ({ addTo: vi.fn().mockReturnThis() }),
    latLngBounds: () => ({}),
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: vi.fn(),
      },
    },
  },
}));

const mockEventsList = [
  {
    id: 'ev-1',
    hostId: 'user-priya',
    hostName: 'Priya Patel',
    hostAvatar: '',
    title: 'Python & Data Science Meetup',
    description: 'Weekly hands-on coding session.',
    location: 'Indiranagar Library',
    lat: 12.9784,
    lng: 77.6408,
    dateTime: '2026-11-15T18:30:00.000Z',
    goingCount: 3,
    attendeeCount: 3,
    maxAttendees: 10,
    cancelled: false,
    isFull: false,
    isGoing: false,
    isHost: false,
    distanceKm: 2.4,
  },
  {
    id: 'ev-2',
    hostId: 'user-alex',
    hostName: 'Alex Kumar',
    hostAvatar: '',
    title: 'React 19 & Vite Exploration',
    description: 'Migrating legacy Next.js codebase to Vite.',
    location: 'Koramangala Coffee',
    lat: 12.9352,
    lng: 77.6245,
    dateTime: '2026-11-18T17:00:00.000Z',
    goingCount: 5,
    attendeeCount: 5,
    maxAttendees: 5,
    cancelled: false,
    isFull: true,
    isGoing: true,
    isHost: true,
    distanceKm: 0.8,
  },
  {
    id: 'ev-3',
    hostId: 'user-rimi',
    hostName: 'Rimi Sen',
    hostAvatar: '',
    title: 'UI Design Critique',
    description: 'Figma prototyping workshop.',
    location: 'Cubbon Park Pavilion',
    lat: 12.9763,
    lng: 77.5929,
    dateTime: '2026-11-20T10:00:00.000Z',
    goingCount: 8,
    attendeeCount: 8,
    maxAttendees: 8,
    cancelled: false,
    isFull: true,
    isGoing: false,
    isHost: false,
    distanceKm: 4.1,
  },
  {
    id: 'ev-4',
    hostId: 'user-priya',
    hostName: 'Priya Patel',
    hostAvatar: '',
    title: 'Cancelled Rust Jam',
    description: 'Cancelled due to venue maintenance.',
    location: 'Church St Cafe',
    lat: 12.9745,
    lng: 77.6075,
    dateTime: '2026-11-22T15:00:00.000Z',
    goingCount: 2,
    attendeeCount: 2,
    maxAttendees: 10,
    cancelled: true,
    isFull: false,
    isGoing: true,
    isHost: false,
    distanceKm: 1.5,
  },
];

describe('EventsPage component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user-alex', name: 'Alex Kumar', email: 'alex@example.com' },
      status: 'authenticated',
    });
  });

  it('renders loading state initially and then displays event cards', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      events: mockEventsList,
      pagination: { total: 4, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading events/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Python & Data Science Meetup')).toBeInTheDocument();
      expect(screen.getByText('React 19 & Vite Exploration')).toBeInTheDocument();
    });
  });

  it('renders capacity indicator "3 / 10 going" and distance text', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      events: mockEventsList,
      pagination: { total: 4, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('3 / 10 going')).toBeInTheDocument();
      expect(screen.getByText('· 2.4 km away')).toBeInTheDocument();
    });
  });

  it('displays "Full" badge and disabled "Event full" button when isFull and viewer not going', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      events: mockEventsList,
      pagination: { total: 4, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('UI Design Critique')).toBeInTheDocument();
    });

    // ev-3 is full and user is not going
    const fullButton = screen.getByRole('button', { name: /event full/i });
    expect(fullButton).toBeDisabled();
  });

  it('displays "Cancelled" badge, greys out card, and disables RSVP for cancelled events', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      events: mockEventsList,
      pagination: { total: 4, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cancelled Rust Jam')).toBeInTheDocument();
    });

    expect(screen.getByText(/this event has been cancelled\./i)).toBeInTheDocument();
    const cancelledCard = screen.getByTestId('event-card-ev-4');
    expect(cancelledCard.className).toContain('opacity-70');
  });

  it('displays "Your Event" badge and Edit button for host on active event', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      events: mockEventsList,
      pagination: { total: 4, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Your Event')).toBeInTheDocument();
    });

    // Host sees Edit button
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('allows user who is already going to toggle RSVP OFF even when event is full', async () => {
    // ev-2 is full, but user is going! But ev-2 is host. Let's make an event where user is going, not host, and full
    const fullGoingEvent = {
      id: 'ev-full-going',
      hostId: 'user-other',
      hostName: 'Other Host',
      hostAvatar: '',
      title: 'Full Event Attended',
      description: 'Attended session.',
      location: 'MG Road',
      lat: 12.9716,
      lng: 77.5946,
      dateTime: '2026-11-20T14:00:00.000Z',
      goingCount: 5,
      attendeeCount: 5,
      maxAttendees: 5,
      cancelled: false,
      isFull: true,
      isGoing: true,
      isHost: false,
      distanceKm: 1.0,
    };

    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      events: [fullGoingEvent],
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Full Event Attended')).toBeInTheDocument();
    });

    const rsvpButton = screen.getByRole('button', { name: /rsvp confirmed/i });
    expect(rsvpButton).not.toBeDisabled();

    // Clicking toggles RSVP OFF
    fireEvent.click(rsvpButton);

    await waitFor(() => {
      expect(apiModule.apiFetch).toHaveBeenCalledWith(
        `/api/events/${fullGoingEvent.id}/rsvp`,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('displays 409 error message from server and reloads list when RSVP conflict occurs', async () => {
    vi.spyOn(apiModule, 'apiFetch')
      .mockResolvedValueOnce({
        events: [mockEventsList[0]], // open event
        pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      })
      .mockRejectedValueOnce(
        new apiModule.ApiError('This event is full.', 409)
      )
      .mockResolvedValueOnce({
        events: [{ ...mockEventsList[0], isFull: true, goingCount: 10 }],
        pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Python & Data Science Meetup')).toBeInTheDocument();
    });

    const rsvpBtn = screen.getByRole('button', { name: /rsvp going/i });
    fireEvent.click(rsvpBtn);

    await waitFor(() => {
      expect(screen.getByText('This event is full.')).toBeInTheDocument();
    });
  });

  it('switches between Cards grid and Map view', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      events: mockEventsList,
      pagination: { total: 4, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Python & Data Science Meetup')).toBeInTheDocument();
    });

    // Switch to Map View
    const mapBtn = screen.getByRole('button', { name: /map view/i });
    fireEvent.click(mapBtn);

    expect(screen.getByTestId('leaflet-map-container')).toBeInTheDocument();

    // Switch back to Cards
    const cardsBtn = screen.getByRole('button', { name: /cards/i });
    fireEvent.click(cardsBtn);

    expect(screen.queryByTestId('leaflet-map-container')).not.toBeInTheDocument();
  });

  it('renders "Load more" button when hasNextPage is true and loads next page', async () => {
    vi.spyOn(apiModule, 'apiFetch')
      .mockResolvedValueOnce({
        events: [mockEventsList[0]],
        pagination: { total: 4, page: 1, limit: 1, totalPages: 4, hasNextPage: true, hasPrevPage: false },
      })
      .mockResolvedValueOnce({
        events: [mockEventsList[1]],
        pagination: { total: 4, page: 2, limit: 1, totalPages: 4, hasNextPage: false, hasPrevPage: true },
      });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Python & Data Science Meetup')).toBeInTheDocument();
    });

    const loadMoreBtn = screen.getByRole('button', { name: /load more/i });
    expect(loadMoreBtn).toBeInTheDocument();

    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(apiModule.apiFetch).toHaveBeenCalledWith('/api/events?page=2');
      expect(screen.getByText('React 19 & Vite Exploration')).toBeInTheDocument();
    });
  });

  it('renders empty state when filteredEvents has 0 items', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      events: [],
      pagination: { total: 0, page: 1, limit: 100, totalPages: 0, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Meetups Listed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /host an event/i })).toBeInTheDocument();
    });
  });
});

