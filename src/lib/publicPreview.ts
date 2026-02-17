import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

export type PropertyDetails = {
  description?: string | null;
  houseRules?: string | null;
  checkInInfo?: string | null;
  checkOutInfo?: string | null;
  address?: string | null;
  rating?: string | null;
  propertyType?: string | null;
  guestCapacity?: string | null;
  propertyHighlights?: string | null;
  nearbyPlaces?: string | null;
  damageDeposit?: string | null;
  cancellationPolicy?: string | null;
};

export type PublicPreview = {
  ogTitle: string | null;
  ogDesc: string | null;
  ogImage: string | null;
  images?: string[];
  amenities?: string[];
  details?: PropertyDetails;
  channel?: string;
  fromCache: boolean;
};

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

// Keep this conservative to reduce SSRF risk.
const ALLOWED_DOMAINS = ["booking.com", "airbnb.com", "agoda.com"];

function hostAllowed(hostname: string) {
  const h = hostname.toLowerCase();
  return ALLOWED_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
}

export function isAllowedPublicUrl(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    return hostAllowed(u.hostname);
  } catch {
    return false;
  }
}

export function detectChannel(rawUrl: string): string {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    if (h.includes("booking.com")) return "BOOKING";
    if (h.includes("airbnb.com")) return "AIRBNB";
    if (h.includes("agoda.com")) return "AGODA";
  } catch { /* ignore */ }
  return "OTHER";
}

function pickMeta($: cheerio.CheerioAPI, selector: string): string | null {
  const v = $(selector).attr("content");
  return v ? String(v).trim() : null;
}

function unique(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

// ─── JSON-LD helpers ────────────────────────────────────────────────

function parseAllJsonLd($: cheerio.CheerioAPI): any[] {
  const results: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) results.push(...data);
        else results.push(data);
      }
    } catch { /* skip malformed */ }
  });
  return results;
}

function findJsonLdByType(items: any[], ...types: string[]): any | null {
  for (const item of items) {
    const t = item?.["@type"];
    const tArr = Array.isArray(t) ? t : [t];
    if (tArr.some((x: string) => types.includes(x))) return item;
    // Check @graph
    if (Array.isArray(item?.["@graph"])) {
      for (const g of item["@graph"]) {
        const gt = g?.["@type"];
        const gtArr = Array.isArray(gt) ? gt : [gt];
        if (gtArr.some((x: string) => types.includes(x))) return g;
      }
    }
  }
  return null;
}

// ─── Booking.com specific scraper ───────────────────────────────────

