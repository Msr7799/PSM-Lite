import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const decOrUndef = (v: any) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return new Prisma.Decimal(String(v));
};

const Patch = z.object({
  channel: z.enum(["BOOKING","AIRBNB","AGODA","MANUAL","OTHER"]).optional().nullable(),
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  baseRate: z.union([z.string(), z.number()]).optional(),
  weekendRate: z.union([z.string(), z.number()]).optional().nullable(),
  minNights: z.number().int().min(1).optional(),
  maxNights: z.number().int().min(1).optional().nullable(),
  stopSell: z.boolean().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  priority: z.number().int().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return new Response("Missing id", { status: 400 });

  const json = await req.json();
  const parsed = Patch.safeParse(json);
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });

  const data: any = {};
  if (parsed.data.channel !== undefined) data.channel = parsed.data.channel ? parsed.data.channel : null;
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.startDate !== undefined) data.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate !== undefined) data.endDate = new Date(parsed.data.endDate);
  if (parsed.data.baseRate !== undefined) data.baseRate = new Prisma.Decimal(String(parsed.data.baseRate));
  if (parsed.data.weekendRate !== undefined) data.weekendRate = decOrUndef(parsed.data.weekendRate);
  if (parsed.data.minNights !== undefined) data.minNights = parsed.data.minNights;
  if (parsed.data.maxNights !== undefined) data.maxNights = parsed.data.maxNights;
  if (parsed.data.stopSell !== undefined) data.stopSell = parsed.data.stopSell;
  if (parsed.data.daysOfWeek !== undefined) data.daysOfWeek = parsed.data.daysOfWeek ?? null;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;

  await prisma.rateRule.update({ where: { id }, data });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return new Response("Missing id", { status: 400 });

  await prisma.rateRule.delete({ where: { id } });
  return Response.json({ ok: true });
}
