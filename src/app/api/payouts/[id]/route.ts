import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return new Response("Missing id", { status: 400 });

  await prisma.payout.delete({ where: { id } });
  return Response.json({ ok: true });
}
