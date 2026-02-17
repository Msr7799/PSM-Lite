import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const unitId = url.searchParams.get("unitId") ?? "";
  const channel = url.searchParams.get("channel") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  const where: any = {
    paymentStatus: { in: ["UNPAID", "PARTIAL"] },
  };
  if (unitId) where.unitId = unitId;
  if (channel) where.channel = channel;

  if (from && to) {
    const f = new Date(from);
    const t = new Date(to);
    if (!Number.isNaN(f.valueOf()) && !Number.isNaN(t.valueOf())) {
      where.startDate = { lt: t };
      where.endDate = { gt: f };
    }
  }

  const items = await prisma.booking.findMany({
    where,
    include: { unit: { select: { name: true } } },
    orderBy: [{ startDate: "desc" }],
    take: 200,
  });

  return Response.json({
    bookings: items.map((b) => ({
      id: b.id,
      unitId: b.unitId,
      unitName: b.unit.name,
      channel: b.channel,
      startDate: b.startDate.toISOString().slice(0, 10),
      endDate: b.endDate.toISOString().slice(0, 10),
      netAmount: b.netAmount?.toString() ?? null,
      paymentStatus: b.paymentStatus,
    })),
  });
}
