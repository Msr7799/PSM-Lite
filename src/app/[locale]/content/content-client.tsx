"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from 'next-intl';

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

  const [state, setState] = useState<ContentState | null>(null);

  const stateRef = useRef<ContentState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);


  useEffect(() => {
    if (!unitId) return;
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
          body: JSON.stringify({ publicUrl: url, forcePreview: true }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Server-side scraping failed (challenge page, etc.) → show paste fallback
          setMsg(t("scrape_failed_paste_fallback"));
          setShowPasteHtml(true);
          return;
        }

        const p = data?.preview;
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
          </div>

          {state.externalData.description && (
            <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2 text-xs">
              <div className="font-medium text-slate-500 dark:text-slate-400">{t('description')}</div>
              <div className="mt-0.5 text-slate-800 dark:text-slate-200 line-clamp-3">{state.externalData.description}</div>
            </div>
          )}

          {state.externalData.nearbyPlaces && (
            <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2 text-xs">
              <div className="font-medium text-slate-500 dark:text-slate-400">{t('nearby_places')}</div>
              <div className="mt-0.5 text-slate-800 dark:text-slate-200 line-clamp-3 whitespace-pre-line">{state.externalData.nearbyPlaces}</div>
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
              <div className="grid grid-cols-6 gap-1.5">
                {state.master.images.slice(0, 18).map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                    <img src={src} className="h-full w-full object-cover" loading="lazy" />
                  </a>
                ))}
                {state.master.images.length > 18 && (
                  <div className="flex items-center justify-center aspect-square rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">
                    +{state.master.images.length - 18}
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
