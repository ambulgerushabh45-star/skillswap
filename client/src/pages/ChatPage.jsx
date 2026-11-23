// client/src/pages/ChatPage.jsx
// Two-panel skill-swap chat with robust 3s polling, in-flight protection, and tab visibility handling

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  MessageSquare,
  Search,
  Sparkles,
  Star,
  MapPin,
  AlertCircle,
  Loader2,
  Clock,
  Check,
  X,
} from 'lucide-react';

export default function ChatPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [inputContent, setInputContent] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sendError, setSendError] = useState(null);

  // References for concurrency, auto-scroll, and polling control
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inFlightMatchIdRef = useRef(null);
  const activeMatchIdRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Sync activeMatchId to ref for stale-response discard
  useEffect(() => {
    activeMatchIdRef.current = activeMatchId;
  }, [activeMatchId]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = true) => {
    if (
      messagesEndRef.current &&
      typeof messagesEndRef.current.scrollIntoView === 'function'
    ) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  // Check if user is scrolled near the bottom of messages container
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 80;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    );
  }, []);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      const data = await apiFetch('/api/conversations');
      const convs = data?.conversations || [];
      setConversations(convs);

      // Select active match: from query param, or preserve current, or default to first
      const queryMatchId = searchParams.get('matchId');
      setActiveMatchId((current) => {
        if (queryMatchId && convs.some((c) => c.matchId === queryMatchId)) {
          return queryMatchId;
        }
        if (current && convs.some((c) => c.matchId === current)) {
          return current;
        }
        if (convs.length > 0) {
          return convs[0].matchId;
        }
        return null;
      });
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  // Load messages for a given matchId
  const loadMessages = useCallback(
    async (matchId, isPoll = false) => {
      if (!matchId) return;

      // In-flight guard: prevent overlapping polling requests for the same match
      if (inFlightMatchIdRef.current === matchId) return;
      inFlightMatchIdRef.current = matchId;

      try {
        const data = await apiFetch(`/api/messages?matchId=${matchId}`);

        // Discard response if active match changed during the request
        if (activeMatchIdRef.current !== matchId) {
          return;
        }

        const newMessages = data?.messages || [];
        setMessages(newMessages);

        // Auto-scroll logic:
        // If not a poll (e.g. user selected conversation or sent a message), always scroll.
        // If it is a poll tick, only scroll if the user is already near bottom.
        if (!isPoll || isNearBottom()) {
          setTimeout(() => scrollToBottom(!isPoll), 50);
        }
      } catch (err) {
        if (activeMatchIdRef.current === matchId) {
          console.error('Error loading messages:', err);
          // If unauthorized or forbidden, stop polling and show error
          if (err.status === 401 || err.status === 403 || err.status === 404) {
            setError(err.message || 'Unable to access messages for this conversation');
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }
        }
      } finally {
        if (inFlightMatchIdRef.current === matchId) {
          inFlightMatchIdRef.current = null;
        }
      }
    },
    [isNearBottom, scrollToBottom]
  );

  // Initial load
  useEffect(() => {
    void Promise.resolve().then(() => loadConversations());
  }, [loadConversations]);

  // Background refresh of conversations list every 15s
  useEffect(() => {
    const listTimer = setInterval(() => {
      void loadConversations();
    }, 15000);
    return () => clearInterval(listTimer);
  }, [loadConversations]);

  // Setup 3s polling and tab visibility handling for active conversation
  useEffect(() => {
    if (!activeMatchId) {
      void Promise.resolve().then(() => setMessages([]));
      return;
    }

    // Reset error on active conversation switch
    void Promise.resolve().then(() => {
      setError(null);
      setSendError(null);
    });

    // Initial immediate fetch for selected match
    void Promise.resolve().then(() => loadMessages(activeMatchId, false));

    // Function to start 3s poll timer
    const startPolling = () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        void loadMessages(activeMatchId, true);
      }, 3000);
    };

    // Function to stop polling
    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    startPolling();

    // Pause polling when tab is hidden, resume immediately when visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else if (document.visibilityState === 'visible') {
        void loadMessages(activeMatchId, false);
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeMatchId, loadMessages]);

  // Handle conversation selection from left panel
  const handleSelectConversation = (matchId) => {
    setActiveMatchId(matchId);
    setSearchParams({ matchId }, { replace: true });
  };

  // Handle sending message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const contentToSend = inputContent.trim();
    if (!contentToSend || !activeMatchId || sending) return;

    setSending(true);
    setSendError(null);

    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          matchId: activeMatchId,
          content: contentToSend,
        }),
      });

      // Clear input on success
      setInputContent('');

      // Refresh messages and conversation list immediately
      await loadMessages(activeMatchId, false);
      void loadConversations();
    } catch (err) {
      console.error('Error sending message:', err);
      // Preserve inputContent on error so user doesn't lose text
      setSendError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Handle accept/decline match status
  const handleUpdateMatchStatus = async (newStatus) => {
    if (!activeMatchId || actionLoading) return;
    setActionLoading(true);
    setSendError(null);
    try {
      await apiFetch(`/api/matches/${activeMatchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      // Update local state immediately without reload
      setConversations((prev) =>
        prev.map((c) =>
          c.matchId === activeMatchId
            ? { ...c, status: newStatus, requestDirection: null }
            : c
        )
      );
      await loadConversations();
    } catch (err) {
      console.error(`Error updating match status to ${newStatus}:`, err);
      setSendError(err.message || `Failed to ${newStatus.toLowerCase()} request`);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter conversations by peer name or skill
  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = c.peerName?.toLowerCase().includes(q);
    const skillMatch = c.matchedSkillName?.toLowerCase().includes(q);
    return nameMatch || skillMatch;
  });

  const activeConversation = conversations.find((c) => c.matchId === activeMatchId);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
        Loading your skill-swap messages...
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col flex-1">
      {/* Page Title */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-indigo-600" />
            Skill Swap Messages
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            Chat with your matched peers to arrange study sessions and skill trades.
          </p>
        </div>
      </div>

      {/* Two-Panel Chat Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[550px] overflow-hidden">
        {/* Left Panel: Conversation List (4 cols) */}
        <div className="md:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50/50">
          {/* Search Input */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search chats or skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No active conversations found. Connect with peers from the Dashboard to start chatting!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredConversations.map((conv) => {
                  const isActive = conv.matchId === activeMatchId;
                  return (
                    <button
                      key={conv.matchId}
                      type="button"
                      onClick={() => handleSelectConversation(conv.matchId)}
                      className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                        isActive
                          ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                          : 'hover:bg-slate-100/60'
                      }`}
                    >
                      <Avatar className="h-10 w-10 shrink-0 border border-slate-200">
                        <AvatarImage src={conv.peerAvatar} alt={conv.peerName} />
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold text-sm">
                          {conv.peerName?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold text-slate-900 text-xs truncate">
                            {conv.peerName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-white border-slate-200 text-indigo-700"
                          >
                            {conv.matchedSkillName}
                          </Badge>
                        </div>

                        <p className="text-[11px] text-slate-500 truncate">
                          {conv.lastMessage?.content || 'Tap to open conversation'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Message Thread Stream (8 cols) */}
        <div className="md:col-span-8 flex flex-col bg-white">
          {activeConversation ? (
            <>
              {/* Active Peer Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <Link
                    to={`/profile/${activeConversation.peerId}`}
                    className="hover:opacity-85 transition-opacity"
                  >
                    <Avatar className="h-10 w-10 border border-slate-200">
                      <AvatarImage
                        src={activeConversation.peerAvatar}
                        alt={activeConversation.peerName}
                      />
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
                        {activeConversation.peerName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div>
                    <Link
                      to={`/profile/${activeConversation.peerId}`}
                      className="hover:underline"
                    >
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {activeConversation.peerName}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {activeConversation.peerLocation || 'Location not specified'}
                      </span>
                      <span>•</span>
                      <span className="text-indigo-600 font-medium">
                        Swap: {activeConversation.matchedSkillName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rating / Review Action Button */}
                <Link
                  to={`/reviews?toUserId=${activeConversation.peerId}&name=${encodeURIComponent(
                    activeConversation.peerName
                  )}`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                  >
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    Rate & Review Session
                  </Button>
                </Link>
              </div>

              {/* Error Banner */}
              {(error || sendError) && (
                <div className="p-3 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{sendError || error}</span>
                </div>
              )}

              {/* Received Request Action Banner */}
              {activeConversation.status === 'PENDING' && activeConversation.requestDirection === 'RECEIVED' && (
                <div className="p-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{activeConversation.peerName} wants to swap skills with you</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={actionLoading}
                      onClick={() => handleUpdateMatchStatus('ACCEPTED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-3 text-xs gap-1"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => handleUpdateMatchStatus('DECLINED')}
                      className="border-amber-300 text-amber-900 hover:bg-amber-100 h-7 px-3 text-xs gap-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {/* Sent Pending Request Counter Banner */}
              {activeConversation.status === 'PENDING' && activeConversation.requestDirection === 'SENT' && (
                <div className="p-2.5 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>You can send up to 3 messages until the request is accepted.</span>
                </div>
              )}

              {/* Declined Banner */}
              {activeConversation.status === 'DECLINED' && (
                <div className="p-3 bg-slate-100 border-b border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-slate-500 shrink-0" />
                  <span>This connection request was declined.</span>
                </div>
              )}

              {/* Message Bubble Stream */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 bg-slate-50/30"
              >
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    <Sparkles className="h-8 w-8 text-indigo-300 mx-auto mb-2" />
                    <p>
                      This is the start of your message thread with{' '}
                      <strong>{activeConversation.peerName}</strong>.
                    </p>
                    <p className="mt-1 text-slate-400">
                      Say hi and suggest a time or place to swap skills!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-3xl mx-auto">
                    {messages.map((m) => {
                      const isMe = user?.id
                        ? m.senderId === user.id
                        : m.senderId !== activeConversation.peerId;
                      const messageDate = new Date(m.createdAt);

                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 ${
                            isMe ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isMe && (
                            <Avatar className="h-7 w-7 border border-slate-200 shrink-0 mb-1">
                              <AvatarImage src={m.senderAvatar} alt={m.senderName} />
                              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                                {m.senderName?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}

                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                                : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none shadow-sm'
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {m.content}
                            </p>
                            <span
                              className={`text-[10px] block mt-1 text-right ${
                                isMe ? 'text-indigo-200' : 'text-slate-400'
                              }`}
                            >
                              {messageDate.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Input Form */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-slate-200 bg-white flex gap-2"
              >
                <Input
                  placeholder={
                    activeConversation.status === 'DECLINED'
                      ? 'This connection request was declined.'
                      : activeConversation.status === 'PENDING' && activeConversation.requestDirection === 'RECEIVED'
                      ? 'Accept the request to reply.'
                      : `Message ${activeConversation.peerName}...`
                  }
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  className="flex-1 text-xs"
                  disabled={
                    sending ||
                    actionLoading ||
                    activeConversation.status === 'DECLINED' ||
                    (activeConversation.status === 'PENDING' && activeConversation.requestDirection === 'RECEIVED')
                  }
                />
                <Button
                  type="submit"
                  disabled={
                    sending ||
                    actionLoading ||
                    !inputContent.trim() ||
                    activeConversation.status === 'DECLINED' ||
                    (activeConversation.status === 'PENDING' && activeConversation.requestDirection === 'RECEIVED')
                  }
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 px-4 text-xs h-9"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
              <div>
                <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p>Select a conversation from the left panel to start messaging.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
