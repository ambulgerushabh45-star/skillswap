import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatPage from '@/pages/ChatPage';
import * as AuthContextModule from '@/context/AuthContext';
import * as apiModule from '@/lib/api';

const mockConversationsData = {
  conversations: [
    {
      matchId: 'm1',
      peerId: 'u2',
      peerName: 'Bob Miller',
      peerAvatar: '/avatars/bob.webp',
      peerLocation: 'Bengaluru',
      matchedSkillName: 'Python Programming',
      lastMessage: {
        content: 'Hi Alex! Ready for Python tutoring?',
        createdAt: '2026-11-06T10:00:00Z',
      },
    },
    {
      matchId: 'm2',
      peerId: 'u3',
      peerName: 'Charlie Davis',
      peerAvatar: '',
      peerLocation: 'Bengaluru',
      matchedSkillName: 'UI Design',
      lastMessage: {
        content: 'Let us meet this weekend for Figma.',
        createdAt: '2026-11-06T09:30:00Z',
      },
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

const mockMessagesM1 = {
  messages: [
    {
      id: 'msg1',
      matchId: 'm1',
      senderId: 'u2',
      senderName: 'Bob Miller',
      senderAvatar: '/avatars/bob.webp',
      content: 'M1 unique stream message',
      createdAt: '2026-11-06T10:00:00Z',
    },
  ],
  total: 1,
  limit: 200,
  hasMore: false,
  nextCursor: null,
};

const mockMessagesM2 = {
  messages: [
    {
      id: 'msg2',
      matchId: 'm2',
      senderId: 'u3',
      senderName: 'Charlie Davis',
      senderAvatar: '',
      content: 'M2 unique stream message',
      createdAt: '2026-11-06T09:30:00Z',
    },
  ],
  total: 1,
  limit: 200,
  hasMore: false,
  nextCursor: null,
};

describe('ChatPage component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'u1', name: 'Alex Johnson', email: 'alex@example.com' },
      status: 'authenticated',
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders conversations list and filters by search query', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/conversations') {
        return Promise.resolve(mockConversationsData);
      }
      if (endpoint.startsWith('/api/messages?matchId=')) {
        return Promise.resolve(mockMessagesM1);
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ChatPage />
      </MemoryRouter>
    );

    // Initial load selects first match (Bob)
    expect(await screen.findByRole('heading', { name: 'Bob Miller' })).toBeInTheDocument();
    expect(screen.getByText('Charlie Davis')).toBeInTheDocument();

    // Filter conversations by skill
    const searchInput = screen.getByPlaceholderText(/Search chats or skills/i);
    fireEvent.change(searchInput, { target: { value: 'Design' } });

    // Bob's conversation item in sidebar should disappear
    expect(screen.queryByText('Python Programming')).not.toBeInTheDocument();
    expect(screen.getByText('Charlie Davis')).toBeInTheDocument();
  });

  it('selects active conversation from URL query parameter ?matchId=m2', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/conversations') {
        return Promise.resolve(mockConversationsData);
      }
      if (endpoint.startsWith('/api/messages?matchId=m2')) {
        return Promise.resolve(mockMessagesM2);
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m2']}>
        <ChatPage />
      </MemoryRouter>
    );

    // Active conversation header should show Charlie Davis
    expect(
      await screen.findByRole('heading', { name: 'Charlie Davis' })
    ).toBeInTheDocument();
    expect(
      await screen.findByText('M2 unique stream message')
    ).toBeInTheDocument();
  });

  it('polls messages every 3 seconds for active conversation', async () => {
    vi.useFakeTimers();

    const fetchSpy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation((endpoint) => {
        if (endpoint === '/api/conversations') {
          return Promise.resolve(mockConversationsData);
        }
        if (endpoint.startsWith('/api/messages?matchId=m1')) {
          return Promise.resolve(mockMessagesM1);
        }
        return Promise.resolve({});
      });

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m1']}>
        <ChatPage />
      </MemoryRouter>
    );

    // Flush initial load promises
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/conversations');
    expect(fetchSpy).toHaveBeenCalledWith('/api/messages?matchId=m1');

    const initialCallCount = fetchSpy.mock.calls.filter((c) =>
      c[0].startsWith('/api/messages?matchId=m1')
    ).length;

    // Advance timer by 3 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    const after3sCount = fetchSpy.mock.calls.filter((c) =>
      c[0].startsWith('/api/messages?matchId=m1')
    ).length;

    expect(after3sCount).toBe(initialCallCount + 1);
  });

  it('pauses polling when document visibility is hidden and resumes when visible', async () => {
    vi.useFakeTimers();

    const fetchSpy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation((endpoint) => {
        if (endpoint === '/api/conversations') {
          return Promise.resolve(mockConversationsData);
        }
        if (endpoint.startsWith('/api/messages?matchId=m1')) {
          return Promise.resolve(mockMessagesM1);
        }
        return Promise.resolve({});
      });

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m1']}>
        <ChatPage />
      </MemoryRouter>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Simulate tab becoming hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    fireEvent(document, new Event('visibilitychange'));

    const countBeforeHiddenAdvance = fetchSpy.mock.calls.filter((c) =>
      c[0].startsWith('/api/messages?matchId=m1')
    ).length;

    // Advance 6 seconds while hidden
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    const countAfterHiddenAdvance = fetchSpy.mock.calls.filter((c) =>
      c[0].startsWith('/api/messages?matchId=m1')
    ).length;

    // No new message polls while hidden
    expect(countAfterHiddenAdvance).toBe(countBeforeHiddenAdvance);

    // Now tab becomes visible again
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    fireEvent(document, new Event('visibilitychange'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const countAfterVisible = fetchSpy.mock.calls.filter((c) =>
      c[0].startsWith('/api/messages?matchId=m1')
    ).length;

    // Immediately triggers an update
    expect(countAfterVisible).toBeGreaterThan(countBeforeHiddenAdvance);
  });

  it('discards stale messages if active conversation was switched during in-flight fetch', async () => {
    let resolveM1Messages;
    const m1MessagesPromise = new Promise((resolve) => {
      resolveM1Messages = resolve;
    });

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/conversations') {
        return Promise.resolve(mockConversationsData);
      }
      if (endpoint === '/api/messages?matchId=m1') {
        return m1MessagesPromise;
      }
      if (endpoint === '/api/messages?matchId=m2') {
        return Promise.resolve(mockMessagesM2);
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m1']}>
        <ChatPage />
      </MemoryRouter>
    );

    // Wait for conversation list to render
    expect(await screen.findByText('Python Programming')).toBeInTheDocument();

    // User switches to Charlie Davis (m2) before m1 resolves
    const charlieButton = screen.getByText('Charlie Davis').closest('button');
    fireEvent.click(charlieButton);

    expect(
      await screen.findByRole('heading', { name: 'Charlie Davis' })
    ).toBeInTheDocument();
    expect(
      await screen.findByText('M2 unique stream message')
    ).toBeInTheDocument();

    // Now resolve the late m1 messages
    resolveM1Messages(mockMessagesM1);

    await waitFor(() => {
      // Bob's message should NOT be in the active view
      expect(
        screen.queryByText('M1 unique stream message')
      ).not.toBeInTheDocument();
      // Charlie's message stays
      expect(
        screen.getByText('M2 unique stream message')
      ).toBeInTheDocument();
    });
  });

  it('handles message submission success: trims, posts, clears input, and refreshes', async () => {
    let currentMessages = [...mockMessagesM1.messages];

    const postSpy = vi.fn().mockImplementation((endpoint, options) => {
      if (endpoint === '/api/messages' && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        currentMessages.push({
          id: 'msg_new',
          matchId: body.matchId,
          senderId: 'u1',
          senderName: 'Alex Johnson',
          senderAvatar: '',
          content: body.content,
          createdAt: new Date().toISOString(),
        });
        return Promise.resolve({ success: true });
      }
      if (endpoint === '/api/conversations') {
        return Promise.resolve(mockConversationsData);
      }
      if (endpoint.startsWith('/api/messages?matchId=m1')) {
        return Promise.resolve({
          messages: currentMessages,
          total: currentMessages.length,
          limit: 200,
          hasMore: false,
          nextCursor: null,
        });
      }
      return Promise.resolve({});
    });

    vi.spyOn(apiModule, 'apiFetch').mockImplementation(postSpy);

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m1']}>
        <ChatPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('M1 unique stream message')
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Message Bob Miller.../i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: '  Yes, Saturday works great!  ' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          matchId: 'm1',
          content: 'Yes, Saturday works great!',
        }),
      });
    });

    // Input cleared
    expect(input.value).toBe('');

    // New message rendered
    expect(
      await screen.findByText('Yes, Saturday works great!')
    ).toBeInTheDocument();
  });

  it('preserves input content and displays error banner when message send fails (429 Rate Limit)', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint, options) => {
      if (endpoint === '/api/messages' && options?.method === 'POST') {
        return Promise.reject(
          new apiModule.ApiError(
            'Too many requests. Please try again in 5 seconds.',
            429
          )
        );
      }
      if (endpoint === '/api/conversations') {
        return Promise.resolve(mockConversationsData);
      }
      if (endpoint.startsWith('/api/messages?matchId=m1')) {
        return Promise.resolve(mockMessagesM1);
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m1']}>
        <ChatPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('M1 unique stream message')
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Message Bob Miller.../i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'Important meeting question' } });
    fireEvent.click(sendButton);

    expect(
      await screen.findByText(/Too many requests. Please try again in 5 seconds./)
    ).toBeInTheDocument();

    // Input preserved
    expect(input.value).toBe('Important meeting question');
  });

  it('renders peer profile link and Rate & Review session action button', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/conversations') {
        return Promise.resolve(mockConversationsData);
      }
      if (endpoint.startsWith('/api/messages?matchId=m1')) {
        return Promise.resolve(mockMessagesM1);
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m1']}>
        <ChatPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('heading', { name: 'Bob Miller' })
    ).toBeInTheDocument();

    // Check link to profile
    const profileLink = screen.getByRole('link', { name: 'Bob Miller' });
    expect(profileLink).toHaveAttribute('href', '/profile/u2');

    // Check link to review
    const reviewLink = screen.getByRole('link', {
      name: /rate & review session/i,
    });
    expect(reviewLink).toHaveAttribute(
      'href',
      '/reviews?toUserId=u2&name=Bob%20Miller'
    );
  });

  it('renders Accept and Decline buttons and disables input for RECEIVED pending conversations', async () => {
    const receivedConvs = {
      conversations: [
        {
          matchId: 'm-pending-rcv',
          peerId: 'u2',
          peerName: 'Bob Miller',
          status: 'PENDING',
          requestDirection: 'RECEIVED',
          matchedSkillName: 'Python',
          lastMessage: null,
        },
      ],
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    };

    const apiSpy = vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/conversations') return Promise.resolve(receivedConvs);
      if (endpoint.startsWith('/api/messages')) return Promise.resolve({ messages: [] });
      if (endpoint === '/api/matches/m-pending-rcv') {
        return Promise.resolve({ match: { id: 'm-pending-rcv', status: 'ACCEPTED' } });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m-pending-rcv']}>
        <ChatPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Bob Miller wants to swap skills with you/i)).toBeInTheDocument();
    const acceptBtn = screen.getByRole('button', { name: /accept/i });
    const declineBtn = screen.getByRole('button', { name: /decline/i });
    expect(acceptBtn).toBeInTheDocument();
    expect(declineBtn).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/accept the request to reply/i);
    expect(input).toBeDisabled();

    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith('/api/matches/m-pending-rcv', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }));
    });
  });

  it('renders counter hint for SENT pending conversations', async () => {
    const sentConvs = {
      conversations: [
        {
          matchId: 'm-pending-sent',
          peerId: 'u2',
          peerName: 'Bob Miller',
          status: 'PENDING',
          requestDirection: 'SENT',
          matchedSkillName: 'Python',
          lastMessage: null,
        },
      ],
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    };

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/conversations') return Promise.resolve(sentConvs);
      if (endpoint.startsWith('/api/messages')) return Promise.resolve({ messages: [] });
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m-pending-sent']}>
        <ChatPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/You can send up to 3 messages until the request is accepted/i)
    ).toBeInTheDocument();
  });

  it('renders declined banner and disables input for DECLINED conversations', async () => {
    const declinedConvs = {
      conversations: [
        {
          matchId: 'm-declined',
          peerId: 'u2',
          peerName: 'Bob Miller',
          status: 'DECLINED',
          requestDirection: null,
          matchedSkillName: 'Python',
          lastMessage: null,
        },
      ],
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    };

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/conversations') return Promise.resolve(declinedConvs);
      if (endpoint.startsWith('/api/messages')) return Promise.resolve({ messages: [] });
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={['/chat?matchId=m-declined']}>
        <ChatPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/This connection request was declined/i)
    ).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/this connection request was declined/i);
    expect(input).toBeDisabled();
  });
});
