import { prisma } from "@/lib/prisma";
import UnitsClient from "./units-client";
import { getTranslations } from 'next-intl/server';

export default async function UnitsPage() {
  const t = await getTranslations();

  const units = await prisma.unit.findMany({
    include: {
      feeds: true,
      channelListings: true,
      content: { select: { images: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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

  const safeUnits = (units as any[]).map((u) => {
    const listing = u.channelListings?.find((cl: any) => cl.publicUrl);
    const cached = listing?.publicUrl ? cacheMap.get(listing.publicUrl) : null;
    const contentImages = Array.isArray(u.content?.images) ? u.content.images : [];

    return {
      id: u.id,
      name: u.name,
      code: u.code,
      isActive: u.isActive,
      currency: u.currency,
      defaultRate: u.defaultRate?.toString() ?? null,
      ogImage: contentImages[0] ?? (cached as any)?.ogImage ?? null,
      ogTitle: (cached as any)?.ogTitle ?? null,
      bookingPublicUrl: listing?.publicUrl ?? null,
      listings: u.channelListings.map((cl: any) => ({
        id: cl.id,
        channel: cl.channel,
        url: cl.publicUrl ?? '',
      })),
      feeds: u.feeds.map((f: any) => ({
        id: f.id,
        channel: f.channel,
        type: f.type,
        name: f.name,
        url: f.url,
        lastSyncAt: f.lastSyncAt ? f.lastSyncAt.toISOString() : null,
      })),
    };
  });

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">{t('units_page_title')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('units_desc')}
        </p>
      </div>

      <UnitsClient initialUnits={safeUnits} />
    </main>
  );
}
