import { prisma } from "@/lib/prisma";
import { Channel } from "@prisma/client";
import { computeRatePreview, toCsv } from "@/lib/rates";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const unitId = url.searchParams.get("unitId") ?? "";
  const channel = (url.searchParams.get("channel") ?? "") as any;
  const days = Number(url.searchParams.get("days") ?? "60");

  if (!unitId) return new Response("unitId required", { status: 400 });

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return new Response("Unit not found", { status: 404 });

  const rules = await prisma.rateRule.findMany({ where: { unitId } });

  const normalized = rules.map((r) => ({
    id: r.id,
    unitId: r.unitId,
    channel: r.channel,
    name: r.name,
    startDate: r.startDate,
    endDate: r.endDate,
    baseRate: r.baseRate,
    weekendRate: r.weekendRate,
    minNights: r.minNights,
    maxNights: r.maxNights,
    stopSell: r.stopSell,
    daysOfWeek: (r.daysOfWeek as any) ?? null,
    priority: r.priority,
    updatedAt: r.updatedAt,
  }));

  const ch = channel && (Channel as any)[channel] ? ((Channel as any)[channel] as any) : null;

  const preview = computeRatePreview({
    start: new Date(),
    days: Number.isFinite(days) ? Math.min(Math.max(days, 7), 366) : 60,
    channel: ch,
    rules: normalized as any,
    fallbackRate: unit.defaultRate,
  });

  const csv = toCsv(preview, unit.currency);

  return Response.json({
    unit: { id: unit.id, name: unit.name, currency: unit.currency, defaultRate: unit.defaultRate?.toString() ?? null },
    preview: preview.map((p) => ({
      date: p.date.toISOString().slice(0, 10),
      status: p.status,
      rate: p.rate,
      minNights: p.minNights,
      maxNights: p.maxNights,
      rule: p.appliedRuleName,
    })),
    csv,
  });
}
