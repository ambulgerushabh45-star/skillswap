"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users,
  Sparkles,
  MapPin,
  Search,
  UserCheck,
  MessageSquare,
  BookOpen,
  GraduationCap,
  Zap,
  Clock,
  UserPlus,
  Edit,
} from "lucide-react";

interface PeerMatch {
  id: string;
  name: string;
  email: string;
  bio: string;
  location: string;
  avatarUrl: string;
  avgRating: number;
  reviewCount: number;
  isMutual: boolean;
  matchedSkillName: string;
  connectionStatus: string; // NONE, PENDING, ACCEPTED, DECLINED
  matchId: string | null;
  skillsTeach: Array<{ id: string; name: string; proficiency: string }>;
  skillsLearn: Array<{ id: string; name: string }>;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [matches, setMatches] = useState<PeerMatch[]>([]);
  const [currentUserInfo, setCurrentUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch match suggestions from API
  const loadMatches = async () => {
    try {
      const res = await fetch("/api/matches");
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        setCurrentUserInfo(data.currentUser || null);
      }
    } catch (err) {
      console.error("Error loading dashboard matches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      loadMatches();
    } else if (status === "unauthenticated") {
      router.push("/auth");
    }
  }, [status, router]);

  // Connect request handler
  const handleConnect = async (peer: PeerMatch) => {
    setActionLoadingId(peer.id);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: peer.id,
          matchedSkillName: peer.matchedSkillName,
        }),
      });

      if (res.ok) {
        await loadMatches(); // Refresh state
      }
    } catch (err) {
      console.error("Error connecting with peer:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Accept request handler
  const handleAccept = async (matchId: string) => {
    setActionLoadingId(matchId);
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACCEPTED" }),
      });

      if (res.ok) {
        await loadMatches();
      }
    } catch (err) {
      console.error("Error accepting match:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter matches based on search term and active tab
  const filteredMatches = matches.filter((peer) => {
    // 1. Search Query Filter
    const matchesSearch =
      peer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      peer.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      peer.matchedSkillName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      peer.skillsTeach.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      peer.skillsLearn.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Tab Filter
    if (activeTab === "mutual") {
      return peer.isMutual;
    }
    if (activeTab === "connected") {
      return peer.connectionStatus === "ACCEPTED" || peer.connectionStatus === "PENDING";
    }

    return true; // "all"
  });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
          Finding local skill matches for you...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header Summary Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome back, {session?.user?.name || "Student"}! 👋
              </h1>
              {currentUserInfo?.teachCount === 0 && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 text-xs">
                  Setup Pending
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Explore local skill-swap matches nearby.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link href="/profile/setup" className="w-full md:w-auto">
              <Button variant="outline" className="w-full md:w-auto gap-1.5 border-slate-300 text-slate-700">
                <Edit className="h-4 w-4" />
                Edit My Skills & Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* Search & Tabs Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-3 w-full sm:w-auto">
              <TabsTrigger value="all">All Matches ({matches.length})</TabsTrigger>
              <TabsTrigger value="mutual" className="gap-1">
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                Mutual ({matches.filter((m) => m.isMutual).length})
              </TabsTrigger>
              <TabsTrigger value="connected">
                Connected ({matches.filter((m) => m.connectionStatus === "ACCEPTED" || m.connectionStatus === "PENDING").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Input Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search skill, name, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Grid of Matched Users */}
        {filteredMatches.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-md mx-auto">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 text-base">No Skill Matches Found</h3>
            <p className="text-slate-500 text-xs mt-1">
              Try adjusting your search filter or add more skills to your profile wishlist!
            </p>
            <Link href="/profile/setup" className="inline-block mt-4">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                Update Profile Skills
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatches.map((peer) => (
              <Card key={peer.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border border-slate-200">
                          <AvatarImage src={peer.avatarUrl} alt={peer.name} />
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
                            {peer.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base text-slate-900">{peer.name}</CardTitle>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="flex items-center gap-0.5 font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-[11px]">
                              ⭐ {peer.avgRating} ({peer.reviewCount})
                            </span>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <span>{peer.location}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Mutual Badge */}
                      {peer.isMutual ? (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 gap-1 text-[11px] font-semibold py-0.5">
                          <Zap className="h-3 w-3 fill-amber-500 text-amber-600" />
                          Mutual Swap
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[11px]">
                          Match
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 text-xs pb-4">
                    {/* Bio */}
                    <p className="text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded border border-slate-100">
                      "{peer.bio}"
                    </p>

                    {/* Skills Teaches */}
                    <div>
                      <span className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                        <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
                        Can Teach:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {peer.skillsTeach.length > 0 ? (
                          peer.skillsTeach.map((st) => (
                            <Badge
                              key={st.id}
                              className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-normal text-[11px]"
                            >
                              {st.name} ({st.proficiency})
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">None listed</span>
                        )}
                      </div>
                    </div>

                    {/* Skills Wants to Learn */}
                    <div>
                      <span className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                        Wants to Learn:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {peer.skillsLearn.length > 0 ? (
                          peer.skillsLearn.map((sl) => (
                            <Badge
                              key={sl.id}
                              variant="outline"
                              className="bg-slate-50 text-slate-700 border-slate-200 font-normal text-[11px]"
                            >
                              {sl.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">None listed</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Card Action Buttons */}
                <CardFooter className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Swap: <strong className="text-indigo-600">{peer.matchedSkillName}</strong>
                  </span>

                  {peer.connectionStatus === "ACCEPTED" ? (
                    <Link href={`/chat?matchId=${peer.matchId}`}>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5 text-xs">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Message Chat
                      </Button>
                    </Link>
                  ) : peer.connectionStatus === "PENDING" ? (
                    <Button size="sm" variant="outline" disabled className="gap-1 text-xs border-amber-300 text-amber-700 bg-amber-50">
                      <Clock className="h-3.5 w-3.5" />
                      Pending Request
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={actionLoadingId === peer.id}
                      onClick={() => handleConnect(peer)}
                      className="bg-indigo-600 hover:bg-indigo-700 gap-1 text-xs"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {actionLoadingId === peer.id ? "Sending..." : "Connect Swap"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
