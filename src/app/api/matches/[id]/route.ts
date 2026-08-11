import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await req.json();

    if (!["ACCEPTED", "DECLINED", "PENDING"].includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ message: `Match status updated to ${status}`, match: updatedMatch });
  } catch (error) {
    console.error("Error updating match status:", error);
    return NextResponse.json({ error: "Failed to update match status" }, { status: 500 });
  }
}
