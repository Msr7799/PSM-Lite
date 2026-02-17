import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PATCH /api/units/reorder
 * Body: { orderedIds: string[] }
 * Updates sortOrder for each unit based on array index.
 */
export async function PATCH(req: Request) {
  try {
    const { orderedIds } = await req.json();

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });
    }

    // Update each unit's sortOrder in a transaction
    await prisma.$transaction(
      orderedIds.map((id: string, index: number) =>
        prisma.unit.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[reorder] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
