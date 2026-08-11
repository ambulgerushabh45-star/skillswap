import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Indian local meetup events
const SAMPLE_EVENTS = [
  {
    title: "React & Next.js Chai & Code Study Session",
    description: "Bring your laptop! We are practicing Next.js App Router, Tailwind CSS, and React hooks over chai & coffee.",
    location: "Third Wave Coffee, Koramangala, Bengaluru",
    lat: 12.9352,
    lng: 77.6245,
    dateTime: new Date(Date.now() + 86400000 * 2), // 2 days from now
  },
  {
    title: "Acoustic Guitar Jam & Music Circle",
    description: "Open acoustic music circle in the park for beginners and intermediate guitar players. Chords & song sharing!",
    location: "Cubbon Park Gazebo, Bengaluru",
    lat: 12.9763,
    lng: 77.5929,
    dateTime: new Date(Date.now() + 86400000 * 4), // 4 days from now
  },
  {
    title: "UI/UX Design & Figma Hands-on Workshop",
    description: "Interactive session on wireframing, color theory, and prototyping responsive mobile interfaces in Figma.",
    location: "Workafella, HSR Layout, Bengaluru",
    lat: 12.9116,
    lng: 77.6389,
    dateTime: new Date(Date.now() + 86400000 * 7), // 7 days from now
  },
];

async function ensureSampleEventsExist(hostId: string) {
  const count = await prisma.event.count();
  if (count === 0 && hostId) {
    for (const e of SAMPLE_EVENTS) {
      const created = await prisma.event.create({
        data: {
          hostId,
          title: e.title,
          description: e.description,
          location: e.location,
          lat: e.lat,
          lng: e.lng,
          dateTime: e.dateTime,
        },
      });

      // Add host as attendee
      await prisma.eventAttendee.create({
        data: {
          eventId: created.id,
          userId: hostId,
          status: "GOING",
        },
      });
    }
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    let currentUserId: string | null = null;
    if (session?.user?.email) {
      const u = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      if (u) currentUserId = u.id;
    }

    if (currentUserId) {
      await ensureSampleEventsExist(currentUserId);
    }

    const events = await prisma.event.findMany({
      orderBy: { dateTime: "asc" },
      include: {
        host: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        attendees: {
          select: { userId: true, status: true },
        },
      },
    });

    const formattedEvents = events.map((e) => {
      const isGoing = currentUserId
        ? e.attendees.some((a) => a.userId === currentUserId && a.status === "GOING")
        : false;
      const isHost = currentUserId ? e.hostId === currentUserId : false;

      return {
        id: e.id,
        hostId: e.hostId,
        hostName: e.host.name,
        hostAvatar: e.host.avatarUrl || "",
        title: e.title,
        description: e.description,
        location: e.location,
        lat: e.lat || 12.9716,
        lng: e.lng || 77.5946,
        dateTime: e.dateTime.toISOString(),
        attendeeCount: e.attendees.filter((a) => a.status === "GOING").length,
        isGoing,
        isHost,
      };
    });

    return NextResponse.json({ events: formattedEvents });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, location, lat, lng, dateTime } = await req.json();

    if (!title || !description || !location || !dateTime) {
      return NextResponse.json({ error: "Title, description, location, and date are required" }, { status: 400 });
    }

    const host = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!host) {
      return NextResponse.json({ error: "Host user not found" }, { status: 404 });
    }

    const newEvent = await prisma.event.create({
      data: {
        hostId: host.id,
        title,
        description,
        location,
        lat: parseFloat(lat) || 12.9716,
        lng: parseFloat(lng) || 77.5946,
        dateTime: new Date(dateTime),
      },
    });

    await prisma.eventAttendee.create({
      data: {
        eventId: newEvent.id,
        userId: host.id,
        status: "GOING",
      },
    });

    return NextResponse.json({ message: "Event created successfully!", event: newEvent }, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
