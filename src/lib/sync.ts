import { prisma } from "@/lib/prisma";
import { fetchIcsFromUrl, parseIcsText } from "@/lib/ical";
import { FeedType } from "@prisma/client";

import { getOrFetchPublicPreview } from "./publicPreview";

const MAX_CONCURRENCY = 3;
const SYNC_TIMEOUT_MS = 50_000; // 50s budget (safe under 60s Vercel limit)

/**
 * Process an array in parallel with limited concurrency.
 */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

export async function syncAllUnits(targetUnitId?: string) {
  const startTime = Date.now();
  const units = await prisma.unit.findMany({
    where: {
      isActive: true,
      ...(targetUnitId ? { id: targetUnitId } : {}),
    },
    include: {
      feeds: true,
      channelListings: true // Include channel listings to access publicUrl
    },
  });

  // Flatten all feeds
  const allFeeds = units.flatMap((unit) =>
    unit.feeds.map((feed) => ({ unit, feed }))
  );

  // Collect all public URLs to sync previews
  const allPublicUrls = units.flatMap(u =>
    u.channelListings
      .filter(cl => cl.publicUrl)
      .map(cl => ({ unitId: u.id, url: cl.publicUrl! }))
  );


  const now = new Date();
  let synced = 0;
  let errors = 0;

  await mapLimited(allFeeds, MAX_CONCURRENCY, async ({ unit, feed }) => {
    // Time budget check
    if (Date.now() - startTime > SYNC_TIMEOUT_MS) {
      return;
    }

    try {
      let icsText = "";
      let newEtag: string | null = null;
      let newLastModified: string | null = null;

      if (feed.type === FeedType.URL) {
        if (!feed.url) return;

        // Fetch with conditional headers for efficiency
        const headers: Record<string, string> = {};
        if (feed.lastEtag) {
          headers["If-None-Match"] = feed.lastEtag;
        }
        if (feed.lastModified) {
          headers["If-Modified-Since"] = feed.lastModified;
        }

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);

        try {
          // Only use conditional for HTTP URLs
          if (/^https?:\/\//i.test(feed.url)) {
            const res = await fetch(feed.url, {
              cache: "no-store",
              signal: ctrl.signal,
              headers,
            });

            if (res.status === 304) {
              // Not modified — skip parsing
              await prisma.icalFeed.update({
                where: { id: feed.id },
                data: { lastSyncAt: now, lastError: null },
              });
              synced++;
              return;
            }

            if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
            icsText = await res.text();
            newEtag = res.headers.get("etag") ?? null;
            newLastModified = res.headers.get("last-modified") ?? null;
          } else {
            icsText = await fetchIcsFromUrl(feed.url);
          }
        } finally {
          clearTimeout(t);
        }
      } else {
        if (!feed.icsText) return;
        icsText = feed.icsText;
      }

      const events = parseIcsText(icsText);
      const eventUids = new Set(events.map((ev) => ev.uid));

      // Upsert all events
      for (const ev of events) {
        await prisma.booking.upsert({
          where: {
            unit_channel_uid: {
              unitId: unit.id,
              channel: feed.channel,
              externalUid: ev.uid,
            },
          },
          update: {
            summary: ev.summary,
            startDate: ev.start,
            endDate: ev.end,
            lastSeenAt: now,
            isCancelled: false,
          },
          create: {
            unitId: unit.id,
            channel: feed.channel,
            externalUid: ev.uid,
            summary: ev.summary,
            startDate: ev.start,
            endDate: ev.end,
            lastSeenAt: now,
          },
        });
      }

      // Handle removals: mark events not seen in this sync as cancelled
      // Only for events that were previously active and belong to this feed's channel
      if (eventUids.size > 0) {
        const existingBookings = await prisma.booking.findMany({
          where: {
            unitId: unit.id,
            channel: feed.channel,
            isCancelled: false,
            // Only future events
            endDate: { gte: now },
          },
          select: { id: true, externalUid: true },
        });

        const toCancel = existingBookings.filter(
          (b) => !eventUids.has(b.externalUid)
        );

        if (toCancel.length > 0) {
          await prisma.booking.updateMany({
            where: { id: { in: toCancel.map((b) => b.id) } },
            data: { isCancelled: true },
          });
        }
      }

      await prisma.icalFeed.update({
        where: { id: feed.id },
        data: {
          lastSyncAt: now,
          lastEtag: newEtag ?? feed.lastEtag,
          lastModified: newLastModified ?? feed.lastModified,
          lastError: null,
        },
      });

      synced++;
    } catch (e: unknown) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[sync] feed error", {
        feedId: feed.id,
        err: msg,
      });

      // Store error on feed
      try {
        await prisma.icalFeed.update({
          where: { id: feed.id },
          data: { lastError: msg.slice(0, 500) },
        });
      } catch {
        // ignore
      }
    }
  });

  // Also sync public previews for channel listings
  await mapLimited(allPublicUrls, MAX_CONCURRENCY, async ({ url }) => {
    try {
      await getOrFetchPublicPreview(url, { force: true });
    } catch (e) {
      console.error("[sync] public preview error", { url, err: String(e) });
      // Don't count as sync error for now since it's secondary
    }
  });

  return {
    ok: true,
    synced,
    errors,
    elapsed: Date.now() - startTime,
  };
}
