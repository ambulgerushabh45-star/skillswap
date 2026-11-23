import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewsPage from '@/pages/ReviewsPage';
import * as apiModule from '@/lib/api';

const mockUserData = {
  user: {
    id: 'u2',
    name: 'Bob Miller',
    avatarUrl: '/avatars/bob.webp',
    bio: 'Python enthusiast and tutor',
  },
  viewer: {
    isSelf: false,
    hasAcceptedMatch: true,
    hasReviewed: false,
    canReview: true,
  },
};

const mockReviewsData = {
  avgRating: 4.8,
  totalReviews: 2,
  reviews: [
    {
      id: 'rev1',
      rating: 5,
      comment: 'Excellent Python mentoring session! Highly recommended.',
      createdAt: '2026-11-05T12:00:00Z',
      fromUser: {
        id: 'u3',
        name: 'Charlie Davis',
        avatarUrl: '',
      },
    },
    {
      id: 'rev2',
      rating: 4,
      comment: 'Very helpful with debugging async code.',
      createdAt: '2026-11-04T15:00:00Z',
      fromUser: {
        id: 'u4',
        name: 'Dana Scully',
        avatarUrl: '',
      },
    },
  ],
  pagination: {
    total: 2,
    page: 1,
    limit: 50,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
};

describe('ReviewsPage component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders prompt card to find peers if no toUserId is provided', () => {
    render(
      <MemoryRouter initialEntries={['/reviews']}>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Select a Peer to Review')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /find peers on dashboard/i })
    ).toBeInTheDocument();
  });

  it('loads peer profile and past reviews when toUserId is provided in query params', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/users/u2') {
        return Promise.resolve(mockUserData);
      }
      if (endpoint.startsWith('/api/reviews?toUserId=u2')) {
        return Promise.resolve(mockReviewsData);
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/reviews?toUserId=u2&name=Bob%20Miller']}>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Review Bob Miller')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText(/Based on 2 reviews/)).toBeInTheDocument();
    expect(
      screen.getByText(/Excellent Python mentoring session! Highly recommended./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Very helpful with debugging async code./)
    ).toBeInTheDocument();
  });

  it('supports star selection from 1 to 5 stars', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/users/u2') {
        return Promise.resolve(mockUserData);
      }
      if (endpoint.startsWith('/api/reviews?toUserId=u2')) {
        return Promise.resolve(mockReviewsData);
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/reviews?toUserId=u2&name=Bob%20Miller']}>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('5 / 5 Stars')).toBeInTheDocument();

    const star3Button = screen.getByRole('button', { name: 'Rate 3 stars' });
    fireEvent.click(star3Button);

    expect(screen.getByText('3 / 5 Stars')).toBeInTheDocument();
  });

  it('renders already-reviewed banner if viewer has already reviewed the user', async () => {
    const userAlreadyReviewed = {
      ...mockUserData,
      viewer: {
        ...mockUserData.viewer,
        hasReviewed: true,
        canReview: false,
      },
    };

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/users/u2') {
        return Promise.resolve(userAlreadyReviewed);
      }
      if (endpoint.startsWith('/api/reviews?toUserId=u2')) {
        return Promise.resolve(mockReviewsData);
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/reviews?toUserId=u2&name=Bob%20Miller']}>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('You have already reviewed this person.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /submit review/i })
    ).not.toBeInTheDocument();
  });

  it('submits review successfully and refreshes review list', async () => {
    let postBody = null;

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint, options) => {
      if (endpoint === '/api/users/u2') {
        return Promise.resolve(mockUserData);
      }
      if (endpoint.startsWith('/api/reviews?toUserId=u2')) {
        return Promise.resolve(mockReviewsData);
      }
      if (endpoint === '/api/reviews' && options?.method === 'POST') {
        postBody = JSON.parse(options.body);
        return Promise.resolve({
          review: {
            id: 'rev_new',
            rating: postBody.rating,
            comment: postBody.comment,
            createdAt: new Date().toISOString(),
          },
        });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/reviews?toUserId=u2&name=Bob%20Miller']}>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Review Bob Miller')).toBeInTheDocument();

    // Select 4 stars
    fireEvent.click(screen.getByRole('button', { name: 'Rate 4 stars' }));

    // Type comment
    const textarea = screen.getByPlaceholderText(
      /How was your skill swap session with Bob Miller\?/i
    );
    fireEvent.change(textarea, {
      target: { value: 'Great session, learned a ton about decorators!' },
    });

    // Submit
    const submitButton = screen.getByRole('button', { name: /submit review/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(postBody).toEqual({
        toUserId: 'u2',
        rating: 4,
        comment: 'Great session, learned a ton about decorators!',
      });
    });

    expect(
      await screen.findByText(/Review submitted! Thank you for rating this skill session./)
    ).toBeInTheDocument();
  });

  it('handles 409 conflict error when already reviewed', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint, options) => {
      if (endpoint === '/api/users/u2') {
        return Promise.resolve(mockUserData);
      }
      if (endpoint.startsWith('/api/reviews?toUserId=u2')) {
        return Promise.resolve(mockReviewsData);
      }
      if (endpoint === '/api/reviews' && options?.method === 'POST') {
        return Promise.reject(
          new apiModule.ApiError(
            'You have already submitted a review for this user',
            409
          )
        );
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/reviews?toUserId=u2&name=Bob%20Miller']}>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Review Bob Miller')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(
      /How was your skill swap session with Bob Miller\?/i
    );
    fireEvent.change(textarea, { target: { value: 'Duplicate attempt' } });

    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));

    expect(
      await screen.findByText(/You have already submitted a review for this user/)
    ).toBeInTheDocument();
  });

  it('supports pagination with load more reviews button', async () => {
    const paginatedReviews = {
      ...mockReviewsData,
      pagination: {
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      },
    };

    const page2Reviews = {
      avgRating: 4.8,
      totalReviews: 3,
      reviews: [
        {
          id: 'rev3',
          rating: 5,
          comment: 'Page 2 review from Edward!',
          createdAt: '2026-11-03T11:00:00Z',
          fromUser: {
            id: 'u5',
            name: 'Edward Nygma',
            avatarUrl: '',
          },
        },
      ],
      pagination: {
        total: 3,
        page: 2,
        limit: 2,
        totalPages: 2,
        hasNextPage: false,
        hasPrevPage: true,
      },
    };

    const fetchSpy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation((endpoint) => {
        if (endpoint === '/api/users/u2') {
          return Promise.resolve(mockUserData);
        }
        if (endpoint.includes('page=1')) {
          return Promise.resolve(paginatedReviews);
        }
        if (endpoint.includes('page=2')) {
          return Promise.resolve(page2Reviews);
        }
        return Promise.resolve({});
      });

    render(
      <MemoryRouter initialEntries={['/reviews?toUserId=u2&name=Bob%20Miller']}>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Review Bob Miller')).toBeInTheDocument();

    const loadMoreButton = await screen.findByRole('button', {
      name: /load more reviews/i,
    });
    expect(loadMoreButton).toBeInTheDocument();

    fireEvent.click(loadMoreButton);

    expect(
      await screen.findByText(/Page 2 review from Edward!/)
    ).toBeInTheDocument();

    // Verify page 2 was requested
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/reviews?toUserId=u2&page=2&limit=50'
    );
  });
});
