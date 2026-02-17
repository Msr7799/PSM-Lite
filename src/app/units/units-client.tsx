"use client";

import { useEffect, useMemo, useState } from "react";

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

const card =
  "rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80";

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";

const buttonBase =
  "rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

export default function UnitsClient({ initialUnits }: { initialUnits: Unit[] }) {
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [icsFiles, setIcsFiles] = useState<string[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({}); // per unit

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
        : "Tip: If you provide both URL and file, file wins.",
    [hasPublicIcs]
  );

  async function refresh() {
    const res = await fetch("/api/units", { cache: "no-store" });
    const data = await res.json();
    setUnits(data.units);
  }

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
      setMsg("Unit added ✅");
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
        const t = await res.text().catch(() => "");
        setMsg(t || "Add feed failed.");
        return;
      }

      form.reset();
      await refresh();
      setMsg("Feed added ✅");
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

    // default channel OTHER for quick add; user can change later
    const payload = { unitId, channel: "OTHER", type: "URL", url: `/ics/${file}`, name: file };

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        setMsg(t || "Add feed failed.");
        return;
      }

      await refresh();
      setMsg("Public .ics linked ✅ (Now hit Sync now)");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUnit(unitId: string) {
    const ok = confirm("Delete this unit? This will remove its feeds/bookings/expenses.");
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/units/${unitId}`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        setMsg(t || "Delete unit failed.");
        return;
      }
      await refresh();
      setMsg("Unit deleted ✅");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFeed(feedId: string) {
    const ok = confirm("Delete this calendar feed? (It will also purge bookings for this channel).\nThen hit Sync now.");
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/feeds/${feedId}?purge=1`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        setMsg(t || "Delete feed failed.");
        return;
      }
      await refresh();
      setMsg("Feed deleted ✅ (Now hit Sync now)");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) {
        setMsg("Sync failed.");
        return;
      }
      await refresh();
      setMsg("Synced ✅");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Manage</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{tips}</p>
        </div>
        <button
          onClick={syncNow}
          disabled={busy}
          className={`${buttonBase} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200`}
          type="button"
        >
          Sync now
        </button>
      </div>

      {msg ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          {msg}
        </div>
      ) : null}

      <form onSubmit={createUnit} className="mt-4 grid gap-2 md:grid-cols-3">
        <input name="name" placeholder="Unit name (e.g. Apt 1)" className={input} required />
        <input name="code" placeholder="Code (optional)" className={input} />
        <button
          disabled={busy}
          className={`${buttonBase} bg-blue-600 text-white hover:bg-blue-500`}
        >
          Add unit
        </button>
      </form>

      <div className="mt-6 space-y-6">
        {units.map((u) => (
          <div key={u.id} className={`${card} bg-white dark:bg-slate-900`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{u.name}</div>
                {u.code ? <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{u.code}</div> : null}
              </div>

              <button
                disabled={busy}
                onClick={() => deleteUnit(u.id)}
                className={`${buttonBase} bg-rose-600 text-white hover:bg-rose-500`}
                type="button"
              >
                Delete unit
              </button>
            </div>

            {hasPublicIcs ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                <div className="text-sm font-medium">Quick add from public/ics</div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <select
                    className={input}
                    value={pick[u.id] ?? ""}
                    onChange={(e) => setPick((m) => ({ ...m, [u.id]: e.target.value }))}
                  >
                    <option value="">Select .ics file…</option>
                    {icsFiles.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>

                  <div className="md:col-span-2 flex items-center gap-2">
                    <code className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {pick[u.id] ? `/ics/${pick[u.id]}` : "/ics/<file>.ics"}
                    </code>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => addPublicIcsAsUrl(u.id)}
                      className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-500`}
                    >
                      Add
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Note: quick add uses channel OTHER by default. You can delete/re-add with the right channel if you want.
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="text-sm font-medium">Feeds</div>

              <ul className="mt-2 space-y-2">
                {u.feeds.length === 0 ? (
                  <li className="text-sm text-slate-600 dark:text-slate-400">No feeds yet.</li>
                ) : (
                  u.feeds.map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs ${channelBadge(f.channel)}`}>{f.channel}</span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                          {f.type}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {f.lastSyncAt
                            ? `last sync: ${new Date(f.lastSyncAt).toLocaleString()}`
                            : "never synced"}
                        </span>
                        {f.name ? <span className="text-xs text-slate-500 dark:text-slate-400">{f.name}</span> : null}
                        {f.url ? (
                          <a
                            className="text-xs text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            open
                          </a>
                        ) : null}
                      </div>

                      <button
                        disabled={busy}
                        onClick={() => deleteFeed(f.id)}
                        className={`${buttonBase} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200`}
                        type="button"
                      >
                        Delete feed
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <form onSubmit={(e) => addFeed(e, u.id)} className="mt-4 grid gap-2 md:grid-cols-4">
              <select name="channel" className={input} defaultValue="BOOKING">
                <option value="BOOKING">BOOKING</option>
                <option value="AIRBNB">AIRBNB</option>
                <option value="AGODA">AGODA</option>
                <option value="MANUAL">MANUAL</option>
                <option value="OTHER">OTHER</option>
              </select>

              <input name="url" placeholder="iCal URL (or /ics/file.ics)" className={`${input} md:col-span-2`} />

              <input type="file" name="file" accept=".ics,text/calendar" className={input} />

              <button disabled={busy} className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-500 md:col-span-4`}>
                Add feed (URL or file)
              </button>
            </form>

            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Tip: If you provide both URL and file, file wins.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
