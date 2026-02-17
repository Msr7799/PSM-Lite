"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslations } from "next-intl";

type Channel = "BOOKING" | "AIRBNB" | "AGODA" | "MANUAL" | "OTHER";
type FeedType = "URL" | "INLINE";

type Feed = {
  id: string;
  channel: Channel;
  type: FeedType;
  name: string | null;
  url: string | null;
  lastSyncAt: string | null;
};

type Unit = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  currency: string;
  defaultRate: string | null;
  ogImage: string | null;
  ogTitle: string | null;
  bookingPublicUrl: string | null;
  listings: Array<{
    id: string;
    channel: Channel;
    url: string;
  }>;
  feeds: Feed[];
};

const channelBadge = (c: Channel) => {
  const map: Record<Channel, string> = {
    BOOKING: "bg-indigo-600 text-white",
    AIRBNB: "bg-rose-600 text-white",
    AGODA: "bg-emerald-600 text-white",
    MANUAL: "bg-slate-800 text-white",
    OTHER: "bg-slate-500 text-white",
  };
  return map[c] ?? "bg-slate-500 text-white";
};

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 transition-colors";

const buttonBase =
  "rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200";

export default function UnitsClient({ initialUnits }: { initialUnits: Unit[] }) {
  const t = useTranslations();
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [icsFiles, setIcsFiles] = useState<string[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({}); // per unit
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ics-files", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setIcsFiles(Array.isArray(d.files) ? d.files : []))
      .catch(() => setIcsFiles([]));
  }, []);

  const hasPublicIcs = icsFiles.length > 0;

  const tips = useMemo(
    () =>
      hasPublicIcs
        ? "Tip: You can quickly use files from /public/ics as URL (/ics/filename.ics)."
        : t("feed_tip"),
    [hasPublicIcs, t]
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/units", { cache: "no-store" });
    const data = await res.json();
    setUnits(data.units);
  }, []);

  async function createUnit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");

    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const code = String(fd.get("code") || "").trim();

    if (!name) {
      setMsg("Unit name is required.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        body: JSON.stringify({ name, code }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        setMsg(await res.text().catch(() => "Add unit failed."));
        return;
      }

      form.reset();
      await refresh();
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function addFeed(e: React.FormEvent<HTMLFormElement>, unitId: string) {
    e.preventDefault();
    setMsg("");

    const form = e.currentTarget;
    const fd = new FormData(form);

    const channel = String(fd.get("channel") || "OTHER");
    const url = String(fd.get("url") || "").trim();
    const file = fd.get("file") as File | null;

    let payload: any = { unitId, channel };

    setBusy(true);
    try {
      if (file && file.size > 0) {
        const text = await file.text();
        payload.type = "INLINE";
        payload.icsText = text;
        payload.name = file.name;
      } else {
        payload.type = "URL";
        payload.url = url;
        payload.name = null;

        if (!payload.url) {
          setMsg("Please provide iCal URL or upload .ics file.");
          return;
        }
      }

      const res = await fetch("/api/feeds", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setMsg(errText || "Add feed failed.");
        return;
      }

      form.reset();
      await refresh();
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function importFromUrl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");

    const form = e.currentTarget;
    const fd = new FormData(form);
    const url = String(fd.get("url") || "").trim();

    if (!url) return;

    setBusy(true);
    try {
      const res = await fetch("/api/units/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      if (!res.ok) {
        const err = await res.text();
        setMsg("Import failed: " + err);
        return;
      }

      form.reset();
      await refresh();
      setMsg("Unit imported successfully! 🚀");
    } catch (e) {
      setMsg("Import error: " + String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addPublicIcsAsUrl(unitId: string) {
    const file = pick[unitId];
    if (!file) {
      setMsg("Pick a public .ics file first.");
      return;
    }

    const payload = {
      unitId,
      channel: "OTHER",
      type: "URL",
      url: `/ics/${file}`,
      name: file,
    };

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setMsg(errText || "Add feed failed.");
        return;
      }

      await refresh();
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  function patchUnitLocal(unitId: string, patch: Partial<Unit>) {
    setUnits((prev) =>
      prev.map((u) => (u.id === unitId ? { ...u, ...patch } : u))
    );
  }

  async function saveUnit(unitId: string) {
    const u = units.find((x) => x.id === unitId);
    if (!u) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: u.name,
          code: u.code,
          isActive: u.isActive,
          currency: u.currency,
          defaultRate: u.defaultRate,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setMsg(errText || "Save unit failed.");
        return;
      }

      await refresh();
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteUnit(unitId: string) {
    const ok = confirm(
      "Delete this unit? This will remove its feeds/bookings/expenses."
    );
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/units/${unitId}`, { method: "DELETE" });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setMsg(errText || "Delete unit failed.");
        return;
      }
      setExpandedId(null);
      await refresh();
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteFeed(feedId: string) {
    const ok = confirm(
      "Delete this calendar feed? (It will also purge bookings for this channel).\nThen hit Sync now."
    );
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/feeds/${feedId}?purge=1`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setMsg(errText || "Delete feed failed.");
        return;
      }
      await refresh();
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function syncNow(unitId?: string) {
    setBusy(true);
    setMsg("");
    try {
      // If unitId is click event (from default button behavior), ignore it
      const payload = typeof unitId === 'string' ? { unitId } : {};

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        setMsg("Sync failed.");
        return;
      }
      await refresh();
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function fetchPreview(unitId: string, publicUrl: string) {
    setFetchingPreview(unitId);
    try {
      await fetch("/api/booking/public-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: publicUrl }),
      });
      await refresh();
    } catch {
    } finally {
      setFetchingPreview(null);
    }
  }

  async function addListing(e: React.FormEvent<HTMLFormElement>, unitId: string) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    const fd = new FormData(e.currentTarget);
    const url = String(fd.get("url") || "").trim();
    const channel = String(fd.get("channel") || "BOOKING");

    if (!url) return;

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, url, channel })
      });
      if (!res.ok) throw new Error(await res.text());

      await refresh();
      setMsg("Listing added & preview fetched!");
      e.currentTarget.reset();
    } catch (e) {
      setMsg("Error: " + String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteListing(id: string) {
    if (!confirm("Remove this listing link?")) return;
    setBusy(true);
    try {
      await fetch(`/api/listings?id=${id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setMsg("Error: " + String(e));
    } finally {
      setBusy(false);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Top bar: manage + sync */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("manage")}</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {tips}
            </p>
          </div>
          <button
            onClick={() => syncNow()}
            disabled={busy}
            className={`${buttonBase} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200`}
            type="button"
          >
            {t("sync_now")}
          </button>
        </div>

        {msg ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
            {msg}
          </div>
        ) : null}

        {/* Add unit form */}
        <form onSubmit={createUnit} className="mt-4 grid gap-2 md:grid-cols-3">
          <input
            name="name"
            placeholder={t("unit_name_placeholder")}
            className={input}
            required
          />
          <input
            name="code"
            placeholder={t("code_optional")}
            className={input}
          />
          <button
            disabled={busy}
            className={`${buttonBase} bg-blue-600 text-white hover:bg-blue-500`}
          >
            {t("add_unit")}
          </button>
        </form>

        {/* Import from URL */}
        <form onSubmit={importFromUrl} className="mt-4 flex gap-2">
          <input
            name="url"
            type="url"
            placeholder="Or paste Booking.com URL to auto-import..."
            className={`${input} flex-1`}
            required
          />
          <button
            disabled={busy}
            className={`${buttonBase} bg-indigo-600 text-white hover:bg-indigo-500 whitespace-nowrap`}
          >
            📥 Import Booking
          </button>
        </form>
      </div>

      {/* Units Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {units.map((u) => {
          const isExpanded = expandedId === u.id;
          return (
            <div
              key={u.id}
              className={`group flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-lg ${isExpanded
                ? "sm:col-span-2 lg:col-span-3 xl:col-span-4 border-blue-400 dark:border-blue-500 shadow-blue-100 dark:shadow-blue-900/20"
                : "border-slate-200 dark:border-slate-700"
                } bg-white dark:bg-slate-900`}
            >
              {/* Card Header - always visible */}
              <div
                className="cursor-pointer"
                onClick={() => toggleExpand(u.id)}
              >
                {/* Image area */}
                {u.ogImage ? (
                  <div className="relative h-36 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={u.ogImage}
                      alt={u.ogTitle ?? u.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {/* Active badge */}
                    <span
                      className={`absolute top-2 end-2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow ${u.isActive
                        ? "bg-emerald-500 text-white"
                        : "bg-red-500 text-white"
                        }`}
                    >
                      {u.isActive ? t("active") : "⏸"}
                    </span>
                    {/* Name on image */}
                    <div className="absolute bottom-0 start-0 end-0 p-3">
                      <h3 className="text-sm font-bold text-white drop-shadow-lg leading-tight">
                        {u.name}
                      </h3>
                      {u.code && (
                        <span className="text-[10px] text-white/80">
                          {u.code}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                    {/* If there's a bookingPublicUrl, show fetch button */}
                    {u.bookingPublicUrl ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchPreview(u.id, u.bookingPublicUrl!);
                        }}
                        disabled={fetchingPreview === u.id}
                        className="rounded-lg bg-blue-600/90 px-3 py-1.5 text-xs text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {fetchingPreview === u.id
                          ? "⏳ ..."
                          : "📷 " + t("refresh_preview")}
                      </button>
                    ) : (
                      <span className="text-3xl">🏨</span>
                    )}
                    {/* Active badge */}
                    <span
                      className={`absolute top-2 end-2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow ${u.isActive
                        ? "bg-emerald-500 text-white"
                        : "bg-red-500 text-white"
                        }`}
                    >
                      {u.isActive ? t("active") : "⏸"}
                    </span>
                    <div className="absolute bottom-0 start-0 end-0 p-3">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                        {u.name}
                      </h3>
                      {u.code && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {u.code}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick info bar */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      💰 {u.defaultRate ?? "—"} {u.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {u.feeds.length > 0 ? (
                      u.feeds
                        .slice(0, 3)
                        .map((f) => (
                          <span
                            key={f.id}
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${channelBadge(
                              f.channel
                            )}`}
                          >
                            {f.channel}
                          </span>
                        ))
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        {t("no_feeds")}
                      </span>
                    )}
                    {u.feeds.length > 3 && (
                      <span className="text-[9px] text-slate-400">
                        +{u.feeds.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Expand icon */}
                  <svg
                    className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""
                      }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Expanded Settings Panel */}
              {isExpanded && (
                <div className="animate-in slide-in-from-top-2 duration-300 border-t border-slate-100 dark:border-slate-800">
                  {/* Unit Settings */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        ⚙️ {t("manage")}
                      </h4>
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            syncNow(u.id);
                          }}
                          className={`${buttonBase} bg-indigo-600 text-white hover:bg-indigo-500 text-xs`}
                          type="button"
                        >
                          ↻ {t("sync_now")}
                        </button>
                        <button
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteUnit(u.id);
                          }}
                          className={`${buttonBase} bg-rose-600 text-white hover:bg-rose-500 text-xs`}
                          type="button"
                        >
                          {t("delete_unit")}
                        </button>
                      </div>
                    </div>

                    {/* Settings Grid */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                          {t("name")}
                        </label>
                        <input
                          className={input}
                          value={u.name}
                          onChange={(e) =>
                            patchUnitLocal(u.id, { name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                          {t("code_optional")}
                        </label>
                        <input
                          className={input}
                          value={u.code ?? ""}
                          onChange={(e) =>
                            patchUnitLocal(u.id, {
                              code: e.target.value || null,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                          {t("currency")}
                        </label>
                        <input
                          className={input}
                          value={u.currency}
                          onChange={(e) =>
                            patchUnitLocal(u.id, { currency: e.target.value })
                          }
                          placeholder="BHD"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                          {t("default_rate")}
                        </label>
                        <input
                          className={input}
                          value={u.defaultRate ?? ""}
                          onChange={(e) =>
                            patchUnitLocal(u.id, {
                              defaultRate: e.target.value,
                            })
                          }
                          placeholder="e.g. 45.000"
                        />
                      </div>
                    </div>

                    {/* Active toggle + Save */}
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={u.isActive}
                          onChange={(e) =>
                            patchUnitLocal(u.id, {
                              isActive: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {t("active")}
                      </label>

                      <button
                        disabled={busy}
                        onClick={() => saveUnit(u.id)}
                        className={`${buttonBase} bg-blue-600 text-white hover:bg-blue-500`}
                        type="button"
                      >
                        {t("save")}
                      </button>
                    </div>
                  </div>

                  {/* Public Listings (Booking, Airbnb, etc.) */}
                  <div className="mx-4 mb-4 rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="text-sm font-medium mb-2 text-blue-900 dark:text-blue-100">
                      🌍 {t("public_listings")} <span className="text-[10px] font-normal opacity-70">({t("for_photos_info")})</span>
                    </div>

                    <div className="space-y-2 mb-3">
                      {u.listings?.map(l => (
                        <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 text-sm shadow-sm dark:bg-slate-900">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${channelBadge(l.channel)}`}>{l.channel}</span>
                            <a href={l.url} target="_blank" className="truncate text-blue-600 hover:underline dark:text-blue-400 max-w-[200px] md:max-w-xs">{l.url}</a>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              title="Fetch info now"
                              onClick={() => fetchPreview(u.id, l.url)}
                              disabled={fetchingPreview === u.id}
                              className="text-slate-400 hover:text-blue-500"
                            >
                              📷
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteListing(l.id)}
                              className="text-slate-400 hover:text-red-500"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={(e) => addListing(e, u.id)} className="flex gap-2">
                      <select name="channel" className="rounded-lg border border-slate-200 text-sm p-2 w-28 bg-white dark:bg-slate-800 dark:border-slate-700">
                        <option value="BOOKING">Booking</option>
                        <option value="AIRBNB">Airbnb</option>
                        <option value="AGODA">Agoda</option>
                      </select>
                      <input
                        name="url"
                        placeholder="Paste property listing URL..."
                        required
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">
                        +
                      </button>
                    </form>
                  </div>

                  {/* Quick Add from public ics */}
                  {hasPublicIcs && (
                    <div className="mx-4 mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                      <div className="text-sm font-medium">{t("quick_add")}</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        <select
                          className={input}
                          value={pick[u.id] ?? ""}
                          onChange={(e) =>
                            setPick((m) => ({ ...m, [u.id]: e.target.value }))
                          }
                        >
                          <option value="">{t("select_ics")}</option>
                          {icsFiles.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>

                        <div className="md:col-span-2 flex items-center gap-2">
                          <code className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            {pick[u.id]
                              ? `/ics/${pick[u.id]}`
                              : "/ics/<file>.ics"}
                          </code>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => addPublicIcsAsUrl(u.id)}
                            className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-500`}
                          >
                            {t("add")}
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        {t("quick_add_note")}
                      </p>
                    </div>
                  )}

                  {/* Feeds Section */}
                  <div className="px-4 pb-4">
                    <div className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200">
                      📡 {t("feeds")}
                    </div>

                    {u.feeds.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t("no_feeds")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {u.feeds.map((f) => (
                          <div
                            key={f.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-950"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${channelBadge(
                                  f.channel
                                )}`}
                              >
                                {f.channel}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                                {f.type}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {f.lastSyncAt
                                  ? `🕐 ${new Date(f.lastSyncAt).toLocaleString()}`
                                  : "never synced"}
                              </span>
                              {f.name && (
                                <span className="text-[10px] text-slate-400">
                                  {f.name}
                                </span>
                              )}
                              {f.url && (
                                <a
                                  className="text-[10px] text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                                  href={f.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {t("open")}
                                </a>
                              )}
                            </div>

                            <button
                              disabled={busy}
                              onClick={() => deleteFeed(f.id)}
                              className={`${buttonBase} text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200`}
                              type="button"
                            >
                              {t("delete_feed")}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add feed form */}
                    <form
                      onSubmit={(e) => addFeed(e, u.id)}
                      className="mt-3 grid gap-2 md:grid-cols-4"
                    >
                      <select
                        name="channel"
                        className={input}
                        defaultValue="BOOKING"
                      >
                        <option value="BOOKING">BOOKING</option>
                        <option value="AIRBNB">AIRBNB</option>
                        <option value="AGODA">AGODA</option>
                        <option value="MANUAL">{t("manual")}</option>
                        <option value="OTHER">{t("other")}</option>
                      </select>

                      <input
                        name="url"
                        placeholder={t("ical_url_placeholder")}
                        className={`${input} md:col-span-2`}
                      />

                      <input
                        type="file"
                        name="file"
                        accept=".ics,text/calendar"
                        className={input}
                      />

                      <button
                        disabled={busy}
                        className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-500 md:col-span-4`}
                      >
                        {t("add_feed")}
                      </button>
                    </form>

                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {t("feed_tip")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {units.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
          <span className="text-4xl">🏨</span>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {t("no_units")}
          </p>
        </div>
      )}
    </div>
  );
}
