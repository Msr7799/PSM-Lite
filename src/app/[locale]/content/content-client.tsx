"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from 'next-intl';
import { Facebook, Twitter, Instagram, Linkedin, Share2, Link as LinkIcon, Mail, Youtube } from "lucide-react";

type Unit = { id: string; name: string };

type Channel = "BOOKING" | "AIRBNB" | "AGODA";

type ContentState = {
  unitId: string;
  master: {
    title: string;
    description: string;
    houseRules: string;
    checkInInfo: string;
    checkOutInfo: string;
    amenities: string[];
    images: string[];
    locationNote: string;
    address: string;
    guestCapacity: string;
    propertyHighlights: string;
    nearbyPlaces: string;
    damageDeposit: string;
    cancellationPolicy: string;
  };
  overrides: Record<
    Channel,
    {
      title?: string;
      description?: string;
      houseRules?: string;
      checkInInfo?: string;
      checkOutInfo?: string;
      amenities?: string[];
      images?: string[];
      listingUrl?: string;
    }
  >;
  drafts: Record<Channel, { title: string; body: string; charCount: number }>;
  externalData?: {
    title?: string;
    description?: string;
    images?: string[];
    amenities?: string[];
    houseRules?: string;
    checkInInfo?: string;
    checkOutInfo?: string;
    address?: string;
    rating?: string;
    source?: string;
    guestCapacity?: string;
    propertyHighlights?: string;
    nearbyPlaces?: string;
    damageDeposit?: string;
    cancellationPolicy?: string;
    socialShareLinks?: Record<string, string>;
    socialProfiles?: Record<string, string>;
    // Extended fields
    propertyId?: string;
    coordinates?: { lat: number; lng: number };
    accommodationType?: string;
    roomSize?: string;
    bedroomCount?: number;
    bathroomCount?: number;
    checkInTime?: string;
    checkOutTime?: string;
    quietHours?: string;
    minCheckInAge?: number;
    smokingPolicy?: string;
    petsPolicy?: string;
    partiesPolicy?: string;
    childrenPolicy?: string;
    paymentMethods?: string;
    hostName?: string;
    hostJoinDate?: string;
    finePrints?: string;
    currency?: string;
    nearbyPlacesDetailed?: Array<{ name: string; distance: string }>;
  } | null;
};

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";
const textarea =
  "w-full min-h-[120px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";
const btn =
  "rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n|,/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function stringifyLines(items: string[]) {
  return (items ?? []).join("\n");
}

// ─── Unfurl types & helpers ────────────────────────────────────────

type KV = { key: string; value: string; attr?: string };
type LinkInfo = {
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
  title?: string;
  hreflang?: string;
  as?: string;
  media?: string;
};
type ImageInfo = { url: string; from: string; score: number; width?: number; height?: number };
type JsonLdInfo = { raw: string; parsed?: any; error?: string; types?: string[] };

type UnfurlResult = {
  url: { input?: string; base?: string; final?: string; canonical?: string };
  page: { title?: string; description?: string; lang?: string };
  social: { og: Record<string, string>; twitter: Record<string, string> };
  meta: KV[];
  links: LinkInfo[];
  media: { images: ImageInfo[]; icons: string[] };
  structured: { jsonld: JsonLdInfo[] };
  text: { h1: string[]; h2: string[] };
  raw: { preview?: any; htmlBytes?: number };
};