function scrapeBooking($: cheerio.CheerioAPI, jsonLdItems: any[]) {
  const images: string[] = [];
  const amenities: string[] = [];
  const details: PropertyDetails = {};

  // ── Images: multiple selectors + regex fallback for bstatic.com URLs ──
  $("a[data-thumb-url]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) images.push(href);
  });
  $("img[data-high-res]").each((_, el) => {
    const src = $(el).attr("data-high-res");
    if (src) images.push(src);
  });
  $(".bh-photo-grid img, .bh-photo-grid-thumb img, [data-testid='property-gallery-image'] img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && src.startsWith("http")) images.push(src);
  });
  // Gallery carousel / slider images
  $("[data-testid='gallery-image'] img, .hotel-photo-carousel img, .hp-gallery img, .slick-slide img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-lazy") || $(el).attr("data-src");
    if (src && src.includes("bstatic.com")) images.push(src);
  });
  // Regex fallback: extract ALL cf.bstatic.com hotel image URLs from the full HTML
  const htmlStr = $.html();
  const bstaticRegex = /https:\/\/cf\.bstatic\.com\/xdata\/images\/hotel\/[^"'\s)]+/g;
  const bstaticMatches = htmlStr.match(bstaticRegex);
  if (bstaticMatches) {
    for (const m of bstaticMatches) {
      // Upgrade to max1024x768 for high-res
      const hiRes = m.replace(/\/max\d+(?:x\d+)?\//, "/max1024x768/");
      images.push(hiRes);
    }
  }

  // ── Amenities from facility/amenity blocks ──
  $('[data-testid="property-most-popular-facilities-wrapper"] li, .hp_desc_important_facilities li, .facilitiesChecklist li, [data-testid="facility-list-most-popular"] span').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 80) amenities.push(t);
  });
  $(".important_facility, .hp_desc_important_facilities .important_facility").each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 80) amenities.push(t);
  });

  // ── Description ──
  const descBlock = $('[data-testid="property-description"] p, #property_description_content p, .hp_desc_main_content p').map((_, el) => $(el).text().trim()).get().filter(Boolean).join("\n\n");
  if (descBlock) details.description = descBlock;

  // ── House rules: comprehensive extraction ──
  const rulesTexts: string[] = [];
  // Main house rules section
  $('[data-testid="house-rules-section"] li, .house-rules-list li, #hotelPoliciesInc li').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 200) rulesTexts.push(t);
  });
  // Policy cards (smoking, parties, quiet hours, pets, etc.)
  $('[data-testid="house-rules-section"] .bui-list__description, [data-testid="house-rules-section"] .policy-block').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 200) rulesTexts.push(t);
  });
  // Broader: any text inside house rules container divs
  $('[data-testid="HouseRules"] div, [data-testid="HouseRulesSection"] div').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 5 && t.length < 200 && !rulesTexts.includes(t)) rulesTexts.push(t);
  });
  // Regex fallback: extract known rule patterns from the full page text
  const fullText = $("body").text();
  const rulePatterns = [
    /(?:التدخين|Smoking)[:\s]*([^\n.]{5,120})/i,
    /(?:الحفلات|Parties)[:\s]*([^\n.]{5,120})/i,
    /(?:الحيوانات|Pets)[:\s]*([^\n.]{5,120})/i,
    /(?:ساعات الالتزام بالهدوء|Quiet hours)[:\s]*([^\n.]{5,120})/i,
    /(?:أقل عمر|minimum age)[:\s]*([^\n.]{5,80})/i,
    /(?:تأمين ضد الأضرار|damage deposit)[:\s]*([^\n.]{5,150})/i,
  ];
  for (const pat of rulePatterns) {
    const m = fullText.match(pat);
    if (m) {
      const rule = m[0].trim();
      if (!rulesTexts.some((r) => r.includes(rule) || rule.includes(r))) rulesTexts.push(rule);
    }
  }
  if (rulesTexts.length) details.houseRules = unique(rulesTexts).join("\n");

  // ── Check-in / check-out: multiple patterns (EN + AR) ──
  const checkSections = $('[data-testid="check-in-out-section"], .policies_list, [data-testid="HouseRules"], [data-testid="HouseRulesSection"]').text() + " " + fullText;
  // English patterns
  const ciEn = checkSections.match(/check[- ]?in\s*(?:from\s*)?(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*(?:to|[-–])\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i);
  const coEn = checkSections.match(/check[- ]?out\s*(?:from\s*)?(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*(?:to|[-–])\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i);
  // Arabic patterns
  const ciAr = checkSections.match(/تسجيل الوصول[:\s]*([\d:]+\s*(?:ص|م|صباحاً|مساءً)?(?:\s*[-–]\s*[\d:]+\s*(?:ص|م|صباحاً|مساءً)?)?)/);
  const coAr = checkSections.match(/تسجيل المغادرة[:\s]*([\d:]+\s*(?:ص|م|صباحاً|مساءً)?(?:\s*[-–]\s*[\d:]+\s*(?:ص|م|صباحاً|مساءً)?)?)/);
  if (ciEn) details.checkInInfo = `Check-in: ${ciEn[1].trim()}`;
  else if (ciAr) details.checkInInfo = `تسجيل الوصول: ${ciAr[1].trim()}`;
  if (coEn) details.checkOutInfo = `Check-out: ${coEn[1].trim()}`;
  else if (coAr) details.checkOutInfo = `تسجيل المغادرة: ${coAr[1].trim()}`;

  // ── JSON-LD enrichment ──
  const hotel = findJsonLdByType(jsonLdItems, "Hotel", "LodgingBusiness", "VacationRental", "Apartment", "House");
  if (hotel) {
    if (hotel.address) {
      const a = hotel.address;
      details.address = typeof a === "string" ? a : [a.streetAddress, a.addressLocality, a.addressCountry].filter(Boolean).join(", ");
    }
    if (hotel.aggregateRating?.ratingValue) {
      details.rating = `${hotel.aggregateRating.ratingValue}`;
    }
    if (hotel["@type"]) {
      const pt = Array.isArray(hotel["@type"]) ? hotel["@type"][0] : hotel["@type"];
      details.propertyType = pt;
    }
    if (hotel.amenityFeature) {
      const feats = Array.isArray(hotel.amenityFeature) ? hotel.amenityFeature : [hotel.amenityFeature];
      for (const f of feats) {
        const n = f?.name || f?.value;
        if (n && typeof n === "string") amenities.push(n);
      }
    }
    // JSON-LD check-in/out times
    if (!details.checkInInfo && hotel.checkinTime) details.checkInInfo = `Check-in: ${hotel.checkinTime}`;
    if (!details.checkOutInfo && hotel.checkoutTime) details.checkOutInfo = `Check-out: ${hotel.checkoutTime}`;
    // JSON-LD occupancy
    if (hotel.numberOfRooms) details.guestCapacity = `${hotel.numberOfRooms} rooms`;
  }

  // ── Guest capacity from page text ──
  const capacityMatch = fullText.match(/(?:accommodate|sleeps?|can sleep|guests?)[:\s]*(\d+)\s*(?:guests?|people)?/i);
  if (capacityMatch && !details.guestCapacity) details.guestCapacity = `${capacityMatch[1]} guests`;

  // ── Property highlights ──
  const highlights: string[] = [];
  $('[data-testid="property-highlights"] li, .property-highlights li, .hp-desc-highlighted li').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 120) highlights.push(t);
  });
  // Fallback: extract bedroom/bathroom/pool mentions from description
  if (!highlights.length && details.description) {
    const d = details.description;
    const bedroomMatch = d.match(/(\d+)\s*(?:bedrooms?|غرف)/i);
    const bathroomMatch = d.match(/(\d+)\s*(?:bathrooms?|حمام)/i);
    if (bedroomMatch) highlights.push(`${bedroomMatch[1]} bedrooms`);
    if (bathroomMatch) highlights.push(`${bathroomMatch[1]} bathrooms`);
    if (/private\s*(?:beach|pool)|مسبح\s*خاص|شاطئ\s*خاص/i.test(d)) highlights.push("Private pool/beach");
    if (/hot\s*tub|jacuzzi|جاكوزي/i.test(d)) highlights.push("Hot tub");
    if (/free\s*(?:wifi|parking)|واي\s*فاي\s*مجاني|مواقف\s*مجاني/i.test(d)) highlights.push("Free WiFi & parking");
  }
  if (highlights.length) details.propertyHighlights = unique(highlights).join("\n");

  // ── Nearby places / distances ──
  const places: string[] = [];
  $('[data-testid="TextWithIcon"], .hp-poi-content-wrapper li, .surroundings__text').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 120 && /\d/.test(t)) places.push(t);
  });
  // Regex fallback from full text
  const distPatterns = fullText.matchAll(/([A-Za-z\u0600-\u06FF\s]+(?:Airport|Beach|Museum|Fort|Center|Centre|مطار|شاطئ|متحف|قلعة|مركز))\s*[\d.]+\s*(?:mi|km|miles?|كم)/gi);
  for (const dp of distPatterns) {
    const entry = dp[0].trim();
    if (entry.length < 120 && !places.some(p => p.includes(entry))) places.push(entry);
  }
  if (places.length) details.nearbyPlaces = unique(places).join("\n");

  // ── Damage deposit ──
  const depositMatch = fullText.match(/(?:damage\s*deposit|تأمين\s*ضد\s*الأضرار)[:\s]*(?:of\s*)?([A-Z]{2,4}\s*[\d,.]+|[\d,.]+\s*[A-Z]{2,4})/i);
  if (depositMatch) details.damageDeposit = depositMatch[0].trim();

  // ── Cancellation policy ──
  const cancelMatch = fullText.match(/(?:cancellation|إلغاء)[/\s]*(?:prepayment|الدفع\s*المسبق)?[:\s]*([^\n]{10,200})/i);
  if (cancelMatch) details.cancellationPolicy = cancelMatch[1].trim();

  return { images: unique(images), amenities: unique(amenities), details };
}

