import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/calendar/[unitId]/block
 * Body: { dates: ["2026-02-20", ...], source?: "MANUAL", reason?: "..." }
 * Creates DateBlock entries for the given dates.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ unitId: string }> }
) {
  const { unitId } = await ctx.params;
  const body = await req.json();
  const dates: string[] = body.dates ?? [];
  const source: string = body.source ?? "MANUAL";
  const reason: string | null = body.reason ?? null;

  if (!dates.length) {
    return NextResponse.json({ error: "dates array required" }, { status: 400 });
  }

  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  let created = 0;
  for (const d of dates) {
    const dateUtc = new Date(d + "T00:00:00Z");
    try {
      await (prisma.dateBlock as any).upsert({
        where: { unit_date_block: { unitId, date: dateUtc } },
        create: { unitId, date: dateUtc, source, reason },
        update: { source, reason },
      });
      created++;
    } catch (e) {
      // skip duplicates
      console.error("[block] error for date", d, e);
    }
  }

  return NextResponse.json({ ok: true, created });
}

/**
 * DELETE /api/calendar/[unitId]/block
 * Body: { dates: ["2026-02-20", ...] }
 * Removes DateBlock entries for the given dates.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ unitId: string }> }
) {
  const { unitId } = await ctx.params;
  const body = await req.json();
  const dates: string[] = body.dates ?? [];

  if (!dates.length) {
    return NextResponse.json({ error: "dates array required" }, { status: 400 });
  }

  const dateUtcList = dates.map((d) => new Date(d + "T00:00:00Z"));

  const result = await (prisma.dateBlock as any).deleteMany({
    where: {
      unitId,
      date: { in: dateUtcList },
    },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
