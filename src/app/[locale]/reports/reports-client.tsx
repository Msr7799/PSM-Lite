"use client";

import { useEffect, useState } from "react";

type Row = {
  month: string;
  bookingNet: number;
  expenses: number;
  profit: number;
};

const btn =
  "rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

export default function ReportsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      const data = await res.json();
      setRows(data.months ?? []);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Monthly summary</div>
        <button
          type="button"
          disabled={busy}
          onClick={load}
          className={`${btn} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900`}
        >
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-slate-600 dark:text-slate-400">No data yet.</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-[600px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950">
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">Month</th>
                <th className="border border-slate-200 p-2 text-right dark:border-slate-700">Booking net</th>
                <th className="border border-slate-200 p-2 text-right dark:border-slate-700">Expenses</th>
                <th className="border border-slate-200 p-2 text-right dark:border-slate-700">Profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/60">
                  <td className="border border-slate-200 p-2 dark:border-slate-700">{r.month}</td>
                  <td className="border border-slate-200 p-2 text-right dark:border-slate-700">{r.bookingNet.toFixed(3)}</td>
                  <td className="border border-slate-200 p-2 text-right dark:border-slate-700">{r.expenses.toFixed(3)}</td>
                  <td className="border border-slate-200 p-2 text-right dark:border-slate-700">
                    <span
                      className={
                        r.profit >= 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-rose-700 dark:text-rose-300"
                      }
                    >
                      {r.profit.toFixed(3)}
                    </span>
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
