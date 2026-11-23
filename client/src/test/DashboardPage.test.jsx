import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '@/pages/DashboardPage';
import * as AuthContextModule from '@/context/AuthContext';
import * as apiModule from '@/lib/api';

const mockMatchesData = {
  currentUser: {
    id: 'u1',
    name: 'Alex Johnson',
    teachCount: 2,
    hasLocation: false,
  },
  matches: [
    {
      id: 'u2',
      name: 'Bob Miller',
      location: 'Bengaluru',
      distanceKm: 3.2,
      bio: 'Loves teaching Python and learning guitar.',
      avatarUrl: null,
      matchedSkillName: 'Python Programming',
      isMutual: true,
      connectionStatus: 'NONE',
      avgRating: 4.8,
      reviewCount: 5,
      skillsTeach: [{ id: 'st1', name: 'Python', proficiency: 'Expert' }],
      skillsLearn: [{ id: 'sl1', name: 'Guitar', proficiency: 'Beginner' }],
    },
    {
      id: 'u3',
      name: 'Charlie Davis',
      location: 'Bengaluru',
      distanceKm: 0.5,
      bio: 'Excited about design.',
      avatarUrl: null,
      matchedSkillName: 'UI Design',
      isMutual: false,
      connectionStatus: 'PENDING',
      avgRating: 0,
      reviewCount: 0,
      skillsTeach: [{ id: 'st2', name: 'Figma', proficiency: 'Intermediate' }],
      skillsLearn: [{ id: 'sl2', name: 'React', proficiency: 'Beginner' }],
    },
  ],
  pagination: {
    total: 2,
    page: 1,
    limit: 100,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
};

describe('DashboardPage component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', name: 'Alex Johnson' },
    });
  });

  it('renders match cards with badges, distance text, and location notice', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue(mockMatchesData);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Header notice for missing location
    await screen.findByText(/set your location to see distances/i);

    // Peer cards
    expect(screen.getByText('Bob Miller')).toBeInTheDocument();
    expect(screen.getByText('Charlie Davis')).toBeInTheDocument();

    // Distance formatting
    expect(screen.getByText(/3.2 km away/i)).toBeInTheDocument();
    expect(screen.getByText(/less than 1 km away/i)).toBeInTheDocument();

    // Review badges: Charlie has 0 reviews -> "New"
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText(/4.8/)).toBeInTheDocument();

    // Mutual badge
    expect(screen.getByText(/mutual swap/i)).toBeInTheDocument();
  });

  it('filters matches via search input', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue(mockMatchesData);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByText('Bob Miller');

    const searchInput = screen.getByPlaceholderText(/search skill, name, city/i);
    fireEvent.change(searchInput, { target: { value: 'Figma' } });

    expect(screen.queryByText('Bob Miller')).not.toBeInTheDocument();
    expect(screen.getByText('Charlie Davis')).toBeInTheDocument();
  });

  it('dispatches connect request when Connect button is clicked', async () => {
    const apiSpy = vi.spyOn(apiModule, 'apiFetch');
    apiSpy.mockResolvedValueOnce(mockMatchesData); // initial load
    apiSpy.mockResolvedValueOnce({ success: true }); // handleConnect POST
    apiSpy.mockResolvedValueOnce(mockMatchesData); // reload

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByText('Bob Miller');

    const connectBtn = screen.getByRole('button', { name: /connect swap/i });
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith('/api/matches', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  it('renders Wants to swap badge and Accept/Decline buttons for RECEIVED pending requests', async () => {
    const receivedMatchesData = {
      ...mockMatchesData,
      matches: [
        {
          ...mockMatchesData.matches[1],
          connectionStatus: 'PENDING',
          requestDirection: 'RECEIVED',
          matchId: 'match-charlie',
        },
      ],
    };

    const apiSpy = vi.spyOn(apiModule, 'apiFetch');
    apiSpy.mockResolvedValueOnce(receivedMatchesData); // initial load
    apiSpy.mockResolvedValueOnce({ match: { id: 'match-charlie', status: 'ACCEPTED' } }); // accept PATCH
    apiSpy.mockResolvedValueOnce({
      ...receivedMatchesData,
      matches: [
        {
          ...receivedMatchesData.matches[0],
          connectionStatus: 'ACCEPTED',
          requestDirection: null,
        },
      ],
    }); // reload

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByText('Charlie Davis');
    expect(screen.getByText(/wants to swap with you/i)).toBeInTheDocument();

    const acceptBtn = screen.getByRole('button', { name: /accept/i });
    const declineBtn = screen.getByRole('button', { name: /decline/i });
    expect(acceptBtn).toBeInTheDocument();
    expect(declineBtn).toBeInTheDocument();

    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith('/api/matches/match-charlie', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }));
    });
  });

  it('dispatches DECLINED when Decline button is clicked on received request', async () => {
    const receivedMatchesData = {
      ...mockMatchesData,
      matches: [
        {
          ...mockMatchesData.matches[1],
          connectionStatus: 'PENDING',
          requestDirection: 'RECEIVED',
          matchId: 'match-charlie-2',
        },
      ],
    };

    const apiSpy = vi.spyOn(apiModule, 'apiFetch');
    apiSpy.mockResolvedValueOnce(receivedMatchesData);
    apiSpy.mockResolvedValueOnce({ match: { id: 'match-charlie-2', status: 'DECLINED' } });
    apiSpy.mockResolvedValueOnce(receivedMatchesData);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByText('Charlie Davis');
    const declineBtn = screen.getByRole('button', { name: /decline/i });
    fireEvent.click(declineBtn);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith('/api/matches/match-charlie-2', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'DECLINED' }),
      }));
    });
  });
});

