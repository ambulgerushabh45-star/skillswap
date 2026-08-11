"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  MessageSquare,
  Search,
  Sparkles,
  User,
  Star,
  MapPin,
  Clock,
  ArrowLeft,
} from "lucide-react";

interface ConversationItem {
  matchId: string;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  peerLocation: string;
  matchedSkillName: string;
  status: string;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
}

interface MessageItem {
  id: string;
  matchId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
}

function ChatContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [inputContent, setInputContent] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll message stream to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load conversations list
  const loadConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        const convs: ConversationItem[] = data.conversations || [];
        setConversations(convs);

        // Check query param or select first conversation by default
        const queryMatchId = searchParams.get("matchId");
        if (queryMatchId && convs.some((c) => c.matchId === queryMatchId)) {
          setActiveMatchId(queryMatchId);
        } else if (convs.length > 0 && !activeMatchId) {
          setActiveMatchId(convs[0].matchId);
        }
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load message history for active match
  const loadMessages = async (matchId: string) => {
    try {
      const res = await fetch(`/api/messages?matchId=${matchId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      loadConversations();
    } else if (status === "unauthenticated") {
      router.push("/auth");
    }
  }, [status, router]);

  useEffect(() => {
    if (activeMatchId) {
      loadMessages(activeMatchId);

      // Poll every 3 seconds for smooth real-time message sync fallback
      const interval = setInterval(() => {
        loadMessages(activeMatchId);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [activeMatchId]);

  // Handle message send submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || !activeMatchId || sending) return;

    setSending(true);
    const contentToSend = inputContent;
    setInputContent("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: activeMatchId,
          content: contentToSend,
        }),
      });

      if (res.ok) {
        await loadMessages(activeMatchId);
        await loadConversations(); // Refresh last message in left panel
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    c.peerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.matchedSkillName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeConversation = conversations.find((c) => c.matchId === activeMatchId);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
          Loading your skill-swap messages...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
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

            {/* Conversation List ScrollArea */}
            <ScrollArea className="flex-1">
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
                        onClick={() => setActiveMatchId(conv.matchId)}
                        className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                          isActive ? "bg-indigo-50/80 border-l-4 border-indigo-600" : "hover:bg-slate-100/60"
                        }`}
                      >
                        <Avatar className="h-10 w-10 shrink-0 border border-slate-200">
                          <AvatarImage src={conv.peerAvatar} alt={conv.peerName} />
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold text-sm">
                            {conv.peerName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold text-slate-900 text-xs truncate">
                              {conv.peerName}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-white border-slate-200 text-indigo-700">
                              {conv.matchedSkillName}
                            </Badge>
                          </div>

                          <p className="text-[11px] text-slate-500 truncate">
                            {conv.lastMessage ? conv.lastMessage.content : "Tap to open conversation"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Panel: Message Thread Stream (8 cols) */}
          <div className="md:col-span-8 flex flex-col bg-white">
            {activeConversation ? (
              <>
                {/* Active Peer Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-200">
                      <AvatarImage src={activeConversation.peerAvatar} alt={activeConversation.peerName} />
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
                        {activeConversation.peerName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {activeConversation.peerName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {activeConversation.peerLocation}
                        </span>
                        <span>•</span>
                        <span className="text-indigo-600 font-medium">
                          Swap: {activeConversation.matchedSkillName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rating / Review Action Button */}
                  <Link href={`/reviews?toUserId=${activeConversation.peerId}&name=${encodeURIComponent(activeConversation.peerName)}`}>
                    <Button variant="outline" size="sm" className="gap-1 text-xs border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      Rate & Review Session
                    </Button>
                  </Link>
                </div>

                {/* Message Bubble Stream */}
                <ScrollArea className="flex-1 p-4 bg-slate-50/30">
                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <Sparkles className="h-8 w-8 text-indigo-300 mx-auto mb-2" />
                      <p>This is the start of your message thread with <strong>{activeConversation.peerName}</strong>.</p>
                      <p className="mt-1 text-slate-400">Say hi and suggest a time or place to swap skills!</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-3xl mx-auto">
                      {messages.map((m) => {
                        const isMe = m.senderId !== activeConversation.peerId;
                        const messageDate = new Date(m.createdAt);

                        return (
                          <div
                            key={m.id}
                            className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
                          >
                            {!isMe && (
                              <Avatar className="h-7 w-7 border border-slate-200 shrink-0 mb-1">
                                <AvatarImage src={m.senderAvatar} alt={m.senderName} />
                                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                                  {m.senderName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            )}

                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${
                              isMe
                                ? "bg-indigo-600 text-white rounded-br-none shadow-sm"
                                : "bg-white text-slate-900 border border-slate-200 rounded-bl-none shadow-sm"
                            }`}>
                              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                              <span className={`text-[10px] block mt-1 text-right ${
                                isMe ? "text-indigo-200" : "text-slate-400"
                              }`}>
                                {messageDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input Form */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                  <Input
                    placeholder={`Message ${activeConversation.peerName}...`}
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                    className="flex-1 text-xs"
                  />
                  <Button
                    type="submit"
                    disabled={sending || !inputContent.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 px-4"
                  >
                    <Send className="h-4 w-4" />
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
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading chat interface...</div>}>
      <ChatContent />
    </Suspense>
  );
}
