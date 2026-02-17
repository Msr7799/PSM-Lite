import { prisma } from "@/lib/prisma";
import { Channel } from "@prisma/client";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return new Response("Missing id", { status: 400 });

  const url = new URL(req.url);
  const purge = url.searchParams.get("purge") !== "0"; // default true

  const feed = await prisma.icalFeed.findUnique({
    where: { id },
    select: { id: true, unitId: true, channel: true },
  });

  if (!feed) return new Response("Not found", { status: 404 });

  // Purge imported bookings for same unit+channel (keep MANUAL separate)
  if (purge && feed.channel !== Channel.MANUAL) {
    await prisma.booking.deleteMany({
      where: { unitId: feed.unitId, channel: feed.channel },
    });
  }

  await prisma.icalFeed.delete({ where: { id: feed.id } });

  return Response.json({ ok: true, purged: purge });
}
