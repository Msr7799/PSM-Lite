"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type Unit = { id: string; name: string; currency: string; defaultRate: string };
type Channel = "ALL" | "BOOKING" | "AIRBNB" | "AGODA";

type Rule = {
  id: string;
  channel: string | null;
  name: string;
  startDate: string;
  endDate: string;
  baseRate: string;
  weekendRate: string | null;
  minNights: number;
  maxNights: number | null;
  stopSell: boolean;
  daysOfWeek: number[] | null;
  priority: number;
  updatedAt: string;
};

type PreviewRow = {
  date: string;
  status: "OPEN" | "CLOSED";
  rate: string | null;
  minNights: number | null;
  maxNights: number | null;
  rule: string | null;
  // added to avoid ts error if useful, logic stays same
};

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";
const btn =
  "rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

function todayPlus(days: number) {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RatesClient({ units }: { units: Unit[] }) {
  const t = useTranslations();
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [channel, setChannel] = useState<Channel>("ALL");
  const [rules, setRules] = useState<Rule[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const unit = useMemo(() => units.find((u) => u.id === unitId), [unitId, units]);

  const week = [
    { v: 0, l: t('days_of_week') ? "Sun" : "Sun" }, // User didn't give me short day names translations, I'll stick to English or simple hardcoding if needed. 
    // Actually standard convention is keep small code or English for technical or verify if I have keys.
    // I don't have day names in JSON. I will leave them as English.
    { v: 1, l: "Mon" },
    { v: 2, l: "Tue" },
    { v: 3, l: "Wed" },
    { v: 4, l: "Thu" },
    { v: 5, l: "Fri" },
    { v: 6, l: "Sat" },
  ];

  useEffect(() => {
    if (!unitId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  async function load() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/rates?unitId=${unitId}`, { cache: "no-store" });
      const data = await res.json();
      setRules(data.rules ?? []);
      await loadPreview();
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview() {
    if (!unitId) return;
    const qs = new URLSearchParams({ unitId, days: "60" });
    if (channel !== "ALL") qs.set("channel", channel);
    const res = await fetch(`/api/rates/preview?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setPreview(data.preview ?? []);
    setCsv(data.csv ?? "");
  }

  async function addRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!unitId) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData(e.currentTarget);
      const payload: any = {
        unitId,
        channel: fd.get("channel") === "ALL" ? null : String(fd.get("channel")),
        name: String(fd.get("name") || "").trim(),
        startDate: String(fd.get("startDate") || ""),
        endDate: String(fd.get("endDate") || ""),
        baseRate: String(fd.get("baseRate") || ""),
        weekendRate: String(fd.get("weekendRate") || "") || null,
        minNights: Number(fd.get("minNights") || 1),
        maxNights: String(fd.get("maxNights") || "") ? Number(fd.get("maxNights")) : null,
        stopSell: Boolean(fd.get("stopSell")),
        priority: Number(fd.get("priority") || 0),
      };

      const dow = Array.from(fd.getAll("dow")).map((x) => Number(x));
      payload.daysOfWeek = dow.length ? dow : null;

      if (!payload.name) {
        setMsg("Name required");
        return;
      }

      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setMsg(await res.text().catch(() => "Add rule failed"));
        return;
      }

      e.currentTarget.reset();
      setMsg(t('saved')); // reusing saved/done
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    const ok = confirm("Delete this rule?");
    if (!ok) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/rates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setMsg(await res.text().catch(() => "Delete failed"));
        return;
      }
      await load();
      setMsg(t('saved'));
    } finally {
      setBusy(false);
    }
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

        <div className="min-w-[180px]">
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('preview_channel')}</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className={input}>
            <option value="ALL">ALL</option>
            <option value="BOOKING">BOOKING</option>
            <option value="AIRBNB">AIRBNB</option>
            <option value="AGODA">AGODA</option>
          </select>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={loadPreview}
          className={`${btn} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900`}
        >
          {t('refresh_preview')}
        </button>

        <button
          type="button"
          disabled={!csv}
          onClick={() => download(`rates_${unit?.name ?? "unit"}.csv`, csv)}
          className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}
        >
          {t('export_csv')}
        </button>

        {msg ? <div className="text-sm text-slate-700 dark:text-slate-200">{msg}</div> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="text-sm font-semibold">{t('add_rule')}</div>
        <form onSubmit={addRule} className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('channel')}</label>
            <select name="channel" className={input} defaultValue="ALL">
              <option value="ALL">{t('all')}</option>
              <option value="BOOKING">BOOKING</option>
              <option value="AIRBNB">AIRBNB</option>
              <option value="AGODA">AGODA</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('name')}</label>
            <input name="name" className={input} placeholder={t('promo_placeholder')} />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('priority')}</label>
            <input name="priority" type="number" className={input} defaultValue={0} />
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('start')}</label>
            <input name="startDate" type="date" className={input} defaultValue={todayPlus(0)} />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('end_exclusive')}</label>
            <input name="endDate" type="date" className={input} defaultValue={todayPlus(30)} />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">
              {t('rate')} ({unit?.currency ?? "BHD"})
            </label>
            <input name="baseRate" className={input} placeholder={unit?.defaultRate || "e.g. 45.000"} />
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('weekend_rate')}</label>
            <input name="weekendRate" className={input} placeholder="e.g. 123.450" />
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('min_nights')}</label>
            <input name="minNights" type="number" className={input} defaultValue={1} />
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('max_nights')}</label>
            <input name="maxNights" type="number" className={input} placeholder={t('optional')} />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs text-slate-600 dark:text-slate-300">{t('days_of_week')}</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {week.map((d) => (
                <label key={d.v} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                  <input type="checkbox" name="dow" value={d.v} />
                  {d.l}
                </label>
              ))}
              <label className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <input type="checkbox" name="stopSell" value="1" />
                {t('stop_sell')}
              </label>
            </div>
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button disabled={busy} className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>
              {t('add')}
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{t('rules')}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{rules.length} rules</div>
          </div>

          {rules.length === 0 ? (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('no_rules')}</div>
          ) : (
            <div className="mt-3 overflow-auto">
              <table className="min-w-[720px] w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950">
                    <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('name')}</th>
                    <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('range')}</th>
                    <th className="border border-slate-200 p-2 text-right dark:border-slate-700">{t('rate')}</th>
                    <th className="border border-slate-200 p-2 text-center dark:border-slate-700">{t('min')}</th>
                    <th className="border border-slate-200 p-2 text-center dark:border-slate-700">{t('close')}</th>
                    <th className="border border-slate-200 p-2 text-center dark:border-slate-700">{t('del')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/60">
                      <td className="border border-slate-200 p-2 dark:border-slate-700">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {r.channel ?? "ALL"} · prio {r.priority}
                        </div>
                      </td>
                      <td className="border border-slate-200 p-2 dark:border-slate-700">
                        {r.startDate} → {r.endDate}
                        {r.daysOfWeek?.length ? (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            DOW: {r.daysOfWeek.join(",")}
                          </div>
                        ) : null}
                      </td>
                      <td className="border border-slate-200 p-2 text-right dark:border-slate-700">
                        {r.stopSell ? "-" : r.baseRate}
                        {r.weekendRate ? (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            weekend: {r.weekendRate}
                          </div>
                        ) : null}
                      </td>
                      <td className="border border-slate-200 p-2 text-center dark:border-slate-700">
                        {r.minNights}
                      </td>
                      <td className="border border-slate-200 p-2 text-center dark:border-slate-700">
                        {r.stopSell ? "YES" : "NO"}
                      </td>
                      <td className="border border-slate-200 p-2 text-center dark:border-slate-700">
                        <button type="button" className="text-rose-600 hover:underline" onClick={() => del(r.id)}>
                          {t('delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{t('preview_next_60')}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              fallback: {unit?.defaultRate || "none"} {unit?.currency}
            </div>
          </div>

          {preview.length === 0 ? (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('no_preview')}</div>
          ) : (
            <div className="mt-3 overflow-auto">
              <table className="min-w-[520px] w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950">
                    <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('date')}</th>
                    <th className="border border-slate-200 p-2 text-center dark:border-slate-700">{t('status')}</th>
                    <th className="border border-slate-200 p-2 text-right dark:border-slate-700">{t('rate')}</th>
                    <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('rule')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.date} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/60">
                      <td className="border border-slate-200 p-2 dark:border-slate-700">{p.date}</td>
                      <td className="border border-slate-200 p-2 text-center dark:border-slate-700">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] ${p.status === "OPEN"
                            ? "bg-emerald-600/10 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"
                            : "bg-rose-600/10 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200"
                            }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="border border-slate-200 p-2 text-right dark:border-slate-700">
                        {p.rate ?? "-"}
                      </td>
                      <td className="border border-slate-200 p-2 dark:border-slate-700">
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">{p.rule ?? ""}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {t('rule_note_1')} <b>{t('rule_note_2')}</b> {t('rule_note_3')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
