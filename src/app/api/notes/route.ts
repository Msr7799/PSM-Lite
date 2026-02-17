import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, verifyToken } from "@/lib/auth";

// GET /api/notes - List all notes (with optional filters)
export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const session = (token && await verifyToken(token)) || await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");
  const isResolved = searchParams.get("isResolved");

  const where: any = {};
  if (unitId) where.unitId = unitId;
  if (isResolved !== null && isResolved !== undefined) {
    where.isResolved = isResolved === "true";
  }

  const notes = await prisma.note.findMany({
    where,
    include: {
      unit: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { priority: "desc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json(notes);
}

// POST /api/notes - Create a new note
export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const session = (token && await verifyToken(token)) || await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, content, priority, unitId, attachments } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const note = await prisma.note.create({
      data: {
        title,
        content,
        priority: priority || "NORMAL",
        unitId: unitId || null,
        authorEmail: session.email,
        attachments: attachments || null,
      },
      include: {
        unit: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
