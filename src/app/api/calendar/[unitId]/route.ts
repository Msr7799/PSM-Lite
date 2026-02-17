import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/calendar/[unitId]?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns bookings + manual date blocks for a unit in the given range.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ unitId: string }> }
) {
  const { unitId } = await ctx.params;
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const from = new Date(fromStr + "T00:00:00Z");
  const to = new Date(toStr + "T23:59:59Z");

  const [bookings, dateBlocks, feeds] = await Promise.all([
    prisma.booking.findMany({
      where: {
        unitId,
        isCancelled: false,
        startDate: { lte: to },
        endDate: { gte: from },
      },
      select: {
        id: true,
        channel: true,
        summary: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "asc" },
    }),
    (prisma as any).dateBlock.findMany({
      where: {
        unitId,
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        date: true,
        source: true,
        reason: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.icalFeed.findMany({
      where: { unitId },
      select: {
        id: true,
        channel: true,
        type: true,
        name: true,
        url: true,
        lastSyncAt: true,
        lastError: true,
      },
    }),
  ]);

  return NextResponse.json({ bookings, dateBlocks, feeds });
}