function safeUrl(u?: string | null, base?: string) {
  const s = String(u ?? "").trim();
  if (!s) return "";
  try {
    return new URL(s, base || undefined).toString();
  } catch {
    return s;
  }
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function buildImageScore(from: string, url: string) {
  let score = 0;
  const u = url.toLowerCase();
  if (from === "og:image") score += 100;
  if (from === "twitter:image") score += 90;
  if (from === "jsonld:image") score += 80;
  if (from === "img") score += 60;
  if (from === "link:image_src") score += 70;
  if (u.includes("logo")) score -= 30;
  if (u.includes("icon")) score -= 20;
  if (u.includes("sprite")) score -= 20;
  if (u.includes("large") || u.includes("original") || u.includes("full")) score += 10;
  return score;
}

function extractAllFromHtml(html: string, sourceUrl?: string): UnfurlResult {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const baseHref =
    sourceUrl ||
    (doc.querySelector("base")?.getAttribute("href") ? safeUrl(doc.querySelector("base")?.getAttribute("href")) : "");

  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const meta: KV[] = [];

  for (const m of Array.from(doc.querySelectorAll("meta"))) {
    const content = (m.getAttribute("content") || "").trim();
    if (!content) continue;
    const prop = (m.getAttribute("property") || "").trim();
    const name = (m.getAttribute("name") || "").trim();
    const httpEquiv = (m.getAttribute("http-equiv") || "").trim();
    const itemProp = (m.getAttribute("itemprop") || "").trim();
    const key = prop || name || httpEquiv || itemProp || "meta";
    meta.push({ key, value: content });
    const k = key.toLowerCase();
    if (k.startsWith("og:")) og[k] = content;
    if (k.startsWith("twitter:")) twitter[k] = content;
  }

  const links: LinkInfo[] = [];
  const icons: string[] = [];
  for (const l of Array.from(doc.querySelectorAll("link"))) {
    const rel = (l.getAttribute("rel") || "").trim();
    const hrefRaw = (l.getAttribute("href") || "").trim();
    if (!hrefRaw) continue;
    const href = safeUrl(hrefRaw, baseHref);
    links.push({
      rel: rel || "link",
      href,
      type: (l.getAttribute("type") || "").trim() || undefined,
      sizes: (l.getAttribute("sizes") || "").trim() || undefined,
      title: (l.getAttribute("title") || "").trim() || undefined,
      hreflang: (l.getAttribute("hreflang") || "").trim() || undefined,
      as: (l.getAttribute("as") || "").trim() || undefined,
      media: (l.getAttribute("media") || "").trim() || undefined,
    });
    if (rel.toLowerCase().includes("icon")) icons.push(href);
  }

  const jsonld: JsonLdInfo[] = [];
  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const raw = (s.textContent || "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const types: string[] = [];
      const digType = (x: any) => {
        if (!x) return;
        const t = x["@type"];
        if (typeof t === "string") types.push(t);
        if (Array.isArray(t)) for (const z of t) if (typeof z === "string") types.push(z);
      };
      if (Array.isArray(parsed)) parsed.forEach(digType);
      else digType(parsed);
      jsonld.push({ raw, parsed, types: uniq(types) });
    } catch (e: any) {
      jsonld.push({ raw, error: String(e?.message || e) });
    }
  }

  const imgCandidates: ImageInfo[] = [];
  const ogImg = og["og:image"] || og["og:image:url"] || "";
  if (ogImg) imgCandidates.push({ url: safeUrl(ogImg, baseHref), from: "og:image", score: buildImageScore("og:image", ogImg) });
  const twImg = twitter["twitter:image"] || twitter["twitter:image:src"] || "";
  if (twImg) imgCandidates.push({ url: safeUrl(twImg, baseHref), from: "twitter:image", score: buildImageScore("twitter:image", twImg) });
  for (const li of links) {
    if (li.rel.toLowerCase().includes("image_src")) {
      imgCandidates.push({ url: li.href, from: "link:image_src", score: buildImageScore("link:image_src", li.href) });
    }
  }
  const pullJsonldImages = (obj: any) => {
    if (!obj) return;
    const img = obj.image;
    const add = (v: any) => {
      if (!v) return;
      if (typeof v === "string") imgCandidates.push({ url: safeUrl(v, baseHref), from: "jsonld:image", score: buildImageScore("jsonld:image", v) });
      else if (typeof v === "object" && typeof v.url === "string") imgCandidates.push({ url: safeUrl(v.url, baseHref), from: "jsonld:image", score: buildImageScore("jsonld:image", v.url) });
    };
    if (Array.isArray(img)) img.forEach(add);
    else add(img);
  };
  for (const j of jsonld) {
    if (j.parsed) {
      if (Array.isArray(j.parsed)) j.parsed.forEach(pullJsonldImages);
      else pullJsonldImages(j.parsed);
    }
  }
  for (const img of Array.from(doc.images || [])) {
    const src = (img.getAttribute("src") || "").trim();
    const srcset = (img.getAttribute("srcset") || "").trim();
    const w = Number(img.getAttribute("width") || "") || undefined;
    const h = Number(img.getAttribute("height") || "") || undefined;
    if (src) {
      imgCandidates.push({ url: safeUrl(src, baseHref), from: "img", score: buildImageScore("img", src), width: w, height: h });
    }
    if (srcset) {
      for (const p of srcset.split(",").map((x) => x.trim()).filter(Boolean)) {
        const u = p.split(/\s+/)[0];
        if (u) imgCandidates.push({ url: safeUrl(u, baseHref), from: "img", score: buildImageScore("img", u) - 5 });
      }
    }
  }

  const bestByUrl = new Map<string, ImageInfo>();
  for (const it of imgCandidates) {
    const u = it.url.trim();
    if (!u) continue;
    const prev = bestByUrl.get(u);
    if (!prev || it.score > prev.score) bestByUrl.set(u, it);
  }
  const images = Array.from(bestByUrl.values()).sort((a, b) => b.score - a.score);

  const canonical = links.find((x) => x.rel.toLowerCase().split(/\s+/).includes("canonical"))?.href || og["og:url"] || "";
  const title = og["og:title"] || twitter["twitter:title"] || (doc.querySelector("title")?.textContent || "").trim() || "";
  const desc = og["og:description"] || twitter["twitter:description"] || meta.find((x) => x.key.toLowerCase() === "description")?.value || "";
  const h1 = Array.from(doc.querySelectorAll("h1")).map((x) => (x.textContent || "").trim()).filter(Boolean);
  const h2 = Array.from(doc.querySelectorAll("h2")).map((x) => (x.textContent || "").trim()).filter(Boolean);

  return {
    url: { input: sourceUrl, base: baseHref || undefined, canonical: canonical || undefined, final: sourceUrl || undefined },
    page: { title: title || undefined, description: desc || undefined, lang: (doc.documentElement.getAttribute("lang") || "").trim() || undefined },
    social: { og, twitter },
    meta,
    links,
    media: { images, icons: uniq(icons) },
    structured: { jsonld },
    text: { h1, h2 },
    raw: { htmlBytes: html.length },
  };
}

