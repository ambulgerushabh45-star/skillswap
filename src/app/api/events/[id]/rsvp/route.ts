import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if attendee record exists
    const existing = await prisma.eventAttendee.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: user.id,
        },
      },
    });

    if (existing && existing.status === "GOING") {
      // Toggle to CANCELLED
      await prisma.eventAttendee.update({
        where: { id: existing.id },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ message: "RSVP cancelled", isGoing: false });
    } else if (existing) {
      // Toggle back to GOING
      await prisma.eventAttendee.update({
        where: { id: existing.id },
        data: { status: "GOING" },
      });
      return NextResponse.json({ message: "RSVP confirmed!", isGoing: true });
    } else {
      // Create new GOING record
      await prisma.eventAttendee.create({
        data: {
          eventId,
          userId: user.id,
          status: "GOING",
        },
      });
      return NextResponse.json({ message: "RSVP confirmed!", isGoing: true });
    }
  } catch (error) {
    console.error("Error toggling RSVP:", error);
    return NextResponse.json({ error: "Failed to update RSVP" }, { status: 500 });
  }
}
