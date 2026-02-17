"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type Unit = { id: string; name: string };
type Channel = "BOOKING" | "AIRBNB" | "AGODA" | "OTHER" | "MANUAL";

type Booking = {
  id: string;
  unitId: string;
  unitName: string;
  channel: Channel;
  startDate: string;
  endDate: string;
  netAmount: string | null;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
};

type PayoutLine = {
  id: string;
  bookingId: string | null;
  amount: string;
  note: string | null;
  booking: null | {
    id: string;
    unitName: string;
    startDate: string;
    endDate: string;
    netAmount: string | null;
    paymentStatus: string;
  };
};

type Payout = {
  id: string;
  channel: Channel;
  payoutDate: string;
  currency: string;
  amount: string;
  providerRef: string | null;
  status: "PENDING" | "RECEIVED";
  note: string | null;
  lines: PayoutLine[];
};

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";
const btn =
  "rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

function sum(lines: { amount: string }[]) {
  return lines.reduce((acc, x) => acc + Number(x.amount || 0), 0);
}

export default function PayoutsClient({ units }: { units: Unit[] }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selectedPayoutId, setSelectedPayoutId] = useState<string>("");

  const [filterUnitId, setFilterUnitId] = useState<string>("");
  const [filterChannel, setFilterChannel] = useState<string>("");

  const [unpaid, setUnpaid] = useState<Booking[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const selected = useMemo(() => payouts.find((p) => p.id === selectedPayoutId) ?? null, [payouts, selectedPayoutId]);

  async function loadPayouts() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/payouts", { cache: "no-store" });
      const data = await res.json();
      setPayouts(data.payouts ?? []);
      if (!selectedPayoutId && data.payouts?.[0]?.id) setSelectedPayoutId(data.payouts[0].id);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPayout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        channel: String(fd.get("channel") || "BOOKING"),
        payoutDate: String(fd.get("payoutDate") || ""),
        currency: String(fd.get("currency") || "BHD"),
        amount: String(fd.get("amount") || ""),
        providerRef: String(fd.get("providerRef") || "") || undefined,
        status: String(fd.get("status") || "RECEIVED"),
        note: String(fd.get("note") || "") || undefined,
      };

      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setMsg(await res.text().catch(() => "Create payout failed"));
        return;
      }

      e.currentTarget.reset();
      setMsg(t('saved'));
      await loadPayouts();
    } finally {
      setBusy(false);
    }
  }

  async function delPayout(id: string) {
    const ok = confirm("Delete this payout?");
    if (!ok) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/payouts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setMsg(await res.text().catch(() => "Delete failed"));
        return;
      }
      setMsg(t('saved')); // Reusing saved for success
      setSelectedPayoutId("");
      await loadPayouts();
    } finally {
      setBusy(false);
    }
  }

  async function loadUnpaid() {
    const qs = new URLSearchParams();
    if (filterUnitId) qs.set("unitId", filterUnitId);
    if (filterChannel) qs.set("channel", filterChannel);

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/payouts/unpaid?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setUnpaid(data.bookings ?? []);
      setPicked({});
    } finally {
      setBusy(false);
    }
  }

  async function allocatePicked() {
    if (!selected) {
      setMsg("Select a payout first.");
      return;
    }

    const chosen = unpaid.filter((b) => picked[b.id]);
    if (chosen.length === 0) {
      setMsg("Pick at least 1 booking.");
      return;
    }

    // Default: allocate netAmount if present, else 0.
    const lines = chosen.map((b) => ({
      bookingId: b.id,
      amount: b.netAmount ?? "0",
      note: "",
    }));

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/payouts/${selected.id}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });

      if (!res.ok) {
        setMsg(await res.text().catch(() => "Allocate failed"));
        return;
      }

      setMsg(t('saved'));
      await loadPayouts();
      await loadUnpaid();
    } finally {
      setBusy(false);
    }
  }

  const totalAllocated = selected ? sum(selected.lines) : 0;
  const totalPayout = selected ? Number(selected.amount) : 0;
  const remaining = selected ? totalPayout - totalAllocated : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="text-sm font-semibold">{t('add_payout')}</div>
          <form onSubmit={createPayout} className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300">{t('channel')}</label>
              <select name="channel" className={input} defaultValue="BOOKING">
                <option value="BOOKING">BOOKING</option>
                <option value="AIRBNB">AIRBNB</option>
                <option value="AGODA">AGODA</option>
                <option value="OTHER">{t('other')}</option>
                <option value="MANUAL">{t('manual')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300">{t('date')}</label>
              <input name="payoutDate" type="date" className={input} defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300">{t('currency')}</label>
              <input name="currency" className={input} defaultValue="BHD" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300">{t('amount')}</label>
              <input name="amount" className={input} placeholder="e.g. 123.450" />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300">{t('status')}</label>
              <select name="status" className={input} defaultValue="RECEIVED">
                <option value="RECEIVED">{t('received')}</option>
                <option value="PENDING">{t('pending')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300">{t('provider_ref')}</label>
              <input name="providerRef" className={input} placeholder={t('transfer_id')} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 dark:text-slate-300">{t('note')}</label>
              <input name="note" className={input} placeholder={t('optional')} />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button disabled={busy} className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>
                {t('add')}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{t('payouts')}</div>
            <button
              type="button"
              disabled={busy}
              onClick={loadPayouts}
              className={`${btn} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900`}
            >
              {t('refresh')}
            </button>
          </div>

          {payouts.length === 0 ? (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('no_payouts')}</div>
          ) : (
            <div className="mt-3 space-y-2">
              <select value={selectedPayoutId} onChange={(e) => setSelectedPayoutId(e.target.value)} className={input}>
                {payouts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.payoutDate} · {p.channel} · {p.amount} {p.currency} ({p.status})
                  </option>
                ))}
              </select>

              {selected ? (
                <div className="rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        {selected.payoutDate} · {selected.channel}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Allocated: {totalAllocated.toFixed(3)} / {totalPayout.toFixed(3)} · Remaining:{" "}
                        {remaining.toFixed(3)}
                      </div>
                    </div>
                    <button type="button" className="text-rose-600 hover:underline" onClick={() => delPayout(selected.id)}>
                      {t('delete')}
                    </button>
                  </div>

                  {selected.lines.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('no_lines')}</div>
                  ) : (
                    <div className="mt-3 overflow-auto">
                      <table className="min-w-[620px] w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950">
                            <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('booking')}</th>
                            <th className="border border-slate-200 p-2 text-right dark:border-slate-700">{t('amount')}</th>
                            <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.lines.map((l) => (
                            <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/60">
                              <td className="border border-slate-200 p-2 dark:border-slate-700">
                                {l.booking ? (
                                  <div>
                                    <div className="font-medium">{l.booking.unitName}</div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {l.booking.startDate} → {l.booking.endDate} · {t('net')} {l.booking.netAmount ?? "-"}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-slate-500 dark:text-slate-400">{t('unlinked')}</div>
                                )}
                              </td>
                              <td className="border border-slate-200 p-2 text-right dark:border-slate-700">
                                {l.amount}
                              </td>
                              <td className="border border-slate-200 p-2 dark:border-slate-700">
                                {l.booking?.paymentStatus ?? "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">{t('allocate_to_bookings')}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('allocate_desc')}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select value={filterUnitId} onChange={(e) => setFilterUnitId(e.target.value)} className={input}>
              <option value="">{t('all_units')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className={input}>
              <option value="">{t('all_channels')}</option>
              <option value="BOOKING">BOOKING</option>
              <option value="AIRBNB">AIRBNB</option>
              <option value="AGODA">AGODA</option>
              <option value="MANUAL">{t('manual')}</option>
              <option value="OTHER">{t('other')}</option>
            </select>

            <button
              type="button"
              disabled={busy}
              onClick={loadUnpaid}
              className={`${btn} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900`}
            >
              {t('load')}
            </button>

            <button
              type="button"
              disabled={busy || !selectedPayoutId}
              onClick={allocatePicked}
              className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}
            >
              {t('allocate_picked')}
            </button>
          </div>
        </div>

        {msg ? <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{msg}</div> : null}

        {unpaid.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t('no_bookings_loaded')}</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="min-w-[860px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950">
                  <th className="border border-slate-200 p-2 text-center dark:border-slate-700">{t('pick')}</th>
                  <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('unit')}</th>
                  <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('dates')}</th>
                  <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('channel')}</th>
                  <th className="border border-slate-200 p-2 text-right dark:border-slate-700">{t('net')}</th>
                  <th className="border border-slate-200 p-2 text-left dark:border-slate-700">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {unpaid.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/60">
                    <td className="border border-slate-200 p-2 text-center dark:border-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(picked[b.id])}
                        onChange={(e) => setPicked((p) => ({ ...p, [b.id]: e.target.checked }))}
                      />
                    </td>
                    <td className="border border-slate-200 p-2 dark:border-slate-700">{b.unitName}</td>
                    <td className="border border-slate-200 p-2 dark:border-slate-700">
                      {b.startDate} → {b.endDate}
                    </td>
                    <td className="border border-slate-200 p-2 dark:border-slate-700">{b.channel}</td>
                    <td className="border border-slate-200 p-2 text-right dark:border-slate-700">{b.netAmount ?? "-"}</td>
                    <td className="border border-slate-200 p-2 dark:border-slate-700">{b.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          {t('net_hint')}
        </div>
      </div>
    </div>
  );
}
