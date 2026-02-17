"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

// ─── Types ───────────────────────────────────────────────────────
type Unit = { id: string; name: string };

type BookingEvent = {
  id: string;
  channel: string;
  summary: string | null;
  startDate: string;
  endDate: string;
};

type DateBlockEntry = {
  id: string;
  date: string;
  source: string;
  reason: string | null;
};

type FeedEntry = {
  id: string;
  channel: string;
  type: string;
  name: string | null;
  url: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

type DayInfo = {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: { channel: string; summary: string | null }[];
  block: { source: string; reason: string | null } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────
const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

function sameDay(a: Date, b: Date): boolean {
  return fmtDate(a) === fmtDate(b);
}

function getMonthDays(year: number, month: number): DayInfo[][] {
  const firstDay = utcDate(year, month, 1);
  const startDow = firstDay.getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = new Date();
  const todayStr = fmtDate(today);

  const weeks: DayInfo[][] = [];
  let week: DayInfo[] = [];

  // Fill leading days from previous month
  const prevMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = utcDate(year, month - 1, prevMonthDays - i);
    week.push({
      date: d,
      dateStr: fmtDate(d),
      isCurrentMonth: false,
      isToday: fmtDate(d) === todayStr,
      bookings: [],
      block: null,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = utcDate(year, month, day);
    week.push({
      date: d,
      dateStr: fmtDate(d),
      isCurrentMonth: true,
      isToday: fmtDate(d) === todayStr,
      bookings: [],
      block: null,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  // Fill trailing days
  if (week.length > 0) {
    let nextDay = 1;
    while (week.length < 7) {
      const d = utcDate(year, month + 1, nextDay++);
      week.push({
        date: d,
        dateStr: fmtDate(d),
        isCurrentMonth: false,
        isToday: fmtDate(d) === todayStr,
        bookings: [],
        block: null,
      });
    }
    weeks.push(week);
  }

  return weeks;
}

const CHANNEL_COLORS: Record<string, string> = {
  BOOKING: "bg-indigo-500",
  AIRBNB: "bg-rose-500",
  AGODA: "bg-emerald-500",
  MANUAL: "bg-slate-700",
  OTHER: "bg-slate-500",
};

const CHANNEL_BG: Record<string, string> = {
  BOOKING: "bg-indigo-100 dark:bg-indigo-950/60",
  AIRBNB: "bg-rose-100 dark:bg-rose-950/60",
  AGODA: "bg-emerald-100 dark:bg-emerald-950/60",
  MANUAL: "bg-amber-100 dark:bg-amber-950/60",
};

function channelDot(channel: string) {
  return CHANNEL_COLORS[channel] ?? "bg-slate-500";
}

// ─── Month names ─────────────────────────────────────────────────
const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_NAMES_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// ─── Component ───────────────────────────────────────────────────
export default function CalendarClient({ units }: { units: Unit[] }) {
  const t = useTranslations();

  // Detect locale from document dir
  const [isRtl, setIsRtl] = useState(false);
  useEffect(() => {
    setIsRtl(document.documentElement.dir === "rtl");
  }, []);

  const dayNames = isRtl ? DAY_NAMES_AR : DAY_NAMES_EN;
  const monthNames = isRtl ? MONTH_NAMES_AR : MONTH_NAMES_EN;

  // State
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const [bookings, setBookings] = useState<BookingEvent[]>([]);
  const [dateBlocks, setDateBlocks] = useState<DateBlockEntry[]>([]);
  const [feeds, setFeeds] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dowFilter, setDowFilter] = useState<boolean[]>([false, false, false, false, false, false, false]);

  // ─── Data fetching ──────────────────────────────────────────
  const loadCalendar = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    setMsg("");
    try {
      // Fetch 2 months of data (current + next)
      const from = fmtDate(utcDate(year, month, 1));
      const lastDay = new Date(Date.UTC(year, month + 2, 0));
      const to = fmtDate(lastDay);

      const res = await fetch(`/api/calendar/${unitId}?from=${from}&to=${to}`);
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
        return;
      }
      setBookings(data.bookings ?? []);
      setDateBlocks(data.dateBlocks ?? []);
      setFeeds(data.feeds ?? []);
    } catch (e) {
      setMsg("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [unitId, year, month]);

  useEffect(() => {
    loadCalendar();
    setSelected(new Set());
  }, [loadCalendar]);

  // ─── Build month grids with booking/block data ──────────────
  const month1Weeks = useMemo(() => {
    const weeks = getMonthDays(year, month);
    // Populate bookings and blocks
    for (const week of weeks) {
      for (const day of week) {
        const dayMs = new Date(day.dateStr + "T00:00:00Z").getTime();
        // Check bookings
        for (const b of bookings) {
          const s = new Date(b.startDate).getTime();
          const e = new Date(b.endDate).getTime();
          if (s <= dayMs && dayMs < e) {
            day.bookings.push({ channel: b.channel, summary: b.summary });
          }
        }
        // Check blocks
        for (const bl of dateBlocks) {
          const blDate = bl.date.slice(0, 10);
          if (blDate === day.dateStr) {
            day.block = { source: bl.source, reason: bl.reason };
          }
        }
      }
    }
    return weeks;
  }, [year, month, bookings, dateBlocks]);

  const month2Year = month === 11 ? year + 1 : year;
  const month2Month = (month + 1) % 12;

  const month2Weeks = useMemo(() => {
    const weeks = getMonthDays(month2Year, month2Month);
    for (const week of weeks) {
      for (const day of week) {
        const dayMs = new Date(day.dateStr + "T00:00:00Z").getTime();
        for (const b of bookings) {
          const s = new Date(b.startDate).getTime();
          const e = new Date(b.endDate).getTime();
          if (s <= dayMs && dayMs < e) {
            day.bookings.push({ channel: b.channel, summary: b.summary });
          }
        }
        for (const bl of dateBlocks) {
          const blDate = bl.date.slice(0, 10);
          if (blDate === day.dateStr) {
            day.block = { source: bl.source, reason: bl.reason };
          }
        }
      }
    }
    return weeks;
  }, [month2Year, month2Month, bookings, dateBlocks]);

  // ─── Navigation ─────────────────────────────────────────────
  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  }

  // ─── Day-of-week filter ─────────────────────────────────────
  function toggleDow(dow: number) {
    const next = [...dowFilter];
    next[dow] = !next[dow];
    setDowFilter(next);

    // Auto-select/deselect matching days in both months
    const allDays = [...month1Weeks.flat(), ...month2Weeks.flat()].filter(
      (d) => d.isCurrentMonth
    );

    const newSelected = new Set(selected);
    for (const day of allDays) {
      if (day.date.getUTCDay() === dow) {
        if (next[dow]) {
          newSelected.add(day.dateStr);
        } else {
          newSelected.delete(day.dateStr);
        }
      }
    }
    setSelected(newSelected);
  }

  // ─── Toggle selection ───────────────────────────────────────
  function toggleDate(dateStr: string) {
    const next = new Set(selected);
    if (next.has(dateStr)) next.delete(dateStr);
    else next.add(dateStr);
    setSelected(next);
  }

  function clearSelection() {
    setSelected(new Set());
    setDowFilter([false, false, false, false, false, false, false]);
  }

  // ─── Block / Unblock ───────────────────────────────────────
  async function blockDates() {
    if (selected.size === 0) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/calendar/${unitId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [...selected], source: "MANUAL" }),
      });
      if (!res.ok) {
        setMsg("Block failed");
        return;
      }
      await loadCalendar();
      clearSelection();
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function unblockDates() {
    if (selected.size === 0) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/calendar/${unitId}/block`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [...selected] }),
      });
      if (!res.ok) {
        setMsg("Unblock failed");
        return;
      }
      await loadCalendar();
      clearSelection();
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  // ─── Render a single month grid ────────────────────────────
  function renderMonthGrid(weeks: DayInfo[][], monthLabel: string) {
    return (
      <div className="flex-1 min-w-0">
        <h3 className="mb-2 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
          {monthLabel}
        </h3>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {dayNames.map((dn, i) => (
            <div
              key={i}
              className="py-1.5 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900"
            >
              {dn}
            </div>
          ))}
        </div>
        {/* Weeks */}
        <div className="grid gap-px">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-px">
              {week.map((day) => {
                const isSelected = selected.has(day.dateStr);
                const hasBooking = day.bookings.length > 0;
                const hasBlock = !!day.block;
                const isUnavailable = hasBooking || hasBlock;

                // Determine background
                let bgClass = "bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/30";
                if (!day.isCurrentMonth) {
                  bgClass = "bg-slate-50/50 dark:bg-slate-950/30";
                } else if (hasBooking) {
                  const ch = day.bookings[0].channel;
                  bgClass = CHANNEL_BG[ch] ?? "bg-rose-100 dark:bg-rose-950/60";
                } else if (hasBlock) {
                  bgClass = "bg-amber-50 dark:bg-amber-950/40";
                }

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => day.isCurrentMonth && toggleDate(day.dateStr)}
                    className={`
                      relative flex flex-col items-start p-1 min-h-[60px] sm:min-h-[72px] text-start transition-all
                      border border-transparent
                      ${bgClass}
                      ${day.isCurrentMonth ? "cursor-pointer" : "cursor-default opacity-40"}
                      ${isSelected ? "!border-blue-500 ring-2 ring-blue-400/50 z-10" : ""}
                      ${day.isToday ? "ring-1 ring-slate-400 dark:ring-slate-500" : ""}
                    `}
                  >
                    {/* Date number */}
                    <span
                      className={`text-[11px] font-medium leading-none
                        ${day.isToday ? "text-blue-600 dark:text-blue-400 font-bold" : ""}
                        ${!day.isCurrentMonth ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}
                      `}
                    >
                      {day.date.getUTCDate()}
                    </span>

                    {/* Status indicators */}
                    <div className="mt-auto flex flex-wrap gap-0.5">
                      {day.bookings.map((b, bi) => (
                        <span
                          key={bi}
                          className={`inline-block rounded-sm px-1 py-px text-[8px] font-bold text-white leading-tight ${channelDot(b.channel)}`}
                          title={b.summary ?? b.channel}
                        >
                          {b.channel.slice(0, 3)}
                        </span>
                      ))}
                      {hasBlock && !hasBooking && (
                        <span
                          className="inline-block rounded-sm bg-amber-500 px-1 py-px text-[8px] font-bold text-white leading-tight"
                          title={day.block!.reason ?? day.block!.source}
                        >
                          {day.block!.source === "MANUAL"
                            ? (isRtl ? "مغلق" : "CLOSED")
                            : day.block!.source.slice(0, 3)}
                        </span>
                      )}
                    </div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-0.5 end-0.5 h-2 w-2 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Unit selector */}
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Month navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {isRtl ? "→" : "←"}
            </button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {isRtl ? "←" : "→"}
            </button>
          </div>

          {/* Block / Unblock buttons */}
          <div className="flex items-center gap-2 ms-auto">
            {selected.size > 0 && (
              <span className="text-xs text-slate-500">
                {selected.size} {isRtl ? "محدد" : "selected"}
              </span>
            )}
            <button
              onClick={blockDates}
              disabled={busy || selected.size === 0}
              className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              {isRtl ? "🔒 إغلاق" : "🔒 Block"}
            </button>
            <button
              onClick={unblockDates}
              disabled={busy || selected.size === 0}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {isRtl ? "🔓 فتح" : "🔓 Unblock"}
            </button>
            {selected.size > 0 && (
              <button
                onClick={clearSelection}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                {isRtl ? "إلغاء" : "Clear"}
              </button>
            )}
          </div>
        </div>

        {/* Day-of-week filter checkboxes */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isRtl ? "تحديد أيام الأسبوع:" : "Select days of week:"}
          </span>
          {dayNames.map((dn, i) => (
            <label
              key={i}
              className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs transition
                ${dowFilter[i]
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600"
                }`}
            >
              <input
                type="checkbox"
                checked={dowFilter[i]}
                onChange={() => toggleDow(i)}
                className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {dn}
            </label>
          ))}
        </div>

        {/* Sync status / feeds info */}
        {feeds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {feeds.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              >
                <span className={`h-2 w-2 rounded-full ${channelDot(f.channel)}`} />
                <span className="text-[10px] font-medium">{f.channel}</span>
                {f.lastSyncAt && (
                  <span className="text-[9px] text-slate-400">
                    {new Date(f.lastSyncAt).toLocaleDateString()}
                  </span>
                )}
                {f.lastError && (
                  <span className="text-[9px] text-red-500" title={f.lastError}>⚠</span>
                )}
              </div>
            ))}
          </div>
        )}

        {msg && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {msg}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="h-3 w-3 rounded-sm bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700" />
          {isRtl ? "متاح" : "Available"}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="h-3 w-3 rounded-sm bg-indigo-100 dark:bg-indigo-950" />
          Booking.com
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="h-3 w-3 rounded-sm bg-rose-100 dark:bg-rose-950" />
          Airbnb
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="h-3 w-3 rounded-sm bg-emerald-100 dark:bg-emerald-950" />
          Agoda
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="h-3 w-3 rounded-sm bg-amber-50 border border-amber-200 dark:bg-amber-950" />
          {isRtl ? "مغلق يدويًا" : "Manually Blocked"}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="h-3 w-3 rounded-sm border-2 border-blue-500" />
          {isRtl ? "محدد" : "Selected"}
        </div>
      </div>

      {/* Calendar grids */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="animate-pulse text-slate-500">{t("loading")}</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex gap-6 flex-col lg:flex-row">
            {renderMonthGrid(
              month1Weeks,
              `${monthNames[month]} ${year}`
            )}
            {renderMonthGrid(
              month2Weeks,
              `${monthNames[month2Month]} ${month2Year}`
            )}
          </div>
        </div>
      )}

      {/* Blocked dates list */}
      {dateBlocks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-sm font-semibold mb-2">
            {isRtl ? "التواريخ المغلقة" : "Blocked Dates"}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {dateBlocks.map((bl) => (
              <span
                key={bl.id}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs dark:border-amber-800 dark:bg-amber-950"
              >
                <span className="font-medium">
                  {new Date(bl.date).toLocaleDateString(isRtl ? "ar" : "en", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className={`rounded-full px-1 py-px text-[8px] font-bold text-white ${channelDot(bl.source)}`}>
                  {bl.source}
                </span>
                {bl.reason && (
                  <span className="text-[10px] text-slate-500">{bl.reason}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
