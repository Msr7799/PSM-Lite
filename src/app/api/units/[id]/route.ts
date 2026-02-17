import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const Patch = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  currency: z.string().min(1).optional(),
  defaultRate: z.union([z.string(), z.number()]).optional().nullable(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return new Response("Missing id", { status: 400 });

  const json = await req.json();
  const parsed = Patch.safeParse(json);
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });

  const data: any = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.code !== undefined) data.code = parsed.data.code ? String(parsed.data.code).trim() : null;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.currency !== undefined) data.currency = String(parsed.data.currency).trim();
  if (parsed.data.defaultRate !== undefined) {
    data.defaultRate = parsed.data.defaultRate === null || parsed.data.defaultRate === ""
      ? null
      : new Prisma.Decimal(String(parsed.data.defaultRate));
  }

  const u = await prisma.unit.update({ where: { id }, data });

  return Response.json({
    unit: {
      id: u.id,
      name: u.name,
      code: u.code,
      isActive: u.isActive,
      currency: u.currency,
      defaultRate: u.defaultRate?.toString() ?? null,
    },
  });
}


export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return new Response("Missing id", { status: 400 });

  await prisma.unit.delete({ where: { id } });
  return Response.json({ ok: true });
}
