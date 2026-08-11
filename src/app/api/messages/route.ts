import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const messages = await prisma.message.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      matchId: m.matchId,
      senderId: m.senderId,
      senderName: m.sender.name,
      senderAvatar: m.sender.avatarUrl || "",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { matchId, content } = await req.json();

    if (!matchId || !content || !content.trim()) {
      return NextResponse.json({ error: "matchId and content are required" }, { status: 400 });
    }

    const sender = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!sender) {
      return NextResponse.json({ error: "Sender user not found" }, { status: 404 });
    }

    // Save message to PostgreSQL
    const newMessage = await prisma.message.create({
      data: {
        matchId,
        senderId: sender.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    const formattedMessage = {
      id: newMessage.id,
      matchId: newMessage.matchId,
      senderId: newMessage.senderId,
      senderName: newMessage.sender.name,
      senderAvatar: newMessage.sender.avatarUrl || "",
      content: newMessage.content,
      createdAt: newMessage.createdAt.toISOString(),
    };

    return NextResponse.json({ message: formattedMessage }, { status: 201 });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