// ─── Airbnb specific scraper ────────────────────────────────────────

function scrapeAirbnb($: cheerio.CheerioAPI, jsonLdItems: any[]) {
  const images: string[] = [];
  const amenities: string[] = [];
  const details: PropertyDetails = {};

  // Airbnb embeds data in a deferred-state or __NEXT_DATA__ script
  let airbnbData: any = null;
  $("script#data-deferred-state, script#data-state").each((_, el) => {
    try {
      const raw = $(el).html();
      if (raw) airbnbData = JSON.parse(raw);
    } catch { /* skip */ }
  });

  // Try __NEXT_DATA__
  if (!airbnbData) {
    $("script#__NEXT_DATA__").each((_, el) => {
      try {
        const raw = $(el).html();
        if (raw) airbnbData = JSON.parse(raw);
      } catch { /* skip */ }
    });
  }

  // Deep search in airbnb data for listing info
  if (airbnbData) {
    const listingStr = JSON.stringify(airbnbData);

    // Extract images from the data blob
    const imgMatches = listingStr.match(/https:\/\/a0\.muscache\.com\/[^"\\]+/g);
    if (imgMatches) {
      for (const m of imgMatches) {
        // Prefer larger images (skip tiny thumbnails)
        if (m.includes("im/pictures") || m.includes("im/photos")) {
          images.push(m);
        }
      }
    }

    // Try to find amenities in the data
    const amenityRegex = /"title"\s*:\s*"([^"]{2,60})"\s*,\s*"available"\s*:\s*true/g;
    let match;
    while ((match = amenityRegex.exec(listingStr)) !== null) {
      amenities.push(match[1]);
    }

    // Try to find description
    const descRegex = /"description"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    const descMatches: string[] = [];
    while ((match = descRegex.exec(listingStr)) !== null) {
      const val = match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      if (val.length > 50 && val.length < 5000) descMatches.push(val);
    }
    if (descMatches.length) {
      // Pick the longest description
      details.description = descMatches.sort((a, b) => b.length - a.length)[0];
    }

    // Check-in/out
    const checkInMatch = listingStr.match(/"check_in_time"\s*:\s*"([^"]+)"/);
    const checkOutMatch = listingStr.match(/"checkout_time"\s*:\s*"([^"]+)"/);
    if (checkInMatch) details.checkInInfo = `Check-in: ${checkInMatch[1]}`;
    if (checkOutMatch) details.checkOutInfo = `Check-out: ${checkOutMatch[1]}`;

    // House rules
    const rulesMatch = listingStr.match(/"house_rules"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (rulesMatch) {
      details.houseRules = rulesMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  }

  // Fallback: og:image and gallery images
  $("img[data-original], picture source").each((_, el) => {
    const src = $(el).attr("data-original") || $(el).attr("srcset");
    if (src) {
      const firstSrc = src.split(",")[0]?.split(" ")[0]?.trim();
      if (firstSrc?.startsWith("http")) images.push(firstSrc);
    }
  });

  // JSON-LD enrichment
  const listing = findJsonLdByType(jsonLdItems, "SingleFamilyResidence", "Apartment", "House", "LodgingBusiness", "Product");
  if (listing) {
    if (!details.description && listing.description) details.description = listing.description;
    if (listing.address) {
      const a = listing.address;
      details.address = typeof a === "string" ? a : [a.streetAddress, a.addressLocality, a.addressCountry].filter(Boolean).join(", ");
    }
    if (listing.aggregateRating?.ratingValue) {
      details.rating = `${listing.aggregateRating.ratingValue}`;
    }
  }

  return { images: unique(images).slice(0, 30), amenities: unique(amenities), details };
}

