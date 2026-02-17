"use client";

import { useMemo, useState } from "react";
import { useTranslations } from 'next-intl';

type Unit = { id: string; name: string };

type Booking = {
  id: string;
  unitId: string;
  unitName: string;
  channel: string;
  startDate: string;
  endDate: string;
  currency: string;
  grossAmount: string | null;
  commissionAmount: string | null;
  taxAmount: string | null;
  otherFeesAmount: string | null;
  netAmount: string | null;
  paymentStatus: string;
  notes: string | null;
};

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";

const btn =
  "rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

export default function BookingsClient({ units }: { units: Unit[] }) {
  const t = useTranslations();
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const title = useMemo(() => {
    const u = units.find((x) => x.id === unitId);
    return u ? `${t('bookings')} ${t('for')}: ${u.name}` : t('bookings');
  }, [unitId, units, t]);

  async function load() {
    setBusy(true);
    setMsg("");
    try {
      const qs = new URLSearchParams();
      if (unitId) qs.set("unitId", unitId);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const res = await fetch(`/api/bookings?${qs.toString()}`, { cache: "no-store" });
      const out = await res.json();
      setRows(out.bookings ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function save(b: Booking, patch: Partial<Booking>) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        setMsg(await res.text().catch(() => "Save failed"));
        return;
      }

      const out = await res.json();
      const updated = out.booking;

      setRows((prev) =>
        prev.map((x) =>
          x.id === b.id
            ? {
              ...x,
              ...patch,
              grossAmount: updated.grossAmount,
              commissionAmount: updated.commissionAmount,
              taxAmount: updated.taxAmount,
              otherFeesAmount: updated.otherFeesAmount,
              netAmount: updated.netAmount,
              paymentStatus: updated.paymentStatus,
              notes: updated.notes,
            }
            : x
        )
      );

      setMsg(t('saved')); // Assume 'saved' key exists or use hardcoded check
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px]">
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('unit')}</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={input}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('from')}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-300">{t('to')}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
        </div>

        <button onClick={load} disabled={busy} className={`${btn} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900`}>
          {t('load')}
        </button>
      </div>

      {msg ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          {msg}
        </div>
      ) : null}

      <div className="text-sm font-semibold">{title}</div>

      {rows.length === 0 ? (
        <div className="text-sm text-slate-600 dark:text-slate-400">{t('no_bookings')}</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950">
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('dates')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('channel')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('gross')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('commission')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('taxes')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('fees')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('net')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('paid')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('notes')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/60">
                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      {b.startDate} → {b.endDate}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{b.unitName}</div>
                  </td>
                  <td className="border border-slate-200 p-2 dark:border-slate-700">{b.channel}</td>

                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <input
                      className={input}
                      defaultValue={b.grossAmount ?? ""}
                      placeholder={b.currency}
                      onBlur={(e) => save(b, { grossAmount: e.target.value || null })}
                    />
                  </td>

                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <input
                      className={input}
                      defaultValue={b.commissionAmount ?? ""}
                      placeholder={b.currency}
                      onBlur={(e) => save(b, { commissionAmount: e.target.value || null })}
                    />
                  </td>

                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <input
                      className={input}
                      defaultValue={b.taxAmount ?? ""}
                      placeholder={b.currency}
                      onBlur={(e) => save(b, { taxAmount: e.target.value || null })}
                    />
                  </td>

                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <input
                      className={input}
                      defaultValue={b.otherFeesAmount ?? ""}
                      placeholder={b.currency}
                      onBlur={(e) => save(b, { otherFeesAmount: e.target.value || null })}
                    />
                  </td>

                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <input
                      className={input}
                      defaultValue={b.netAmount ?? ""}
                      placeholder={b.currency}
                      onBlur={(e) => save(b, { netAmount: e.target.value || null })}
                    />
                    <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      {t('leave_empty')}
                    </div>
                  </td>

                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <select
                      className={input}
                      defaultValue={b.paymentStatus}
                      onChange={(e) => save(b, { paymentStatus: e.target.value })}
                    >
                      <option value="UNPAID">{t('unpaid')}</option>
                      <option value="PARTIAL">{t('partial')}</option>
                      <option value="PAID">{t('paid')}</option>
                    </select>
                  </td>

                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <input
                      className={input}
                      defaultValue={b.notes ?? ""}
                      placeholder="..."
                      onBlur={(e) => save(b, { notes: e.target.value || null })}
                    />
                  </td>

                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => save(b, {})}
                      className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}
                    >
                      {t('recalc')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
