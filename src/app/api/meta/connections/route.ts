import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await prisma.metaConnection.findMany({
      where: { isActive: true },
      select: {
        id: true,
        platform: true,
        pageId: true,
        pageName: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        // encryptedToken is intentionally excluded
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: connections });
  } catch (err) {
    console.error("[meta/connections] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