// ─── Agoda specific scraper ─────────────────────────────────────────

function scrapeAgoda($: cheerio.CheerioAPI, jsonLdItems: any[]) {
  const images: string[] = [];
  const amenities: string[] = [];
  const details: PropertyDetails = {};

  // Agoda puts data in window.__NEXT_DATA__ or __INITIAL_STATE__
  let agodaData: any = null;
  $("script").each((_, el) => {
    const text = $(el).html() || "";
    // Look for window.defined state objects
    const nextDataMatch = text.match(/window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});?\s*$/m);
    if (nextDataMatch) {
      try { agodaData = JSON.parse(nextDataMatch[1]); } catch { /* skip */ }
    }
  });

  // Try __NEXT_DATA__ script tag
  if (!agodaData) {
    $("script#__NEXT_DATA__").each((_, el) => {
      try {
        const raw = $(el).html();
        if (raw) agodaData = JSON.parse(raw);
      } catch { /* skip */ }
    });
  }

  // Images from gallery
  $(".Carousel img, [data-testid='gallery'] img, .hotel-gallery img, .HotelImage img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && src.startsWith("http")) images.push(src);
  });

  // Amenities
  $(".Facilities li, [data-testid='facilities'] li, .AmenitiesList li, .facility-item").each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 80) amenities.push(t);
  });

  // Description
  const descEl = $('[data-testid="property-description"], .HotelDescription, .PropertyDescription p').map((_, el) => $(el).text().trim()).get().filter(Boolean).join("\n\n");
  if (descEl) details.description = descEl;

  // Agoda data blob extraction
  if (agodaData) {
    const blob = JSON.stringify(agodaData);
    // Images
    const imgMatches = blob.match(/https:\/\/pix\d+\.agoda\.net\/[^"\\]+/g);
    if (imgMatches) {
      for (const m of imgMatches) images.push(m);
    }
  }

  // JSON-LD enrichment
  const hotel = findJsonLdByType(jsonLdItems, "Hotel", "LodgingBusiness", "VacationRental");
  if (hotel) {
    if (!details.description && hotel.description) details.description = hotel.description;
    if (hotel.address) {
      const a = hotel.address;
      details.address = typeof a === "string" ? a : [a.streetAddress, a.addressLocality, a.addressCountry].filter(Boolean).join(", ");
    }
    if (hotel.aggregateRating?.ratingValue) {
      details.rating = `${hotel.aggregateRating.ratingValue}`;
    }
    if (hotel.amenityFeature) {
      const feats = Array.isArray(hotel.amenityFeature) ? hotel.amenityFeature : [hotel.amenityFeature];
      for (const f of feats) {
        const n = f?.name || f?.value;
        if (n && typeof n === "string") amenities.push(n);
      }
    }
  }

  return { images: unique(images), amenities: unique(amenities), details };
}

// ─── Parse raw HTML (for paste-HTML fallback) ──────────────────────

export function parseHtmlToPreview(html: string, channel: string): Omit<PublicPreview, "fromCache"> {
  const $ = cheerio.load(html);

  let ogTitle =
    pickMeta($, 'meta[property="og:title"]') ||
    pickMeta($, 'meta[name="twitter:title"]') ||
    $("title").text().trim() ||
    null;

  let ogDesc =
    pickMeta($, 'meta[property="og:description"]') ||
    pickMeta($, 'meta[name="description"]') ||
    pickMeta($, 'meta[name="twitter:description"]') ||
    null;

  let ogImage =
    pickMeta($, 'meta[property="og:image:secure_url"]') ||
    pickMeta($, 'meta[property="og:image"]') ||
    pickMeta($, 'meta[name="twitter:image"]') ||
    null;

  const jsonLdItems = parseAllJsonLd($);

  if (!ogTitle || !ogDesc || !ogImage) {
    const entity = findJsonLdByType(jsonLdItems, "Hotel", "LodgingBusiness", "VacationRental", "Apartment", "House", "SingleFamilyResidence", "Product");
    if (entity) {
      if (!ogTitle && entity.name) ogTitle = entity.name;
      if (!ogDesc && entity.description) ogDesc = entity.description;
      if (!ogImage && entity.image) {
        ogImage = Array.isArray(entity.image) ? entity.image[0] : (entity.image?.url || entity.image);
      }
    }
  }

  let scraped: { images: string[]; amenities: string[]; details: PropertyDetails };
  const ch = channel.toUpperCase();

  if (ch === "BOOKING") {
    scraped = scrapeBooking($, jsonLdItems);
  } else if (ch === "AIRBNB") {
    scraped = scrapeAirbnb($, jsonLdItems);
  } else if (ch === "AGODA") {
    scraped = scrapeAgoda($, jsonLdItems);
  } else {
    scraped = { images: [], amenities: [], details: {} };
  }

  for (const item of jsonLdItems) {
    const imgs = item?.image;
    if (Array.isArray(imgs)) {
      for (const it of imgs) {
        const s = String(it?.url ?? it ?? "").trim();
        if (s && !scraped.images.includes(s)) scraped.images.push(s);
      }
    } else if (imgs) {
      const s = String(imgs?.url ?? imgs ?? "").trim();
      if (s && !scraped.images.includes(s)) scraped.images.push(s);
    }
  }

  if (scraped.images.length < 5) {
    $("img[srcset]").each((_, el) => {
      const srcset = $(el).attr("srcset");
      if (!srcset) return;
      const parts = srcset.split(",").map((x) => x.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      const urlPart = last?.split(" ")[0];
      if (urlPart && !scraped.images.includes(urlPart)) scraped.images.push(urlPart);
    });
  }

  if (scraped.images.length === 0 && ogImage) scraped.images.push(ogImage);
  if (!scraped.details.description && ogDesc) scraped.details.description = ogDesc;
  scraped.images = scraped.images.slice(0, 30);

  return {
    ogTitle,
    ogDesc,
    ogImage,
    images: scraped.images,
    amenities: scraped.amenities,
    details: scraped.details,
    channel: ch,
  };
}

// ─── Main fetch function ────────────────────────────────────────────

/**
 * Fetches and caches property data from a public listing page.
 * Extracts images, amenities, description, house rules, check-in/out info.
 * Uses PublicPreviewCache with TTL (unless `force` is true).
 */
export async function getOrFetchPublicPreview(
  rawUrl: string,
  opts?: { force?: boolean; ttlSeconds?: number }
): Promise<PublicPreview> {
  const force = !!opts?.force;
  const ttlSeconds = opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (url.protocol !== "https:") throw new Error("Only https:// URLs are allowed.");
  if (!hostAllowed(url.hostname)) {
    throw new Error(
      `Domain not allowed for preview. Allowed: ${ALLOWED_DOMAINS.join(", ")}`
    );
  }

  const channel = detectChannel(rawUrl);

  const cached = await prisma.publicPreviewCache.findUnique({
    where: { url: url.toString() },
  });

  if (cached && !force) {
    const ageSeconds = Math.floor((Date.now() - cached.fetchedAt.getTime()) / 1000);
    if (ageSeconds < (cached.ttlSeconds || ttlSeconds)) {
      return {
        ogTitle: cached.ogTitle,
        ogDesc: cached.ogDesc,
        ogImage: cached.ogImage,
        images: ((cached.images as any) as string[]) ?? (cached.ogImage ? [cached.ogImage] : []),
        amenities: ((cached.amenities as any) as string[]) ?? [],
        details: ((cached.details as any) as PropertyDetails) ?? {},
        channel,
        fromCache: true,
      };
    }
  }

  // Multiple user-agent profiles to retry with if blocked
  const UA_PROFILES = [
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Sec-Ch-Ua": '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
    },
    {
      "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      "Sec-Ch-Ua": '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?1",
      "Sec-Ch-Ua-Platform": '"Android"',
    },
    {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      "Sec-Ch-Ua": "",
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"macOS"',
    },
  ];

  function isChallengePage(status: number, body: string): boolean {
    if (status === 202) return true;
    if (body.includes("reportChallengeError")) return true;
    if (body.includes("window.aws") && body.length < 50_000) return true;
    if (body.includes("challenge-form") && !body.includes("og:title")) return true;
    return false;
  }

  let html = "";
  let lastError: Error | null = null;

  // ── Resolve share-link redirects (Booking /Share-XXX, Airbnb short links) ──
  let resolvedUrl = url.toString();
  if (/\/Share-/i.test(url.pathname) || url.hostname.includes("abnb.me")) {
    for (const method of ["HEAD" as const, "GET" as const]) {
      try {
        const r = await fetch(resolvedUrl, {
          method,
          redirect: method === "HEAD" ? "follow" : "manual",
          headers: { "User-Agent": UA_PROFILES[0]["User-Agent"], Accept: "text/html" },
          signal: AbortSignal.timeout(10_000),
        });
        if (method === "HEAD" && r.url && r.url !== resolvedUrl) {
          resolvedUrl = r.url;
          break;
        }
        if (method === "GET") {
          const loc = r.headers.get("location");
          if (loc) {
            resolvedUrl = loc.startsWith("http") ? loc : new URL(loc, resolvedUrl).toString();
          }
          break;
        }
      } catch { continue; }
    }
  }

  // ── Build a list of URL strategies to try ──
  function addLangSuffix(u: string): string {
    if (!/\/hotel\//i.test(u)) return u;
    if (u.includes(".html")) return u;
    const idx = u.indexOf("?");
    if (idx !== -1) return u.slice(0, idx) + ".en-gb.html" + u.slice(idx);
    return u + ".en-gb.html";
  }

  function toMobile(u: string): string {
    return u.replace("www.booking.com", "m.booking.com");
  }

  function addAffiliateParam(u: string): string {
    const sep = u.includes("?") ? "&" : "?";
    return u + sep + "aid=304142&label=gen173nr-1FCAEoggI46AdIM1gEaGyIAQGYAQm4ARfIAQzYAQHoAQH4AQuIAgGoAgO4AqT";
  }

  const urlStrategies: Array<{ fetchUrl: string; referer: string; label: string }> = [];

  if (channel === "BOOKING") {
    // Strategy 1: Resolved URL with Google referer + affiliate params
    urlStrategies.push({
      fetchUrl: addAffiliateParam(addLangSuffix(resolvedUrl)),
      referer: "https://www.google.com/",
      label: "booking-google-affiliate",
    });
    // Strategy 2: Mobile site with Google referer
    urlStrategies.push({
      fetchUrl: toMobile(addLangSuffix(resolvedUrl)),
      referer: "https://www.google.com/",
      label: "booking-mobile",
    });
    // Strategy 3: Original share link with Google referer (it may have OG tags)
    urlStrategies.push({
      fetchUrl: url.toString(),
      referer: "https://www.google.com/",
      label: "booking-share-direct",
    });
    // Strategy 4: Plain resolved URL without suffix
    urlStrategies.push({
      fetchUrl: resolvedUrl,
      referer: "https://www.booking.com/",
      label: "booking-plain",
    });
  } else {
    // For Airbnb/Agoda, just try the resolved URL with Google referer
    urlStrategies.push({ fetchUrl: resolvedUrl, referer: "https://www.google.com/", label: "default" });
    urlStrategies.push({ fetchUrl: url.toString(), referer: "", label: "original" });
  }

  // ── Try each strategy with each UA profile ──
  outer:
  for (const strategy of urlStrategies) {
    for (const uaProfile of UA_PROFILES) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      try {
        console.log(`[preview] Trying ${strategy.label} with ${uaProfile["Sec-Ch-Ua-Platform"]}`);

        const headers: Record<string, string> = {
          ...uaProfile,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": strategy.referer ? "cross-site" : "none",
          "Sec-Fetch-User": "?1",
          "Connection": "keep-alive",
          "DNT": "1",
        };
        if (strategy.referer) headers["Referer"] = strategy.referer;

        const res = await fetch(strategy.fetchUrl, {
          signal: controller.signal,
          headers,
          redirect: "follow",
        });

        if (!res.ok && res.status !== 202) {
          lastError = new Error(`Fetch failed with ${res.status} (${strategy.label})`);
          continue;
        }

        const body = await res.text();

        if (isChallengePage(res.status, body)) {
          lastError = new Error(`Challenge page on ${strategy.label}`);
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }

        html = body;
        console.log(`[preview] Success with ${strategy.label}, body length: ${body.length}`);
        break outer;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  if (!html) {
    throw lastError ?? new Error("Failed to fetch page after all retry attempts");
  }

  const $ = cheerio.load(html);

  let ogTitle =
    pickMeta($, 'meta[property="og:title"]') ||
    pickMeta($, 'meta[name="twitter:title"]') ||
    $("title").text().trim() ||
    null;

  let ogDesc =
    pickMeta($, 'meta[property="og:description"]') ||
    pickMeta($, 'meta[name="description"]') ||
    pickMeta($, 'meta[name="twitter:description"]') ||
    null;

  let ogImage =
    pickMeta($, 'meta[property="og:image:secure_url"]') ||
    pickMeta($, 'meta[property="og:image"]') ||
    pickMeta($, 'meta[name="twitter:image"]') ||
    null;

  // Parse all JSON-LD blocks
  const jsonLdItems = parseAllJsonLd($);

  // Try JSON-LD as fallback for OG fields
  if (!ogTitle || !ogDesc || !ogImage) {
    const entity = findJsonLdByType(jsonLdItems, "Hotel", "LodgingBusiness", "VacationRental", "Apartment", "House", "SingleFamilyResidence", "Product");
    if (entity) {
      if (!ogTitle && entity.name) ogTitle = entity.name;
      if (!ogDesc && entity.description) ogDesc = entity.description;
      if (!ogImage && entity.image) {
        ogImage = Array.isArray(entity.image) ? entity.image[0] : (entity.image?.url || entity.image);
      }
    }
  }

  // Channel-specific deep scraping
  let scraped: { images: string[]; amenities: string[]; details: PropertyDetails };

  if (channel === "BOOKING") {
    scraped = scrapeBooking($, jsonLdItems);
  } else if (channel === "AIRBNB") {
    scraped = scrapeAirbnb($, jsonLdItems);
  } else if (channel === "AGODA") {
    scraped = scrapeAgoda($, jsonLdItems);
  } else {
    scraped = { images: [], amenities: [], details: {} };
  }

  // Merge JSON-LD images into scraped images
  for (const item of jsonLdItems) {
    const imgs = item?.image;
    if (Array.isArray(imgs)) {
      for (const it of imgs) {
        const s = String(it?.url ?? it ?? "").trim();
        if (s && !scraped.images.includes(s)) scraped.images.push(s);
      }
    } else if (imgs) {
      const s = String(imgs?.url ?? imgs ?? "").trim();
      if (s && !scraped.images.includes(s)) scraped.images.push(s);
    }
  }

  // Generic <img srcset> fallback
  if (scraped.images.length < 5) {
    $("img[srcset]").each((_, el) => {
      const srcset = $(el).attr("srcset");
      if (!srcset) return;
      const parts = srcset.split(",").map((x) => x.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      const urlPart = last?.split(" ")[0];
      if (urlPart && !scraped.images.includes(urlPart)) scraped.images.push(urlPart);
    });
  }

  // Fallback ogImage
  if (scraped.images.length === 0 && ogImage) {
    scraped.images.push(ogImage);
  }

  // Use ogDesc as description fallback
  if (!scraped.details.description && ogDesc) {
    scraped.details.description = ogDesc;
  }

  // Limit
  scraped.images = scraped.images.slice(0, 30);

  // Validation
  if (!ogTitle && !ogDesc && scraped.images.length === 0) {
    throw new Error("No metadata found in page");
  }

  const saved = await prisma.publicPreviewCache.upsert({
    where: { url: url.toString() },
    create: {
      url: url.toString(),
      ogTitle: ogTitle || null,
      ogDesc: ogDesc || null,
      ogImage: ogImage || null,
      images: scraped.images,
      amenities: scraped.amenities,
      details: scraped.details as any,
      ttlSeconds,
    },
    update: {
      ogTitle: ogTitle || null,
      ogDesc: ogDesc || null,
      ogImage: ogImage || null,
      images: scraped.images,
      amenities: scraped.amenities,
      details: scraped.details as any,
      fetchedAt: new Date(),
      ttlSeconds,
    },
  });

  return {
    ogTitle: saved.ogTitle,
    ogDesc: saved.ogDesc,
    ogImage: saved.ogImage,
    images: (saved.images as string[]) ?? [],
    amenities: (saved.amenities as string[]) ?? [],
    details: (saved.details as PropertyDetails) ?? {},
    channel,
    fromCache: false,
  };
}
