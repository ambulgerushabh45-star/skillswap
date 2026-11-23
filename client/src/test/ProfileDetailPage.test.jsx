import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProfileDetailPage from '@/pages/ProfileDetailPage';
import * as apiModule from '@/lib/api';

const mockProfileData = {
  user: {
    id: 'u2',
    name: 'Bob Miller',
    bio: 'Software engineer and music enthusiast.',
    location: 'Bengaluru',
    avatarUrl: null,
    skillsTeach: [{ name: 'Python', proficiencyLevel: 'Expert' }],
    skillsLearn: [{ name: 'Guitar', proficiencyLevel: 'Beginner' }],
  },
  rating: {
    average: 4.8,
    count: 1,
  },
  reviews: [
    {
      id: 'r1',
      rating: 5,
      comment: 'Great Python teacher!',
      createdAt: '2026-10-15T10:00:00.000Z',
      fromUser: { name: 'Alice', avatarUrl: null },
    },
  ],
  viewer: {
    isSelf: false,
    matchStatus: 'NONE',
    matchId: null,
    hasReviewed: false,
  },
};

describe('ProfileDetailPage component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders public profile details and Connect button when matchStatus is NONE', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue(mockProfileData);

    render(
      <MemoryRouter initialEntries={['/profile/u2']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Bob Miller');
    expect(screen.getByText(/software engineer and music enthusiast/i)).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Guitar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument();
    expect(screen.getByText(/Great Python teacher!/)).toBeInTheDocument();
  });

  it('renders Edit Profile button when viewer isSelf is true', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      ...mockProfileData,
      viewer: { ...mockProfileData.viewer, isSelf: true },
    });

    render(
      <MemoryRouter initialEntries={['/profile/u2']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Bob Miller');
    expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
  });

  it('renders Request Pending disabled button when matchStatus is PENDING', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      ...mockProfileData,
      viewer: { ...mockProfileData.viewer, matchStatus: 'PENDING' },
    });

    render(
      <MemoryRouter initialEntries={['/profile/u2']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Bob Miller');
    const pendingBtn = screen.getByRole('button', { name: /request pending/i });
    expect(pendingBtn).toBeDisabled();
  });

  it('renders Accept and Decline buttons when viewer received a PENDING request', async () => {
    const apiSpy = vi.spyOn(apiModule, 'apiFetch');
    apiSpy.mockResolvedValueOnce({
      ...mockProfileData,
      viewer: {
        ...mockProfileData.viewer,
        matchStatus: 'PENDING',
        requestDirection: 'RECEIVED',
        matchId: 'match-p1',
      },
    });
    apiSpy.mockResolvedValueOnce({ match: { id: 'match-p1', status: 'ACCEPTED' } });
    apiSpy.mockResolvedValueOnce({
      ...mockProfileData,
      viewer: {
        ...mockProfileData.viewer,
        matchStatus: 'ACCEPTED',
        requestDirection: null,
        matchId: 'match-p1',
      },
    });

    render(
      <MemoryRouter initialEntries={['/profile/u2']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Bob Miller');
    const acceptBtn = screen.getByRole('button', { name: /accept/i });
    const declineBtn = screen.getByRole('button', { name: /decline/i });
    expect(acceptBtn).toBeInTheDocument();
    expect(declineBtn).toBeInTheDocument();

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith('/api/matches/match-p1', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }));
    });
  });

  it('renders Declined badge when matchStatus is DECLINED', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      ...mockProfileData,
      viewer: {
        ...mockProfileData.viewer,
        matchStatus: 'DECLINED',
        requestDirection: null,
      },
    });

    render(
      <MemoryRouter initialEntries={['/profile/u2']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Bob Miller');
    expect(screen.getByRole('button', { name: /declined/i })).toBeDisabled();
  });

  it('renders 404 state when profile does not exist', async () => {
    const error = new apiModule.ApiError('Profile not found', 404);
    vi.spyOn(apiModule, 'apiFetch').mockRejectedValue(error);

    render(
      <MemoryRouter initialEntries={['/profile/nonexistent']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Profile Not Found')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
    });
  });
});
