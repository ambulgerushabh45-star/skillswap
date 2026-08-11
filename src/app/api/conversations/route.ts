import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch matches for current user
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ userAId: currentUser.id }, { userBId: currentUser.id }],
      },
      include: {
        userA: { select: { id: true, name: true, email: true, avatarUrl: true, location: true } },
        userB: { select: { id: true, name: true, email: true, avatarUrl: true, location: true } },
        matchedSkill: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const conversations = matches.map((m) => {
      const isUserA = m.userAId === currentUser.id;
      const peer = isUserA ? m.userB : m.userA;
      const lastMessage = m.messages.length > 0 ? m.messages[0] : null;

      return {
        matchId: m.id,
        peerId: peer.id,
        peerName: peer.name,
        peerAvatar: peer.avatarUrl || "",
        peerLocation: peer.location || "Nearby",
        matchedSkillName: m.matchedSkill.name,
        status: m.status,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt.toISOString(),
              senderId: lastMessage.senderId,
            }
          : null,
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
