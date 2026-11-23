// client/src/pages/ReviewsPage.jsx
// Peer rating and review submission page with star rating and review history

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Star,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Users,
} from 'lucide-react';

export default function ReviewsPage() {
  const [searchParams] = useSearchParams();

  const toUserId = searchParams.get('toUserId') || searchParams.get('peerId');
  const paramName = searchParams.get('name');

  const [peerName, setPeerName] = useState(paramName || 'Peer');
  const [peerAvatar, setPeerAvatar] = useState('');

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(5.0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [pagination, setPagination] = useState(null);

  const [loading, setLoading] = useState(Boolean(toUserId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Load reviews history and peer details
  const loadReviews = useCallback(
    async (pageToLoad = 1, append = false) => {
      if (!toUserId) return;
      if (!append) setLoading(true);
      setError(null);

      try {
        const [reviewsData, userData] = await Promise.all([
          apiFetch(`/api/reviews?toUserId=${toUserId}&page=${pageToLoad}&limit=50`),
          pageToLoad === 1 ? apiFetch(`/api/users/${toUserId}`).catch(() => null) : null,
        ]);

        if (reviewsData) {
          setReviews((prev) =>
            append ? [...prev, ...(reviewsData.reviews || [])] : reviewsData.reviews || []
          );
          setAvgRating(reviewsData.avgRating ?? 5.0);
          setTotalReviews(reviewsData.totalReviews ?? 0);
          setPagination(reviewsData.pagination || null);
        }

        if (userData?.user) {
          if (userData.user.name) setPeerName(userData.user.name);
          if (userData.user.avatarUrl) setPeerAvatar(userData.user.avatarUrl);
        }

        if (userData?.viewer?.hasReviewed) {
          setHasReviewed(true);
        }
      } catch (err) {
        console.error('Error loading reviews:', err);
        setError(err.message || 'Failed to load reviews');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [toUserId]
  );

  useEffect(() => {
    if (toUserId) {
      void Promise.resolve().then(() => loadReviews(1, false));
    }
  }, [toUserId, loadReviews]);

  // Load next page of reviews
  const handleLoadMore = async () => {
    if (!pagination?.hasNextPage || loadingMore) return;
    setLoadingMore(true);
    const nextPage = (pagination.page || 1) + 1;
    await loadReviews(nextPage, true);
  };

  // Submit review form
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    const trimmedComment = comment.trim();
    if (!toUserId || !trimmedComment || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          toUserId,
          rating,
          comment: trimmedComment,
        }),
      });

      setSuccess('Review submitted! Thank you for rating this skill session.');
      setHasReviewed(true);
      setComment('');
      // Refresh review list to show the new review
      await loadReviews(1, false);
    } catch (err) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Failed to submit review');
      if (err.status === 409) {
        setHasReviewed(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // If no peer is specified, show friendly prompt card
  if (!toUserId) {
    return (
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col flex-1">
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>

        <Card className="border-slate-200 shadow-sm text-center p-8 bg-white">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-2">
              <Star className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl text-slate-900">Select a Peer to Review</CardTitle>
            <CardDescription className="text-slate-600 max-w-md mx-auto text-sm mt-1">
              Reviews are submitted after completing a skill swap session with a peer. Visit your
              dashboard or messages to choose a peer you have connected with.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-3 pt-2">
            <Link to="/dashboard">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs">
                <Users className="h-4 w-4" />
                Find Peers on Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
        Loading review page...
      </div>
    );
  }

  return (
    <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col flex-1">
      {/* Top Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to={`/profile/${toUserId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {peerName}&apos;s Profile
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Review Form (7 cols) */}
        <div className="md:col-span-7 space-y-6">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <Avatar className="h-10 w-10 border border-slate-200">
                  <AvatarImage src={peerAvatar} alt={peerName} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
                    {peerName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg text-slate-900">
                    Review {peerName}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Share feedback on your skill exchange session.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            {hasReviewed ? (
              <CardContent className="space-y-4">
                {success && (
                  <div className="p-3 rounded-md bg-green-50 border border-green-200 flex items-center gap-2 text-xs text-green-700">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>{success}</span>
                  </div>
                )}
                {error && (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>You have already reviewed this person.</span>
                </div>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmitReview}>
                <CardContent className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="p-3 rounded-md bg-green-50 border border-green-200 flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      <span>{success}</span>
                    </div>
                  )}

                  {/* Interactive Star Rating Selector */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">
                      Session Rating (1 to 5 Stars)
                    </label>
                    <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 transition-transform hover:scale-110 focus:outline-none"
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={`h-7 w-7 ${
                              star <= (hoverRating || rating)
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-2 font-bold text-sm text-slate-800">
                        {rating} / 5 Stars
                      </span>
                    </div>
                  </div>

                  {/* Written Comment Textarea */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Written Feedback & Comments
                    </label>
                    <Textarea
                      placeholder={`How was your skill swap session with ${peerName}? What did you learn?`}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="h-28 text-xs"
                      required
                    />
                  </div>
                </CardContent>

                <CardFooter className="border-t border-slate-100 flex justify-end py-4">
                  <Button
                    type="submit"
                    disabled={submitting || !comment.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-9 px-4"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Star className="h-4 w-4 fill-white" />
                    )}
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>

        {/* Right Column: Rating Summary & Past Reviews (5 cols) */}
        <div className="md:col-span-5 space-y-4">
          <Card className="border-slate-200 shadow-sm bg-slate-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-900">
                <Link to={`/profile/${toUserId}`} className="hover:underline">
                  {peerName}
                </Link>
                &apos;s Rating Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="text-3xl font-extrabold text-slate-900 flex items-center gap-1">
                  <span>{avgRating}</span>
                  <Star className="h-6 w-6 fill-amber-400 text-amber-500" />
                </div>
                <span className="text-xs text-slate-500">
                  Based on {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-900">Community Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No reviews written yet. Be the first!
                </p>
              ) : (
                <>
                  {reviews.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-slate-200">
                            <AvatarImage
                              src={r.fromUser?.avatarUrl}
                              alt={r.fromUser?.name}
                            />
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px]">
                              {r.fromUser?.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-slate-800">
                            {r.fromUser?.name}
                          </span>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-0.5">
                          ⭐ {r.rating}/5
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 italic">
                        &quot;{r.comment}&quot;
                      </p>
                    </div>
                  ))}

                  {pagination?.hasNextPage && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="w-full text-xs border-slate-300 text-slate-700"
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Loading...
                          </>
                        ) : (
                          'Load more reviews'
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
