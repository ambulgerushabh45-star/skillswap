// client/src/pages/ProfileDetailPage.jsx
// Public profile page with viewer status actions, skill badges, and reviews

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MapPin,
  Star,
  GraduationCap,
  BookOpen,
  MessageSquare,
  Clock,
  UserPlus,
  Edit,
  ArrowLeft,
  AlertCircle,
  Users,
  Check,
  X,
} from 'lucide-react';

export default function ProfileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorStatus(null);
    try {
      const data = await apiFetch(`/api/users/${id}`);
      setProfile(data);
    } catch (err) {
      setErrorStatus(err.status || 500);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(() => loadProfile());
  }, [loadProfile]);

  const handleConnect = async () => {
    if (!profile) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const data = await apiFetch('/api/matches', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: profile.user.id,
          matchedSkillName: profile.user.skillsTeach[0]?.name || 'General Skill Swap',
        }),
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              viewer: {
                ...prev.viewer,
                matchStatus: 'PENDING',
                matchId: data?.match?.id || prev.viewer.matchId,
              },
            }
          : prev
      );
    } catch (err) {
      setActionError(err.message || 'An unexpected error occurred while connecting.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!profile?.viewer?.matchId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await apiFetch(`/api/matches/${profile.viewer.matchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadProfile();
    } catch (err) {
      console.error(`Error updating match status to ${status}:`, err);
      setActionError(err.message || `Failed to ${status.toLowerCase()} request`);
    } finally {
      setActionLoading(false);
    }
  };

  // Loading state skeleton
  if (loading) {
    return (
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
        <div className="h-8 w-24 bg-slate-200 rounded mb-4" />
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 bg-slate-200 rounded" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not Found state (404)
  if (errorStatus === 404) {
    return (
      <div className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col items-center justify-center text-center my-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm w-full">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 mb-1">Profile Not Found</h2>
          <p className="text-slate-500 text-xs mb-6">
            The user profile you are looking for does not exist or may have been removed.
          </p>
          <Link to="/dashboard">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Generic Error state
  if (errorStatus || !profile) {
    return (
      <div className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col items-center justify-center text-center my-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm w-full">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 mb-1">Failed to Load Profile</h2>
          <p className="text-slate-500 text-xs mb-6">
            Something went wrong loading this peer&apos;s profile. Please try again.
          </p>
          <Button onClick={() => void loadProfile()} className="w-full bg-indigo-600 hover:bg-indigo-700">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const { user, rating, reviews, viewer } = profile;

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      {/* Navigation Bar */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-4 gap-1.5 text-xs text-slate-600 border-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Action Error Banner */}
      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Profile Header Hero Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-slate-200 shadow-sm">
              <AvatarImage src={user.avatarUrl || user.image || undefined} alt={user.name} />
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-2xl font-bold">
                {user.name ? user.name.charAt(0) : 'U'}
              </AvatarFallback>
            </Avatar>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs text-slate-500">
                {/* Rating Badge */}
                {rating.count === 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-xs">
                    New
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-xs">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    {rating.average} ({rating.count} {rating.count === 1 ? 'review' : 'reviews'})
                  </span>
                )}

                {user.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{user.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Viewer Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {viewer.isSelf ? (
              <Link to="/profile/setup">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 text-xs">
                  <Edit className="h-3.5 w-3.5" />
                  Edit Profile
                </Button>
              </Link>
            ) : viewer.matchStatus === 'NONE' ? (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 text-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {actionLoading ? 'Connecting...' : 'Connect'}
              </Button>
            ) : viewer.matchStatus === 'DECLINED' ? (
              <Button size="sm" disabled variant="outline" className="border-slate-300 text-slate-500 gap-1.5 text-xs">
                Declined
              </Button>
            ) : viewer.matchStatus === 'PENDING' && viewer.requestDirection === 'RECEIVED' ? (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => handleUpdateStatus('ACCEPTED')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading}
                  onClick={() => handleUpdateStatus('DECLINED')}
                  className="border-slate-300 text-slate-600 hover:bg-slate-100 gap-1 text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                  Decline
                </Button>
              </div>
            ) : viewer.matchStatus === 'PENDING' ? (
              <Button size="sm" disabled variant="outline" className="border-slate-300 text-slate-500 gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" />
                Request Pending
              </Button>
            ) : viewer.matchStatus === 'ACCEPTED' ? (
              <>
                <Link to="/chat">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 text-xs">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Message
                  </Button>
                </Link>
                {!viewer.hasReviewed && (
                  <Link to={`/reviews?toUserId=${user.id}&name=${encodeURIComponent(user.name)}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 gap-1 text-xs"
                    >
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      Rate & Review
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-500 italic bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
                Connection request was declined
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Profile Body Grid */}
      <div className="grid md:grid-cols-12 gap-6">
        {/* Left Column: Bio & Skills (7 cols) */}
        <div className="md:col-span-7 space-y-6">
          {/* About Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-900">About</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-700 leading-relaxed">
              {user.bio ? (
                <p className="whitespace-pre-line">{user.bio}</p>
              ) : (
                <p className="text-slate-400 italic">No bio provided yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Skills Offered / Can Teach */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-indigo-600" />
                Skills Offered (Can Teach)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.skillsTeach.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No teaching skills listed.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.skillsTeach.map((st, i) => (
                    <Badge
                      key={i}
                      className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-xs font-normal"
                    >
                      <span className="font-medium mr-1">{st.name}</span>
                      <span className="text-indigo-500">({st.proficiencyLevel})</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Skills Wanted / Wants to Learn */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                Skills Wanted (Wants to Learn)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.skillsLearn.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No learning skills listed.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.skillsLearn.map((sl, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-slate-200 text-slate-700 bg-slate-50 px-2.5 py-1 text-xs font-normal"
                    >
                      {sl.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Reviews & Ratings (5 cols) */}
        <div className="md:col-span-5">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                  Reviews & Feedback
                </CardTitle>
                <span className="text-xs text-slate-500">
                  {rating.count} {rating.count === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {reviews.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <p>No reviews yet.</p>
                  <p className="mt-1">Connect and complete a skill session to leave the first review!</p>
                </div>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="border-b border-slate-100 last:border-b-0 pb-4 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 border border-slate-200">
                          <AvatarImage src={r.fromUser.avatarUrl} alt={r.fromUser.name} />
                          <AvatarFallback className="text-[10px] bg-slate-100 text-slate-700">
                            {r.fromUser.name ? r.fromUser.name.charAt(0) : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold text-slate-900">
                          {r.fromUser.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${
                              star <= r.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic">
                      &quot;{r.comment}&quot;
                    </p>
                    <span className="text-[10px] text-slate-400 block text-right">
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
