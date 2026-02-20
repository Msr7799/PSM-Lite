import { fetchIcsFromUrl, parseIcsText, ParsedEvent } from "./ical";

export type HolidayEvent = {
  id: string;
  title: string;
  country: string;
  startDate: string;
  endDate: string;
};

type HolidayFeed = {
  id: string;
  country: string;
  name: string;
  url: string;
};

const HOLIDAY_FEEDS: HolidayFeed[] = [
  {
    id: "sa-holidays",
    country: "SA",
    name: "Saudi Arabia Public Holidays",
    url: "https://calendar.google.com/calendar/ical/en.saudi%23holiday%40group.v.calendar.google.com/public/basic.ics",
  },
  {
    id: "bh-holidays",
    country: "BH",
    name: "Bahrain Public Holidays",
    url: "https://calendar.google.com/calendar/ical/en.bh%23holiday%40group.v.calendar.google.com/public/basic.ics",
  },
];

const FEED_CACHE = new Map<string, { expiresAt: number; events: ParsedEvent[] }>();
const SIX_HOURS = 6 * 60 * 60 * 1000;

async function loadFeed(feed: HolidayFeed): Promise<ParsedEvent[]> {
  const cached = FEED_CACHE.get(feed.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.events;
  }

  const ics = await fetchIcsFromUrl(feed.url);
  const events = parseIcsText(ics);
  FEED_CACHE.set(feed.id, { events, expiresAt: Date.now() + SIX_HOURS });
  return events;
}

function overlapsRange(ev: ParsedEvent, from: Date, to: Date) {
  return ev.end > from && ev.start < to;
}

export async function getHolidayEvents(from: Date, to: Date): Promise<HolidayEvent[]> {
  const results: HolidayEvent[] = [];

  for (const feed of HOLIDAY_FEEDS) {
    try {
      const events = await loadFeed(feed);
      for (const ev of events) {
        if (!overlapsRange(ev, from, to)) continue;
        results.push({
          id: `${feed.id}:${ev.uid}`,
          title: ev.summary || feed.name,
          country: feed.country,
          startDate: ev.start.toISOString(),
          endDate: ev.end.toISOString(),
        });
      }
    } catch (err) {
      console.error("holiday feed failed", feed.id, err);
    }
  }

  return results;
}

export const holidayFeedMetadata = HOLIDAY_FEEDS.map(({ id, name, country }) => ({ id, name, country }));
