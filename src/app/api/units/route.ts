import { prisma } from "@/lib/prisma";

export async function GET() {
  const units = await prisma.unit.findMany({
    include: {
      feeds: true,
      channelListings: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Gather all publicUrls to batch-fetch preview cache
  const publicUrls = units
    .flatMap((u) => u.channelListings.map((cl) => cl.publicUrl))
    .filter((url): url is string => !!url);

  const previewCaches =
    publicUrls.length > 0
      ? await prisma.publicPreviewCache.findMany({
        where: { url: { in: publicUrls } },
      })
      : [];

  const cacheMap = new Map(previewCaches.map((c) => [c.url, c]));

  const safe = units.map((u) => {
    // Find the first channel listing with a publicUrl that has a cached preview
    const listing = u.channelListings.find((cl) => cl.publicUrl);
    const cached = listing?.publicUrl ? cacheMap.get(listing.publicUrl) : null;

    return {
      id: u.id,
      name: u.name,
      code: u.code,
      isActive: u.isActive,
      currency: u.currency,
      defaultRate: u.defaultRate?.toString() ?? null,
      ogImage: cached?.ogImage ?? null,
      ogTitle: cached?.ogTitle ?? null,
      listings: u.channelListings.map(cl => ({
        id: cl.id,
        channel: cl.channel,
        url: cl.publicUrl,
        preview: cl.publicUrl ? cacheMap.get(cl.publicUrl) : null
      })),
      feeds: u.feeds.map((f) => ({
        id: f.id,
        channel: f.channel,
        type: f.type,
        name: f.name,
        url: f.url,
        icsText: f.icsText,
        lastSyncAt: f.lastSyncAt ? f.lastSyncAt.toISOString() : null,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  });

  return Response.json({ units: safe });
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const code = String(body.code ?? "").trim();

  if (!name) return new Response("Name required", { status: 400 });

  await prisma.unit.create({
    data: { name, code: code || null },
  });

  return Response.json({ ok: true });
}
