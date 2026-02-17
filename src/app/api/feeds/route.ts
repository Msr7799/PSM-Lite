import { prisma } from "@/lib/prisma";
import { Channel, FeedType } from "@prisma/client";

export async function POST(req: Request) {
  const body = await req.json();

  const unitId = String(body.unitId ?? "");
  const channel = (String(body.channel ?? "OTHER").toUpperCase() as Channel) ?? "OTHER";
  const type = (String(body.type ?? "URL").toUpperCase() as FeedType) ?? "URL";
  const name = body.name ? String(body.name) : null;

  if (!unitId) return new Response("unitId required", { status: 400 });

  if (type === "URL") {
    const url = String(body.url ?? "").trim();
    if (!url) return new Response("url required for URL feed", { status: 400 });

    const existing = await prisma.icalFeed.findFirst({
      where: { unitId, channel, type: "URL", url },
      select: { id: true },
    });
    if (existing) return new Response("Feed already exists (same URL)", { status: 409 });

    await prisma.icalFeed.create({
      data: { unitId, channel, type, url, name },
    });
  } else {
    const icsText = String(body.icsText ?? "");
    if (!icsText) return new Response("icsText required for INLINE feed", { status: 400 });

    if (name) {
      const existing = await prisma.icalFeed.findFirst({
        where: { unitId, channel, type: "INLINE", name },
        select: { id: true },
      });
      if (existing) return new Response("Feed already exists (same file name)", { status: 409 });
    }

    await prisma.icalFeed.create({
      data: { unitId, channel, type, icsText, name },
    });
  }

  return Response.json({ ok: true });
}
