"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, CheckCircle, AlertCircle, MessageSquare, ArrowLeft } from "lucide-react";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  fromUser: {
    id: string;
    name: string;
    avatarUrl: string;
  };
}

function ReviewFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const toUserId = searchParams.get("toUserId");
  const peerName = searchParams.get("name") || "Peer";

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [avgRating, setAvgRating] = useState(5.0);
  const [totalReviews, setTotalReviews] = useState(0);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch reviews history for the target peer
  const loadReviews = async () => {
    if (!toUserId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?toUserId=${toUserId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setAvgRating(data.avgRating || 5.0);
        setTotalReviews(data.totalReviews || 0);
      }
    } catch (err) {
      console.error("Error loading reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [toUserId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toUserId || !comment.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId,
          rating,
          comment,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit review");
        setSubmitting(false);
        return;
      }

      setSuccess("Review submitted! Thank you for rating this skill session.");
      setComment("");
      await loadReviews();
    } catch (err) {
      setError("An unexpected error occurred while submitting your review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="mb-4 gap-1.5 text-xs text-slate-600 border-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="grid md:grid-cols-12 gap-6">
          {/* Review Submission Form Card (7 cols) */}
          <div className="md:col-span-7">
            <Card className="border-slate-200 shadow-md">
              <form onSubmit={handleSubmitReview}>
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900 flex items-center gap-2">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                    Rate & Review Session with {peerName}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Share feedback to help the SkillSwap community learn about this mentor.
                  </CardDescription>
                </CardHeader>

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
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star
                            className={`h-7 w-7 ${
                              star <= (hoverRating || rating)
                                ? "fill-amber-400 text-amber-500"
                                : "text-slate-300"
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
                    className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
                  >
                    <Star className="h-4 w-4 fill-white" />
                    {submitting ? "Submitting..." : "Submit Review"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          {/* Peer Ratings Summary & Past Reviews (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <Card className="border-slate-200 shadow-sm bg-slate-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-900">{peerName}'s Rating Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-extrabold text-slate-900 flex items-center gap-1">
                    <span>{avgRating}</span>
                    <Star className="h-6 w-6 fill-amber-400 text-amber-500" />
                  </div>
                  <span className="text-xs text-slate-500">Based on {totalReviews} reviews</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-900">Community Reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reviews.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No reviews written yet. Be the first!</p>
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-slate-200">
                            <AvatarImage src={r.fromUser.avatarUrl} alt={r.fromUser.name} />
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px]">
                              {r.fromUser.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-slate-800">{r.fromUser.name}</span>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-0.5">
                          ⭐ {r.rating}/5
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 italic">"{r.comment}"</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading review page...</div>}>
      <ReviewFormContent />
    </Suspense>
  );
}
