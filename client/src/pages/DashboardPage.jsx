// client/src/pages/DashboardPage.jsx
// Peer matching dashboard with mutual filters, distance indicators, and connect actions

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  MapPin,
  Search,
  MessageSquare,
  BookOpen,
  GraduationCap,
  Zap,
  Clock,
  UserPlus,
  Edit,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { formatDistance } from '@/lib/geo';

export default function DashboardPage() {
  const { user } = useAuth();

  const [matches, setMatches] = useState([]);
  const [currentUserInfo, setCurrentUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Fetch match suggestions from API
  const loadMatches = useCallback(async () => {
    try {
      const data = await apiFetch('/api/matches');
      setMatches(data.matches || []);
      setCurrentUserInfo(data.currentUser || null);
    } catch (err) {
      console.error('Error loading dashboard matches:', err);
      setActionError(err.message || 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadMatches());
  }, [loadMatches]);

  // Connect request handler
  const handleConnect = async (peer) => {
    setActionLoadingId(peer.id);
    setActionError(null);
    try {
      await apiFetch('/api/matches', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: peer.id,
          matchedSkillName: peer.matchedSkillName,
        }),
      });

      // Refresh matches list to update status
      await loadMatches();
    } catch (err) {
      console.error('Error connecting with peer:', err);
      setActionError(err.message || 'Failed to send connection request');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Accept or Decline pending connection request
  const handleUpdateStatus = async (matchId, status) => {
    setActionLoadingId(matchId);
    setActionError(null);
    try {
      await apiFetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadMatches();
    } catch (err) {
      console.error(`Error updating match status to ${status}:`, err);
      setActionError(err.message || `Failed to ${status.toLowerCase()} request`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter matches based on search term and active tab
  const filteredMatches = matches.filter((peer) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      peer.name.toLowerCase().includes(q) ||
      (peer.location && peer.location.toLowerCase().includes(q)) ||
      (peer.matchedSkillName && peer.matchedSkillName.toLowerCase().includes(q)) ||
      peer.skillsTeach?.some((s) => s.name.toLowerCase().includes(q)) ||
      peer.skillsLearn?.some((s) => s.name.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (activeTab === 'mutual') {
      return peer.isMutual;
    }
    if (activeTab === 'connected') {
      return peer.connectionStatus === 'ACCEPTED' || peer.connectionStatus === 'PENDING';
    }

    return true; // 'all'
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <span className="text-sm">Finding local skill matches for you...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header Summary Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome back, {user?.name || 'Student'}! 👋
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
          {currentUserInfo && currentUserInfo.hasLocation === false && (
            <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <Link to="/profile/setup" className="hover:underline font-medium">
                Set your location to see distances
              </Link>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link to="/profile/setup" className="w-full md:w-auto">
            <Button variant="outline" className="w-full md:w-auto gap-1.5 border-slate-300 text-slate-700">
              <Edit className="h-4 w-4" />
              Edit My Skills & Profile
            </Button>
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

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
              Connected ({matches.filter((m) => m.connectionStatus === 'ACCEPTED' || m.connectionStatus === 'PENDING').length})
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
          <Link to="/profile/setup" className="inline-block mt-4">
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
                      <Link to={`/profile/${peer.id}`} className="hover:opacity-85 transition-opacity">
                        <Avatar className="h-12 w-12 border border-slate-200">
                          <AvatarImage src={peer.avatarUrl || ''} alt={peer.name} />
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
                            {peer.name ? peer.name.charAt(0) : 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div>
                        <Link to={`/profile/${peer.id}`} className="hover:underline">
                          <CardTitle className="text-base text-slate-900">{peer.name}</CardTitle>
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          {peer.reviewCount === 0 ? (
                            <span className="flex items-center gap-0.5 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded text-[11px]">
                              New
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-[11px]">
                              ⭐ {peer.avgRating} ({peer.reviewCount})
                            </span>
                          )}
                          <div className="flex items-center gap-1 flex-wrap">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{peer.location}</span>
                            {peer.distanceKm !== null && peer.distanceKm !== undefined && (
                              <span className="text-slate-500 font-medium">· {formatDistance(peer.distanceKm)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mutual or Received Badge */}
                    {peer.connectionStatus === 'PENDING' && peer.requestDirection === 'RECEIVED' ? (
                      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-semibold py-0.5">
                        Wants to swap with you
                      </Badge>
                    ) : peer.isMutual ? (
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
                    &quot;{peer.bio}&quot;
                  </p>

                  {/* Skills Teaches */}
                  <div>
                    <span className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                      <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
                      Can Teach:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {peer.skillsTeach && peer.skillsTeach.length > 0 ? (
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
                      {peer.skillsLearn && peer.skillsLearn.length > 0 ? (
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

                {peer.connectionStatus === 'ACCEPTED' ? (
                  <Link to={`/chat?matchId=${peer.matchId}`}>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5 text-xs">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Message Chat
                    </Button>
                  </Link>
                ) : peer.connectionStatus === 'DECLINED' ? (
                  <Button size="sm" variant="outline" disabled className="gap-1 text-xs border-slate-300 text-slate-500 bg-slate-50">
                    Declined
                  </Button>
                ) : peer.connectionStatus === 'PENDING' && peer.requestDirection === 'RECEIVED' ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      disabled={actionLoadingId === peer.matchId}
                      onClick={() => handleUpdateStatus(peer.matchId, 'ACCEPTED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs h-8"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoadingId === peer.matchId}
                      onClick={() => handleUpdateStatus(peer.matchId, 'DECLINED')}
                      className="border-slate-300 text-slate-600 hover:bg-slate-100 gap-1 text-xs h-8"
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </Button>
                  </div>
                ) : peer.connectionStatus === 'PENDING' ? (
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
                    {actionLoadingId === peer.id ? 'Sending...' : 'Connect Swap'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
