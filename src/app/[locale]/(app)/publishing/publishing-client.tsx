"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type Unit = { id: string; name: string };
type Channel = "BOOKING" | "AIRBNB" | "AGODA";

type StatusRow = {
  channel: Channel;
  listingUrl: string | null;
  currentChecksum: string;
  lastChecksum: string | null;
  changed: boolean;
  lastPublishedAt: string | null;
  draft: { title: string; body: string };
};

const btn =
  "rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
}

function checklist(channel: Channel) {
  // Hardcoded English list for now, or could translate. 
  // Given user didn't provide translations for these large blocks in extraction, 
  // I will leave them as English or assume they are static instructions.
  // Actually, I can try to find them in JSON? 
  // No, I excluded them in the simplified JSON. 
  // I will leave them as is for now as they are specific instructions.
  if (channel === "BOOKING") {
    return [
      "Open Booking.com Extranet → Property → Description/Facilities",
      "Paste Title + Description + Amenities (if applicable)",
      "Double-check house rules + check-in/out text",
      "Save changes",
    ];
  }
  if (channel === "AIRBNB") {
    return [
      "Open Airbnb → Listings → Your listing",
      "Update Title + Description + Amenities",
      "Check House rules + Check-in/out instructions",
      "Publish/Save",
    ];
  }
  return [
    "Open Agoda YCS → Property",
    "Update Description + Highlights/Amenities",
    "Check rules + check-in/out",
    "Save",
  ];
}

export default function PublishingClient({ units }: { units: Unit[] }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Record<string, StatusRow[]>>({});
  const [msg, setMsg] = useState("");

  async function load() {
    setBusy(true);
    setMsg("");
    try {
      const out: Record<string, StatusRow[]> = {};
      for (const u of units) {
        const res = await fetch(`/api/publishing/status?unitId=${u.id}`, { cache: "no-store" });
        const data = await res.json();
        out[u.id] = data.current ?? [];
      }
      setRows(out);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markPublished(unitId: string, ch: Channel, checksum: string, draft: any) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          channel: ch,
          section: "CONTENT",
          checksum,
          snapshot: draft,
          note: "",
        }),
      });

      if (!res.ok) {
        setMsg(await res.text().catch(() => "Mark published failed"));
        return;
      }

      await load();
      setMsg(t('saved')); // Reusing saved/done
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {t('publishing_note')}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={load}
          className={`${btn} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900`}
        >
          {t('refresh')}
        </button>
      </div>

      {msg ? <div className="text-sm text-slate-700 dark:text-slate-200">{msg}</div> : null}

      <div className="space-y-4">
        {units.map((u) => {
          const r = rows[u.id] ?? [];
          return (
            <div key={u.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-base font-semibold">{u.name}</div>
                <Link
                  className="text-xs text-blue-700 hover:underline dark:text-blue-300"
                  href={`/content?unit=${u.id}`}
                >
                  {t('edit_content')}
                </Link>
              </div>

              {r.length === 0 ? (
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {t('no_channels')}
                </div>
              ) : (
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  {r.map((x) => (
                    <div key={x.channel} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{x.channel}</div>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] ${x.changed
                              ? "bg-amber-600/10 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200"
                              : "bg-emerald-600/10 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"
                            }`}
                        >
                          {x.changed ? "CHANGED" : "OK"}
                        </span>
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Last published: {x.lastPublishedAt ? x.lastPublishedAt : "never"}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}
                          onClick={() => copy(x.draft.body)}
                        >
                          {t('copy_draft')}
                        </button>

                        {x.listingUrl ? (
                          <a
                            className={`${btn} bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`}
                            href={x.listingUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('open_edit_page')}
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-3">
                        <div className="text-xs font-semibold">{t('checklist')}</div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] text-slate-600 dark:text-slate-400">
                          {checklist(x.channel).map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => markPublished(u.id, x.channel, x.currentChecksum, x.draft)}
                          className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}
                        >
                          {t('mark_published')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
