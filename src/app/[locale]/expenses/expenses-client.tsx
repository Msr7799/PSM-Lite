"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Unit = { id: string; name: string };

type Expense = {
  id: string;
  unitId: string;
  unitName: string;
  category: string;
  amount: string;
  currency: string;
  spentAt: string;
  note: string | null;
};

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";

const btn =
  "rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

export default function ExpensesClient({ units }: { units: Unit[] }) {
  const t = useTranslations();
  const [rows, setRows] = useState<Expense[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function refresh() {
    const res = await fetch("/api/expenses", { cache: "no-store" });
    const data = await res.json();
    setRows(data.expenses ?? []);
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        unitId: String(fd.get("unitId")),
        category: String(fd.get("category")),
        amount: String(fd.get("amount")),
        currency: String(fd.get("currency") || "BHD"),
        spentAt: String(fd.get("spentAt")),
        note: String(fd.get("note") || "").trim() || null,
      };

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setMsg(await res.text().catch(() => "Add failed"));
        return;
      }

      e.currentTarget.reset();
      await refresh();
      setMsg(t('saved'));
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    const ok = confirm("Delete this expense?");
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setMsg(await res.text().catch(() => "Delete failed"));
        return;
      }
      await refresh();
      setMsg(t('saved')); // Or 'deleted', reused saved for success
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid gap-2 md:grid-cols-6">
        <select name="unitId" className={`${input} md:col-span-2`} defaultValue={units[0]?.id ?? ""}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select name="category" className={input} defaultValue="CLEANING">
          <option value="CLEANING">{t('cleaning')}</option>
          <option value="MAINTENANCE">{t('maintenance')}</option>
          <option value="UTILITIES">{t('utilities')}</option>
          <option value="SUPPLIES">{t('supplies')}</option>
          <option value="STAFF">{t('staff')}</option>
          <option value="OTHER">{t('other')}</option>
        </select>

        <input name="amount" placeholder={t('amount')} className={input} required />
        <input name="currency" placeholder="BHD" className={input} defaultValue="BHD" />
        <input name="spentAt" type="date" className={input} required />

        <input name="note" placeholder={t('note')} className={`${input} md:col-span-5`} />

        <button disabled={busy} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500 md:col-span-1`}>
          {t('add')}
        </button>
      </form>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className={`${btn} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900`}
        >
          {t('refresh')}
        </button>
        {msg ? <div className="text-sm text-slate-700 dark:text-slate-300">{msg}</div> : null}
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-slate-600 dark:text-slate-400">{t('no_expenses')}</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950">
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('date')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('unit')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('category')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('amount')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('note')}</th>
                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/60">
                  <td className="border border-slate-200 p-2 dark:border-slate-700">{x.spentAt}</td>
                  <td className="border border-slate-200 p-2 dark:border-slate-700">{x.unitName}</td>
                  <td className="border border-slate-200 p-2 dark:border-slate-700">{t(x.category.toLowerCase())}</td>
                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    {x.amount} {x.currency}
                  </td>
                  <td className="border border-slate-200 p-2 dark:border-slate-700">{x.note ?? ""}</td>
                  <td className="border border-slate-200 p-2 dark:border-slate-700">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => del(x.id)}
                      className={`${btn} bg-rose-600 text-white hover:bg-rose-500`}
                    >
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
  );
}
