import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const dec = (v: any) => new Prisma.Decimal(String(v));

const RuleIn = z.object({
  unitId: z.string().min(1),
  channel: z.enum(["BOOKING","AIRBNB","AGODA","MANUAL","OTHER"]).optional().nullable(),
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  baseRate: z.union([z.string(), z.number()]),
  weekendRate: z.union([z.string(), z.number()]).optional().nullable(),
  minNights: z.number().int().min(1).optional(),
  maxNights: z.number().int().min(1).optional().nullable(),
  stopSell: z.boolean().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  priority: z.number().int().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const unitId = url.searchParams.get("unitId") ?? "";
  if (!unitId) return new Response("unitId required", { status: 400 });

  const rules = await prisma.rateRule.findMany({
    where: { unitId },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  return Response.json({
    rules: rules.map((r) => ({
      id: r.id,
      unitId: r.unitId,
      channel: r.channel,
      name: r.name,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      baseRate: r.baseRate.toString(),
      weekendRate: r.weekendRate?.toString() ?? null,
      minNights: r.minNights,
      maxNights: r.maxNights,
      stopSell: r.stopSell,
      daysOfWeek: (r.daysOfWeek as any) ?? null,
      priority: r.priority,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = RuleIn.safeParse(json);
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });

  const s = new Date(parsed.data.startDate);
  const e = new Date(parsed.data.endDate);
  if (Number.isNaN(s.valueOf()) || Number.isNaN(e.valueOf())) return new Response("Invalid dates", { status: 400 });

  await prisma.rateRule.create({
    data: {
      unitId: parsed.data.unitId,
      channel: parsed.data.channel ? (parsed.data.channel as any) : null,
      name: parsed.data.name,
      startDate: s,
      endDate: e,
      baseRate: dec(parsed.data.baseRate),
      weekendRate: parsed.data.weekendRate ? dec(parsed.data.weekendRate) : null,
      minNights: parsed.data.minNights ?? 1,
      maxNights: parsed.data.maxNights ?? null,
      stopSell: parsed.data.stopSell ?? false,
      daysOfWeek: parsed.data.daysOfWeek ?? undefined,
      priority: parsed.data.priority ?? 0,
    },
  });

  return Response.json({ ok: true });
}