function buildUnfurlFromPreview(preview: any, inputUrl?: string): UnfurlResult {
  const html = String(preview?.html || preview?.rawHtml || "").trim();
  if (html) {
    const extracted = extractAllFromHtml(html, inputUrl);
    return { ...extracted, raw: { ...extracted.raw, preview } };
  }

  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const meta: KV[] = [];
  const links: LinkInfo[] = [];
  const icons: string[] = [];

  const put = (k: string, v: any) => {
    const val = String(v ?? "").trim();
    if (!val) return;
    meta.push({ key: k, value: val });
    const kl = k.toLowerCase();
    if (kl.startsWith("og:")) og[kl] = val;
    if (kl.startsWith("twitter:")) twitter[kl] = val;
  };

  put("og:title", preview?.ogTitle);
  put("og:description", preview?.ogDesc);
  put("og:image", preview?.ogImage);
  put("og:url", preview?.ogUrl || inputUrl);
  put("twitter:title", preview?.twitterTitle);
  put("twitter:description", preview?.twitterDesc);
  put("twitter:image", preview?.twitterImage);

  const pm = preview?.meta;
  if (Array.isArray(pm)) {
    for (const it of pm) {
      if (it && typeof it === "object" && it.key && it.value) put(String(it.key), String(it.value));
    }
  } else if (pm && typeof pm === "object") {
    for (const [k, v] of Object.entries(pm)) put(String(k), String(v));
  }

  const imgs: string[] = [];
  if (Array.isArray(preview?.images)) imgs.push(...preview.images.map((x: any) => String(x)));
  if (preview?.ogImage) imgs.push(String(preview.ogImage));

  const images: ImageInfo[] = uniq(imgs.map((x) => safeUrl(x, inputUrl))).filter(Boolean).map((u, i) => ({
    url: u,
    from: i === 0 ? "og:image" : "img",
    score: buildImageScore(i === 0 ? "og:image" : "img", u),
  })).sort((a, b) => b.score - a.score);

  const canonical = preview?.canonical ? safeUrl(preview.canonical, inputUrl) : (og["og:url"] || "");

  return {
    url: { input: inputUrl, canonical: canonical || undefined, final: inputUrl },
    page: { title: (preview?.ogTitle || preview?.title || "").trim() || undefined, description: (preview?.ogDesc || "").trim() || undefined, lang: preview?.lang || undefined },
    social: { og, twitter },
    meta,
    links,
    media: { images, icons },
    structured: { jsonld: [] },
    text: { h1: [], h2: [] },
    raw: { preview },
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = clamp(page, 1, pages);
  const start = (p - 1) * pageSize;
  return { page: p, pages, total, slice: items.slice(start, start + pageSize) };
}

function safeJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Component ─────────────────────────────────────────────────────

export default function ContentClient({ units }: { units: Unit[] }) {
  const t = useTranslations();
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [importUrl, setImportUrl] = useState("");

  const lastSavedRef = useRef<string>("");
  const savingRef = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get("unit");
    if (q && units.some((u) => u.id === q)) setUnitId(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showPasteHtml, setShowPasteHtml] = useState(false);
  const [pastedHtml, setPastedHtml] = useState("");

  const [unfurl, setUnfurl] = useState<UnfurlResult | null>(null);
  const [showUnfurl, setShowUnfurl] = useState(false);
  const [unfurlTab, setUnfurlTab] = useState<"summary" | "images" | "meta" | "links" | "jsonld" | "raw">("summary");
  const [unfurlSearch, setUnfurlSearch] = useState("");
  const [unfurlPage, setUnfurlPage] = useState(1);
  const [unfurlPageSize, setUnfurlPageSize] = useState(25);

  const [state, setState] = useState<ContentState | null>(null);

  const stateRef = useRef<ContentState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);


  useEffect(() => {
    if (!unitId) return;
    setUnfurl(null);
    setShowUnfurl(false);
    setUnfurlTab("summary");
    setUnfurlSearch("");
    setUnfurlPage(1);
    load(unitId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  async function load(id: string, fetchExternal = false) {
    setBusy(true);
    setMsg("");
    try {
      const url = fetchExternal ? `/api/content/${id}?fetchExternal=true` : `/api/content/${id}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (fetchExternal) {
        // Do NOT clobber current edits; only attach externalData.
        setState((prev) => (prev ? { ...prev, externalData: data.externalData } : data));

        if (data.externalData) {
          setMsg(t("found_external_data", { source: data.externalData.source }));
        } else {
          setMsg(t("no_external_data_found"));
        }
      } else {
        // Snapshot for autosave
        lastSavedRef.current = JSON.stringify({ master: data.master, overrides: data.overrides });
        setState(data);
      }
    } catch {
      setMsg("Error loading data");
    } finally {
      setBusy(false);
    }
  }

  const title = useMemo(() => {
    const u = units.find((x) => x.id === unitId);
    return u ? u.name : t("unit");
  }, [unitId, units, t]);

  function mergeExternalIntoMaster(base: ContentState, ext: NonNullable<ContentState["externalData"]>) {
    const s = (v?: string | null) => String(v ?? "").trim();
    const imagesIn = Array.isArray(ext.images) ? ext.images.map((x) => String(x).trim()).filter(Boolean) : [];
    const amenitiesIn = Array.isArray(ext.amenities) ? ext.amenities.map((x) => String(x).trim()).filter(Boolean) : [];

    return {
      ...base,
      master: {
        ...base.master,
        title: s(ext.title) || base.master.title,
        description: s(ext.description) || base.master.description,
        images: imagesIn.length ? imagesIn : base.master.images,
        amenities: amenitiesIn.length ? amenitiesIn : base.master.amenities,
        houseRules: s(ext.houseRules) || base.master.houseRules,
        checkInInfo: s(ext.checkInInfo) || base.master.checkInInfo,
        checkOutInfo: s(ext.checkOutInfo) || base.master.checkOutInfo,
        address: s(ext.address) || base.master.address,
        guestCapacity: s(ext.guestCapacity) || base.master.guestCapacity,
        propertyHighlights: s(ext.propertyHighlights) || base.master.propertyHighlights,
        nearbyPlaces: s(ext.nearbyPlaces) || base.master.nearbyPlaces,
        damageDeposit: s(ext.damageDeposit) || base.master.damageDeposit,
        cancellationPolicy: s(ext.cancellationPolicy) || base.master.cancellationPolicy,
      },
      externalData: undefined,
    };
  }

  async function savePayload(
    payload: ContentState,
    opts?: { silent?: boolean; applyFresh?: boolean }
  ) {
    if (savingRef.current) return null;
    savingRef.current = true;

    try {
      const res = await fetch(`/api/content/${unitId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          master: payload.master,
          overrides: payload.overrides,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Save failed");
        if (!opts?.silent) setMsg(err);
        return null;
      }

      // When autosaving, we avoid replacing state (to prevent cursor jumps).
      if (opts?.applyFresh === false) {
        lastSavedRef.current = JSON.stringify({ master: payload.master, overrides: payload.overrides });
        return payload;
      }

      const fresh = await res.json();
      lastSavedRef.current = JSON.stringify({ master: fresh.master, overrides: fresh.overrides });
      setState(fresh);
      return fresh;
    } finally {
      savingRef.current = false;
    }
  }

  async function save() {
    if (!state) return;
    setBusy(true);
    setMsg("");
    try {
      const fresh = await savePayload(state, { applyFresh: true });
      if (fresh) setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function fetchApplyAndSave() {
    if (!state) return;
    setBusy(true);
    setMsg("");
    try {
      let ext: any = null;

      const url = importUrl.trim();
      if (url) {
        // Store as primary link and refresh preview cache (supports Booking/Airbnb/Agoda).
        const res = await fetch(`/api/units/${unitId}/primary-link`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicUrl: url, forcePreview: true, includeHtml: true, includeHeaders: true }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg(t("scrape_failed_paste_fallback"));
          setShowPasteHtml(true);
          return;
        }

        const p = data?.preview;
        if (p) {
          try {
            const full = buildUnfurlFromPreview(p, url);
            setUnfurl(full);
            setShowUnfurl(true);
            setUnfurlTab("summary");
            setUnfurlSearch("");
            setUnfurlPage(1);
          } catch {
            // ignore unfurl errors
          }
        }
        const imgs =
          (p?.images && Array.isArray(p.images) ? p.images : []) as string[];
        const det = p?.details ?? {};

        ext = {
          title: p?.ogTitle ?? undefined,
          description: det.description || (p?.ogDesc ?? undefined),
          images: imgs.length ? imgs : (p?.ogImage ? [p.ogImage] : []),
          amenities: Array.isArray(p?.amenities) ? p.amenities : [],
          houseRules: det.houseRules ?? undefined,
          checkInInfo: det.checkInInfo ?? undefined,
          checkOutInfo: det.checkOutInfo ?? undefined,
          address: det.address ?? undefined,
          rating: det.rating ?? undefined,
          source: p?.channel ?? "LINK",
          guestCapacity: det.guestCapacity ?? undefined,
          propertyHighlights: det.propertyHighlights ?? undefined,
          nearbyPlaces: det.nearbyPlaces ?? undefined,
          damageDeposit: det.damageDeposit ?? undefined,
          cancellationPolicy: det.cancellationPolicy ?? undefined,
          socialShareLinks: det.socialShareLinks ?? undefined,
          socialProfiles: det.socialProfiles ?? undefined,
        };

        // Check if we got meaningful data or just empty/challenge response
        if (!ext.title && !ext.description && (!ext.images || ext.images.length === 0)) {
          setMsg(t("scrape_failed_paste_fallback"));
          setShowPasteHtml(true);
          return;
        }
      } else {
        // No pasted link => use the first stored listing link
        const res = await fetch(`/api/content/${unitId}?fetchExternal=true`, { cache: "no-store" });
        const data = await res.json();
        ext = data?.externalData ?? null;
      }

      if (!ext) {
        setMsg(t("no_external_data_found"));
        return;
      }

      const next = mergeExternalIntoMaster({ ...state, externalData: ext }, ext);

      // Apply to UI immediately
      setState(next);

      // Persist (and refresh drafts)
      const saved = await savePayload(next, { silent: true, applyFresh: true });
      if (saved) {
        setImportUrl("");
        setMsg(t("imported_and_saved"));
      } else {
        setMsg(t("imported_but_save_failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  function applyExternal() {
    if (!state || !state.externalData) return;
    const next = mergeExternalIntoMaster(state, state.externalData);
    setState(next);
    setMsg(t("applied_external_data"));
    // Auto-persist so refresh won't wipe it
    void savePayload(next, { silent: true, applyFresh: true });
  }

  async function parseFromPastedHtml() {
    if (!state || !pastedHtml.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/content/parse-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: pastedHtml, sourceUrl: importUrl.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error ?? "Parse failed");
        return;
      }

      const p = data?.preview;
      try {
        const full = extractAllFromHtml(pastedHtml, importUrl.trim() || undefined);
        (full as any).raw = { ...(full as any).raw, preview: p };
        setUnfurl(full);
        setShowUnfurl(true);
        setUnfurlTab("summary");
        setUnfurlSearch("");
        setUnfurlPage(1);
      } catch {
        // ignore unfurl errors
      }

      const det = p?.details ?? {};
      const imgs = Array.isArray(p?.images) ? p.images : [];

      const ext = {
        title: p?.ogTitle ?? undefined,
        description: det.description || (p?.ogDesc ?? undefined),
        images: imgs.length ? imgs : (p?.ogImage ? [p.ogImage] : []),
        amenities: Array.isArray(p?.amenities) ? p.amenities : [],
        houseRules: det.houseRules ?? undefined,
        checkInInfo: det.checkInInfo ?? undefined,
        checkOutInfo: det.checkOutInfo ?? undefined,
        address: det.address ?? undefined,
        rating: det.rating ?? undefined,
        source: p?.channel ?? "PASTE",
        guestCapacity: det.guestCapacity ?? undefined,
        propertyHighlights: det.propertyHighlights ?? undefined,
        nearbyPlaces: det.nearbyPlaces ?? undefined,
        damageDeposit: det.damageDeposit ?? undefined,
        cancellationPolicy: det.cancellationPolicy ?? undefined,
        socialShareLinks: det.socialShareLinks ?? undefined,
        socialProfiles: det.socialProfiles ?? undefined,
      };

      if (!ext.title && !ext.description && ext.images.length === 0) {
        setMsg(t("no_external_data_found"));
        return;
      }

      const next = mergeExternalIntoMaster({ ...state, externalData: ext }, ext);
      setState(next);

      const saved = await savePayload(next, { silent: true, applyFresh: true });
      if (saved) {
        setShowPasteHtml(false);
        setPastedHtml("");
        setImportUrl("");
        setMsg(t("imported_and_saved"));
      } else {
        setMsg(t("imported_but_save_failed"));
      }
    } finally {
      setBusy(false);
    }
  }


  const draftSnap = useMemo(() => {
    if (!state) return "";
    return JSON.stringify({ master: state.master, overrides: state.overrides });
  }, [state?.master, state?.overrides]);

  useEffect(() => {
    if (!state) return;
    if (!draftSnap) return;
    if (busy) return;
    if (savingRef.current) return;

    if (draftSnap === lastSavedRef.current) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const latest = stateRef.current;
      if (!latest) return;
      const snapNow = JSON.stringify({ master: latest.master, overrides: latest.overrides });
      if (snapNow === lastSavedRef.current) return;
      void savePayload(latest, { silent: true, applyFresh: false });
    }, 1200);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSnap, unitId, busy]);

  useEffect(() => {
    setUnfurlPage(1);
  }, [unfurlTab, unfurlSearch, unfurlPageSize]);

  function setMainImageInMaster(url: string) {
    if (!state) return;
    const u = String(url || "").trim();
    if (!u) return;
    const next = [u, ...(state.master.images || []).filter((x) => x !== u)];
    setState({ ...state, master: { ...state.master, images: next } });
    setMsg("تم تعيين الصورة الرئيسية ✅");
  }

  function replaceMasterImagesFromUnfurl(urls: string[]) {
    if (!state) return;
    const cleaned = uniq((urls || []).map((x) => String(x).trim()).filter(Boolean));
    if (cleaned.length === 0) return;
    setState({ ...state, master: { ...state.master, images: cleaned } });
    setMsg(`تم تحديث الصور (${cleaned.length}) ✅`);
  }

  function moveMasterImage(index: number, dir: -1 | 1) {
    if (!state) return;
    const arr = [...(state.master.images || [])];
    if (index < 0 || index >= arr.length) return;
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[index];
    arr[index] = arr[j];
    arr[j] = tmp;
    setState({ ...state, master: { ...state.master, images: arr } });
  }

  if (!unitId) {
    return <div className="text-sm text-slate-600 dark:text-slate-400">{t('no_units')}</div>;
  }

  if (!state) {
    return <div className="text-sm text-slate-600 dark:text-slate-400">{t('loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px]">
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('unit')}</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={input}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[320px] flex-1">
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('listing_share_url')}</label>
          <input
            className={input}
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder={t('listing_share_placeholder')}
          />
        </div>

        <button
          onClick={save}
          disabled={busy}
          className={`${btn} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900`}
        >
          {t('save')}
        </button>

        <button
          onClick={fetchApplyAndSave}
          disabled={busy}
          className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}
        >
          {t('fetch_from_link')}
        </button>

        {msg ? (
          <div className="text-sm text-slate-700 dark:text-slate-200">{msg}</div>
        ) : null}
      </div>

      {showPasteHtml && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {t("paste_html_title")}
            </div>
            <button
              onClick={() => { setShowPasteHtml(false); setPastedHtml(""); }}
              className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400"
            >
              ✕
            </button>
          </div>
          <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <p>{t("paste_html_step1")}</p>
            <p>{t("paste_html_step2")}</p>
            <p>{t("paste_html_step3")}</p>
          </div>
          <textarea
            className={`${textarea} min-h-[120px] font-mono text-[11px]`}
            value={pastedHtml}
            onChange={(e) => setPastedHtml(e.target.value)}
            placeholder={t("paste_html_placeholder")}
            dir="ltr"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={parseFromPastedHtml}
              disabled={busy || pastedHtml.length < 100}
              className={`${btn} bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50`}
            >
              {t("paste_html_parse")}
            </button>
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              {pastedHtml.length > 0 ? `${(pastedHtml.length / 1024).toFixed(0)} KB` : ""}
            </span>
          </div>
        </div>
      )}

      {state.externalData && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900 dark:bg-blue-950/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              {t('found_data_msg', { source: state.externalData.source ?? '' })}
              {state.externalData.rating && (
                <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                  ★ {state.externalData.rating}
                </span>
              )}
              {state.externalData.address && (
                <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                  — {state.externalData.address}
                </span>
              )}
            </div>
            <button
              onClick={applyExternal}
              className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}
            >
              {t('apply_data')}
            </button>
          </div>

          {/* Preview images */}
          {state.externalData.images && state.externalData.images.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
              {state.externalData.images.slice(0, 8).map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <img src={src} className="h-full w-full object-cover" loading="lazy" />
                </a>
              ))}
              {state.externalData.images.length > 8 && (
                <div className="flex items-center justify-center aspect-square rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">
                  +{state.externalData.images.length - 8}
                </div>
              )}
            </div>
          )}

          {/* Preview details summary */}
          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {state.externalData.title && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">{t('title')}</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200 line-clamp-2">{state.externalData.title}</div>
              </div>
            )}
            {state.externalData.amenities && state.externalData.amenities.length > 0 && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">{t('amenities')}</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200 line-clamp-2">{state.externalData.amenities.slice(0, 5).join(", ")}{state.externalData.amenities.length > 5 ? ` (+${state.externalData.amenities.length - 5})` : ""}</div>
              </div>
            )}
            {state.externalData.houseRules && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">{t('house_rules')}</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200 line-clamp-2">{state.externalData.houseRules}</div>
              </div>
            )}
            {(state.externalData.checkInInfo || state.externalData.checkOutInfo) && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">{t('check_in')} / {t('check_out')}</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200 line-clamp-2">
                  {[state.externalData.checkInInfo, state.externalData.checkOutInfo].filter(Boolean).join(" · ")}
                </div>
              </div>
            )}
            {state.externalData.guestCapacity && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">{t('guest_capacity')}</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200">{state.externalData.guestCapacity}</div>
              </div>
            )}
            {state.externalData.damageDeposit && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">{t('damage_deposit')}</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200">{state.externalData.damageDeposit}</div>
              </div>
            )}
            {state.externalData.cancellationPolicy && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">{t('cancellation_policy')}</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200 line-clamp-2">{state.externalData.cancellationPolicy}</div>
              </div>
            )}
            {state.externalData.propertyHighlights && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">{t('property_highlights')}</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200 line-clamp-2">{state.externalData.propertyHighlights}</div>
              </div>
            )}
            {state.externalData.accommodationType && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">نوع العقار</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200">{state.externalData.accommodationType}</div>
              </div>
            )}
            {state.externalData.propertyId && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">رقم العقار</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200">{state.externalData.propertyId}</div>
              </div>
            )}
            {state.externalData.currency && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">العملة</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200">{state.externalData.currency}</div>
              </div>
            )}
            {state.externalData.roomSize && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">المساحة</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200">{state.externalData.roomSize}</div>
              </div>
            )}
            {(state.externalData.bedroomCount || state.externalData.bathroomCount) && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">الغرف / الحمامات</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200">
                  {state.externalData.bedroomCount ? `${state.externalData.bedroomCount} غرف نوم` : ""}
                  {state.externalData.bedroomCount && state.externalData.bathroomCount ? " · " : ""}
                  {state.externalData.bathroomCount ? `${state.externalData.bathroomCount} حمام` : ""}
                </div>
              </div>
            )}
            {state.externalData.coordinates && (
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2">
                <div className="font-medium text-slate-500 dark:text-slate-400">الإحداثيات</div>
                <div className="mt-0.5 text-slate-800 dark:text-slate-200">
                  <a href={`https://www.google.com/maps?q=${state.externalData.coordinates.lat},${state.externalData.coordinates.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                    {state.externalData.coordinates.lat.toFixed(6)}, {state.externalData.coordinates.lng.toFixed(6)} 📍
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* ── Policy Details ── */}
          {(state.externalData.smokingPolicy || state.externalData.petsPolicy || state.externalData.partiesPolicy || state.externalData.quietHours || state.externalData.minCheckInAge || state.externalData.childrenPolicy || state.externalData.paymentMethods) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-xs space-y-2">
              <div className="font-semibold text-amber-800 dark:text-amber-200">السياسات والقوانين التفصيلية</div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {state.externalData.checkInTime && (
                  <div className="flex items-start gap-1.5"><span className="text-amber-600">🕐</span><span className="text-slate-700 dark:text-slate-300"><strong>تسجيل الوصول:</strong> {state.externalData.checkInTime}</span></div>
                )}
                {state.externalData.checkOutTime && (
                  <div className="flex items-start gap-1.5"><span className="text-amber-600">🕐</span><span className="text-slate-700 dark:text-slate-300"><strong>تسجيل المغادرة:</strong> {state.externalData.checkOutTime}</span></div>
                )}
                {state.externalData.quietHours && (
                  <div className="flex items-start gap-1.5"><span className="text-amber-600">🤫</span><span className="text-slate-700 dark:text-slate-300"><strong>ساعات الهدوء:</strong> {state.externalData.quietHours}</span></div>
                )}
                {state.externalData.minCheckInAge && (
                  <div className="flex items-start gap-1.5"><span className="text-amber-600">🔞</span><span className="text-slate-700 dark:text-slate-300"><strong>أقل عمر:</strong> {state.externalData.minCheckInAge} سنة</span></div>
                )}
                {state.externalData.smokingPolicy && (
                  <div className="flex items-start gap-1.5"><span className="text-amber-600">🚭</span><span className="text-slate-700 dark:text-slate-300"><strong>التدخين:</strong> {state.externalData.smokingPolicy}</span></div>
                )}
                {state.externalData.petsPolicy && (
                  <div className="flex items-start gap-1.5"><span className="text-amber-600">🐾</span><span className="text-slate-700 dark:text-slate-300"><strong>الحيوانات:</strong> {state.externalData.petsPolicy}</span></div>
                )}
                {state.externalData.partiesPolicy && (
                  <div className="flex items-start gap-1.5"><span className="text-amber-600">🎉</span><span className="text-slate-700 dark:text-slate-300"><strong>الحفلات:</strong> {state.externalData.partiesPolicy}</span></div>
                )}
                {state.externalData.childrenPolicy && (
                  <div className="flex items-start gap-1.5"><span className="text-amber-600">👶</span><span className="text-slate-700 dark:text-slate-300"><strong>الأطفال:</strong> {state.externalData.childrenPolicy}</span></div>
                )}
                {state.externalData.paymentMethods && (
                  <div className="flex items-start gap-1.5"><span className="text-amber-600">💳</span><span className="text-slate-700 dark:text-slate-300"><strong>طرق الدفع:</strong> {state.externalData.paymentMethods}</span></div>
                )}
              </div>
            </div>
          )}

          {/* ── Host Info ── */}
          {(state.externalData.hostName || state.externalData.hostJoinDate) && (
            <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2 text-xs">
              <div className="font-medium text-slate-500 dark:text-slate-400">معلومات المضيف</div>
              <div className="mt-0.5 text-slate-800 dark:text-slate-200">
                {state.externalData.hostName && <span className="font-semibold">{state.externalData.hostName}</span>}
                {state.externalData.hostJoinDate && <span className="text-slate-500"> · عضو منذ {state.externalData.hostJoinDate}</span>}
              </div>
            </div>
          )}

          {state.externalData.description && (
            <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2 text-xs">
              <div className="font-medium text-slate-500 dark:text-slate-400">{t('description')}</div>
              <div className="mt-0.5 text-slate-800 dark:text-slate-200 line-clamp-3">{state.externalData.description}</div>
            </div>
          )}

          {/* ── Fine Prints ── */}
          {state.externalData.finePrints && (
            <div className="rounded-lg bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-2 text-xs">
              <div className="font-medium text-red-600 dark:text-red-400">معلومات مهمة (Fine Print)</div>
              <div className="mt-0.5 text-slate-800 dark:text-slate-200 whitespace-pre-line">{state.externalData.finePrints}</div>
            </div>
          )}

          {/* ── Nearby Places ── */}
          {(state.externalData.nearbyPlacesDetailed?.length || state.externalData.nearbyPlaces) ? (
            <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2 text-xs">
              <div className="font-medium text-slate-500 dark:text-slate-400">{t('nearby_places')}</div>
              {state.externalData.nearbyPlacesDetailed?.length ? (
                <div className="mt-1 space-y-1">
                  {state.externalData.nearbyPlacesDetailed.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>📍 {p.name}</span>
                      <span className="text-slate-500 font-mono">{p.distance}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-0.5 text-slate-800 dark:text-slate-200 whitespace-pre-line">{state.externalData.nearbyPlaces}</div>
              )}
            </div>
          ) : null}

          {/* Social Links & Profiles */}
          {(state.externalData.socialShareLinks || state.externalData.socialProfiles) && (
            <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2 text-xs">
              <div className="font-medium text-slate-500 dark:text-slate-400 mb-2">{t('social_links')}</div>

              {/* Share Links */}
              {state.externalData.socialShareLinks && (
                <div className="mb-3">
                  <div className="text-[10px] uppercase text-slate-400 mb-1">{t('share_links')}</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(state.externalData.socialShareLinks).map(([platform, url]) => {
                      if (!url) return null;
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title={`Share on ${platform}`}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {platform === 'facebook' && <Facebook size={14} />}
                          {platform === 'twitter' && <Twitter size={14} />}
                          {platform === 'linkedin' && <Linkedin size={14} />}
                          {platform === 'whatsapp' && <Share2 size={14} />}
                          {platform === 'email' && <Mail size={14} />}
                          {platform === 'copyLink' && <LinkIcon size={14} />}
                          {!['facebook', 'twitter', 'linkedin', 'whatsapp', 'email', 'copyLink'].includes(platform) && <Share2 size={14} />}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Social Profiles */}
              {state.externalData.socialProfiles && Object.keys(state.externalData.socialProfiles).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase text-slate-400 mb-1">{t('social_profiles')}</div>
                  <div className="flex flex-wrap gap-2 text-slate-600 dark:text-slate-400">
                    {Object.entries(state.externalData.socialProfiles).map(([platform, url]) => {
                      if (!url) return null;
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          {platform === 'facebook' && <Facebook size={12} />}
                          {platform === 'instagram' && <Instagram size={12} />}
                          {platform === 'twitter' && <Twitter size={12} />}
                          {platform === 'linkedin' && <Linkedin size={12} />}
                          {platform === 'youtube' && <Youtube size={12} />}
                          <span className="capitalize">{platform}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Unfurl Explorer ─────────────────────────────────────── */}
      {unfurl && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-[220px]">
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                مستكشف بيانات الصفحة (كل شيء)
              </div>
              <div className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-300 break-all">
                {unfurl.url.canonical || unfurl.url.input || ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(safeJson(unfurl));
                  setMsg(ok ? "تم نسخ JSON ✅" : "ما قدرت أنسخ 📋");
                }}
                className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}
              >
                نسخ JSON
              </button>
              <button
                onClick={() => setShowUnfurl((v) => !v)}
                className={`${btn} border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-200`}
              >
                {showUnfurl ? "إخفاء" : "عرض"}
              </button>
              <button
                onClick={() => { setUnfurl(null); setShowUnfurl(false); }}
                className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}
                title="إغلاق"
              >
                ✕
              </button>
            </div>
          </div>

          {showUnfurl && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[240px] flex-1">
                  <label className="block text-xs text-emerald-900/80 dark:text-emerald-200/80">بحث (Meta / Links / Images / JSON-LD)</label>
                  <input className={input} value={unfurlSearch} onChange={(e) => setUnfurlSearch(e.target.value)} placeholder="اكتب كلمة…" dir="ltr" />
                </div>
                <div className="min-w-[160px]">
                  <label className="block text-xs text-emerald-900/80 dark:text-emerald-200/80">حجم الصفحة</label>
                  <select className={input} value={String(unfurlPageSize)} onChange={(e) => setUnfurlPageSize(Number(e.target.value) || 25)}>
                    {[10, 25, 50, 100].map((n) => (<option key={n} value={String(n)}>{n}</option>))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {([
                  ["summary", "ملخص"],
                  ["images", `الصور (${unfurl.media.images.length})`],
                  ["meta", `Meta (${unfurl.meta.length})`],
                  ["links", `Links (${unfurl.links.length})`],
                  ["jsonld", `JSON-LD (${unfurl.structured.jsonld.length})`],
                  ["raw", "Raw"],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setUnfurlTab(k as any)}
                    className={`${btn} ${unfurlTab === k ? "bg-emerald-600 text-white" : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100 dark:bg-slate-950 dark:text-emerald-200 dark:border-emerald-900"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(() => {
                const q = unfurlSearch.trim().toLowerCase();
                const Pager = ({ total, pages, page: pg }: { total: number; pages: number; page: number }) => (
                  <div className="flex items-center justify-between gap-2 text-xs text-emerald-900/80 dark:text-emerald-200/80">
                    <button className={`${btn} border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-200`} disabled={pg <= 1} onClick={() => setUnfurlPage(pg - 1)}>السابق</button>
                    <div className="tabular-nums">صفحة {pg} / {pages} — العناصر: {total}</div>
                    <button className={`${btn} border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-200`} disabled={pg >= pages} onClick={() => setUnfurlPage(pg + 1)}>التالي</button>
                  </div>
                );

                if (unfurlTab === "summary") {
                  const bestImg = unfurl.media.images[0]?.url || "";
                  return (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-white/70 p-3 text-sm dark:bg-slate-900/40 space-y-2">
                        <div><div className="text-xs text-slate-500 dark:text-slate-400">Title</div><div className="text-slate-900 dark:text-slate-100">{unfurl.page.title || "—"}</div></div>
                        <div><div className="text-xs text-slate-500 dark:text-slate-400">Description</div><div className="text-slate-800 dark:text-slate-200 line-clamp-4 whitespace-pre-line">{unfurl.page.description || "—"}</div></div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[["OG", Object.keys(unfurl.social.og).length], ["Twitter", Object.keys(unfurl.social.twitter).length], ["Meta", unfurl.meta.length], ["Links", unfurl.links.length]].map(([lbl, cnt]) => (
                            <div key={String(lbl)} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950/60"><div className="text-slate-500 dark:text-slate-400">{lbl}</div><div className="mt-0.5 tabular-nums">{cnt}</div></div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">أفضل صورة</div>
                          {bestImg && <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`} onClick={() => setMainImageInMaster(bestImg)}>خلّها الرئيسية</button>}
                        </div>
                        {bestImg ? (
                          <a href={bestImg} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"><img src={bestImg} className="h-56 w-full object-cover" loading="lazy" /></a>
                        ) : (
                          <div className="text-sm text-slate-600 dark:text-slate-300">ما حصلت صور من الصفحة.</div>
                        )}
                        <div className="text-xs text-slate-600 dark:text-slate-300">حجم HTML: {unfurl.raw.htmlBytes ? `${(unfurl.raw.htmlBytes / 1024).toFixed(0)} KB` : "—"}{unfurl.raw.preview ? " — وفيه Preview من السيرفر ✅" : ""}</div>
                      </div>
                    </div>
                  );
                }

                if (unfurlTab === "images") {
                  const itemsAll = (unfurl.media.images || []).filter((x) => q ? x.url.toLowerCase().includes(q) || x.from.toLowerCase().includes(q) : true);
                  const pag = paginate(itemsAll, unfurlPage, unfurlPageSize);
                  return (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-emerald-900/80 dark:text-emerald-200/80">تقدر تختار صورة رئيسية أو تستبدل كل صور المحتوى.</div>
                        <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`} onClick={() => replaceMasterImagesFromUnfurl(itemsAll.map((x) => x.url))}>استبدال صور المحتوى</button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {pag.slice.map((it) => (
                          <div key={it.url} className="rounded-xl border border-emerald-200 bg-white/70 p-2 dark:border-emerald-900 dark:bg-slate-900/40">
                            <a href={it.url} target="_blank" rel="noreferrer" className="block aspect-video overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><img src={it.url} className="h-full w-full object-cover" loading="lazy" /></a>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="min-w-0"><div className="text-[11px] text-slate-500 dark:text-slate-400">{it.from} — score {it.score}</div><div className="text-[11px] text-slate-700 dark:text-slate-200 break-all line-clamp-2">{it.url}</div></div>
                              <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`} onClick={() => setMainImageInMaster(it.url)}>رئيسية</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Pager total={pag.total} pages={pag.pages} page={pag.page} />
                    </div>
                  );
                }

                if (unfurlTab === "meta") {
                  const itemsAll = (unfurl.meta || []).filter((x) => q ? `${x.key} ${x.value}`.toLowerCase().includes(q) : true);
                  const pag = paginate(itemsAll, unfurlPage, unfurlPageSize);
                  return (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-900">
                        <div className="max-h-[420px] overflow-auto bg-white/70 dark:bg-slate-900/40">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-emerald-100/80 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200"><tr><th className="px-2 py-2 text-right w-[34%]">Key</th><th className="px-2 py-2 text-right">Value</th></tr></thead>
                            <tbody>
                              {pag.slice.map((m, idx) => (
                                <tr key={`${m.key}-${idx}`} className="border-t border-emerald-200/60 dark:border-emerald-900/60"><td className="px-2 py-2 align-top font-mono break-all">{m.key}</td><td className="px-2 py-2 align-top break-all">{m.value}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <Pager total={pag.total} pages={pag.pages} page={pag.page} />
                    </div>
                  );
                }

                if (unfurlTab === "links") {
                  const itemsAll = (unfurl.links || []).filter((x) => q ? `${x.rel} ${x.href}`.toLowerCase().includes(q) : true);
                  const pag = paginate(itemsAll, unfurlPage, unfurlPageSize);
                  return (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-900">
                        <div className="max-h-[420px] overflow-auto bg-white/70 dark:bg-slate-900/40">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-emerald-100/80 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200"><tr><th className="px-2 py-2 text-right w-[22%]">rel</th><th className="px-2 py-2 text-right">href</th></tr></thead>
                            <tbody>
                              {pag.slice.map((l, idx) => (
                                <tr key={`${l.rel}-${idx}`} className="border-t border-emerald-200/60 dark:border-emerald-900/60">
                                  <td className="px-2 py-2 align-top font-mono break-all">{l.rel}</td>
                                  <td className="px-2 py-2 align-top break-all">
                                    <a className="underline text-emerald-700 dark:text-emerald-300" href={l.href} target="_blank" rel="noreferrer">{l.href}</a>
                                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{[l.type && `type:${l.type}`, l.sizes && `sizes:${l.sizes}`, l.hreflang && `lang:${l.hreflang}`, l.as && `as:${l.as}`].filter(Boolean).join(" · ")}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <Pager total={pag.total} pages={pag.pages} page={pag.page} />
                    </div>
                  );
                }

                if (unfurlTab === "jsonld") {
                  const itemsAll = (unfurl.structured.jsonld || []).filter((x) => q ? `${(x.types || []).join(" ")} ${x.raw}`.toLowerCase().includes(q) : true);
                  const pag = paginate(itemsAll, unfurlPage, unfurlPageSize);
                  return (
                    <div className="space-y-3">
                      <div className="grid gap-2">
                        {pag.slice.map((j, idx) => (
                          <div key={idx} className="rounded-xl border border-emerald-200 bg-white/70 p-3 dark:border-emerald-900 dark:bg-slate-900/40">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-slate-700 dark:text-slate-200">{j.types?.length ? <span className="font-semibold">Types:</span> : <span className="font-semibold">JSON-LD</span>}<span className="ml-2 font-mono">{j.types?.join(", ") || "—"}</span></div>
                              <button className={`${btn} border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-200`} onClick={async () => { const ok = await copyToClipboard(j.raw); setMsg(ok ? "تم نسخ JSON-LD ✅" : "فشل النسخ 📋"); }}>نسخ</button>
                            </div>
                            {j.error && <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">Parsing error: {j.error}</div>}
                            <pre className="mt-2 max-h-[260px] overflow-auto rounded-lg bg-slate-950/90 p-2 text-[11px] text-slate-100">{j.raw.slice(0, 6000)}</pre>
                          </div>
                        ))}
                      </div>
                      <Pager total={pag.total} pages={pag.pages} page={pag.page} />
                    </div>
                  );
                }

                return (
                  <div className="rounded-xl border border-emerald-200 bg-white/70 p-3 dark:border-emerald-900 dark:bg-slate-900/40">
                    <pre className="max-h-[520px] overflow-auto rounded-lg bg-slate-950/90 p-3 text-[11px] text-slate-100">{safeJson(unfurl).slice(0, 150000)}</pre>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('master_content')}</h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {title}
          </span>
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('title')}</label>
          <input
            className={input}
            value={state.master.title}
            onChange={(e) => setState({ ...state, master: { ...state.master, title: e.target.value } })}
            placeholder={t('placeholder_title')}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('description')}</label>
          <textarea
            className={textarea}
            value={state.master.description}
            onChange={(e) => setState({ ...state, master: { ...state.master, description: e.target.value } })}
            placeholder={t('placeholder_description')}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('images_urls')}</label>
          <textarea
            className={`${textarea} min-h-[80px]`}
            value={stringifyLines(state.master.images)}
            onChange={(e) =>
              setState({ ...state, master: { ...state.master, images: parseLines(e.target.value) } })
            }
            placeholder={t('placeholder_images')}
          />
          {state.master.images?.length ? (
            <div className="mt-2">
              <div className="flex flex-wrap gap-2">
                {state.master.images.slice(0, 12).map((src, i) => (
                  <div key={`${src}-${i}`} className="relative">
                    <a href={src} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                      <img src={src} className="h-full w-full object-cover" loading="lazy" />
                    </a>
                    <div className="mt-1 flex items-center justify-center gap-1 text-[10px]">
                      <button className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900" onClick={() => setMainImageInMaster(src)} title="اجعلها الأولى">★</button>
                      <button className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => moveMasterImage(i, -1)} title="فوق">↑</button>
                      <button className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => moveMasterImage(i, 1)} title="تحت">↓</button>
                    </div>
                  </div>
                ))}
                {state.master.images.length > 12 && (
                  <div className="flex items-center justify-center h-16 w-16 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">
                    +{state.master.images.length - 12}
                  </div>
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{state.master.images.length} {t('images_count')}</div>
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('amenities')}</label>
          <textarea
            className={textarea}
            value={stringifyLines(state.master.amenities)}
            onChange={(e) =>
              setState({ ...state, master: { ...state.master, amenities: parseLines(e.target.value) } })
            }
            placeholder={t('placeholder_amenities')}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('address')}</label>
            <input
              className={input}
              value={state.master.address || ""}
              onChange={(e) => setState({ ...state, master: { ...state.master, address: e.target.value } })}
              placeholder={t('placeholder_address')}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('guest_capacity')}</label>
            <input
              className={input}
              value={state.master.guestCapacity || ""}
              onChange={(e) => setState({ ...state, master: { ...state.master, guestCapacity: e.target.value } })}
              placeholder={t('placeholder_capacity')}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('property_highlights')}</label>
          <textarea
            className={textarea}
            value={state.master.propertyHighlights || ""}
            onChange={(e) => setState({ ...state, master: { ...state.master, propertyHighlights: e.target.value } })}
            placeholder={t('placeholder_highlights')}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('check_in')}</label>
            <textarea
              className={textarea}
              value={state.master.checkInInfo || ""}
              onChange={(e) => setState({ ...state, master: { ...state.master, checkInInfo: e.target.value } })}
              placeholder={t('placeholder_checkin')}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('check_out')}</label>
            <textarea
              className={textarea}
              value={state.master.checkOutInfo || ""}
              onChange={(e) => setState({ ...state, master: { ...state.master, checkOutInfo: e.target.value } })}
              placeholder={t('placeholder_checkout')}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('house_rules')}</label>
          <textarea
            className={`${textarea} min-h-[160px]`}
            value={state.master.houseRules || ""}
            onChange={(e) => setState({ ...state, master: { ...state.master, houseRules: e.target.value } })}
            placeholder={t('placeholder_rules')}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('damage_deposit')}</label>
            <input
              className={input}
              value={state.master.damageDeposit || ""}
              onChange={(e) => setState({ ...state, master: { ...state.master, damageDeposit: e.target.value } })}
              placeholder={t('placeholder_deposit')}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('cancellation_policy')}</label>
            <input
              className={input}
              value={state.master.cancellationPolicy || ""}
              onChange={(e) => setState({ ...state, master: { ...state.master, cancellationPolicy: e.target.value } })}
              placeholder={t('placeholder_cancellation')}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('nearby_places')}</label>
          <textarea
            className={textarea}
            value={state.master.nearbyPlaces || ""}
            onChange={(e) => setState({ ...state, master: { ...state.master, nearbyPlaces: e.target.value } })}
            placeholder={t('placeholder_nearby')}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('location_note')}</label>
          <textarea
            className={textarea}
            value={state.master.locationNote || ""}
            onChange={(e) => setState({ ...state, master: { ...state.master, locationNote: e.target.value } })}
            placeholder={t('placeholder_location')}
          />
        </div>
      </div>
    </div>
  );
}
