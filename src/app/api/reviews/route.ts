import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const toUserId = searchParams.get("toUserId");

    if (!toUserId) {
      return NextResponse.json({ error: "toUserId is required" }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: { toUserId },
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? parseFloat((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
        : 5.0;

    const formattedReviews = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      fromUser: {
        id: r.fromUser.id,
        name: r.fromUser.name,
        avatarUrl: r.fromUser.avatarUrl || "",
      },
    }));

    return NextResponse.json({
      avgRating,
      totalReviews,
      reviews: formattedReviews,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { toUserId, rating, comment } = await req.json();

    if (!toUserId || !rating || !comment || !comment.trim()) {
      return NextResponse.json({ error: "toUserId, rating (1-5), and comment are required" }, { status: 400 });
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5 stars" }, { status: 400 });
    }

    const fromUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!fromUser) {
      return NextResponse.json({ error: "Sender user not found" }, { status: 404 });
    }

    if (fromUser.id === toUserId) {
      return NextResponse.json({ error: "You cannot review yourself" }, { status: 400 });
    }

    // Save review to PostgreSQL
    const newReview = await prisma.review.create({
      data: {
        fromUserId: fromUser.id,
        toUserId,
        rating: ratingNum,
        comment: comment.trim(),
      },
      include: {
        fromUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ message: "Review submitted successfully!", review: newReview }, { status: 201 });
  } catch (error) {
    console.error("Error submitting review:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
