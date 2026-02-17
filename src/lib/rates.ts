import { Channel, Prisma } from "@prisma/client";

export type RateRuleRow = {
  id: string;
  unitId: string;
  channel: Channel | null;
  name: string;
  startDate: Date;
  endDate: Date;
  baseRate: Prisma.Decimal;
  weekendRate: Prisma.Decimal | null;
  minNights: number;
  maxNights: number | null;
  stopSell: boolean;
  daysOfWeek: number[] | null; // 0..6
  priority: number;
  updatedAt: Date;
};

export type RateDay = {
  date: Date;
  status: "OPEN" | "CLOSED";
  rate: string | null; // decimal string
  minNights: number | null;
  maxNights: number | null;
  appliedRuleId: string | null;
  appliedRuleName: string | null;
};

function utcDateOnly(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayOfWeek0Sun(d: Date) {
  // Date.getUTCDay(): 0..6 (Sun..Sat)
  return d.getUTCDay();
}

function inRange(day: Date, start: Date, end: Date) {
  const t = day.getTime();
  return start.getTime() <= t && t < end.getTime(); // [start, end)
}

function allowedDow(rule: RateRuleRow, dow: number) {
  if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) return true;
  return rule.daysOfWeek.includes(dow);
}

export function computeRatePreview(opts: {
  start: Date;
  days: number;
  channel: Channel | null; // null = any
  rules: RateRuleRow[];
  fallbackRate: Prisma.Decimal | null;
}) : RateDay[] {
  const start = utcDateOnly(opts.start);
  const out: RateDay[] = [];

  for (let i = 0; i < opts.days; i++) {
    const day = utcDateOnly(new Date(start.getTime() + i * 86400000));
    const dow = dayOfWeek0Sun(day);

    const candidates = opts.rules.filter((r) => {
      const chOk = r.channel === null || opts.channel === null || r.channel === opts.channel;
      return chOk && inRange(day, utcDateOnly(r.startDate), utcDateOnly(r.endDate)) && allowedDow(r, dow);
    });

    // winner: higher priority, then latest updated, then shorter range
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const ut = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (ut !== 0) return ut;
      const ar = (a.endDate.getTime() - a.startDate.getTime());
      const br = (b.endDate.getTime() - b.startDate.getTime());
      return ar - br;
    });

    const win = candidates[0];

    if (win?.stopSell) {
      out.push({
        date: day,
        status: "CLOSED",
        rate: null,
        minNights: win.minNights ?? null,
        maxNights: win.maxNights ?? null,
        appliedRuleId: win.id,
        appliedRuleName: win.name,
      });
      continue;
    }

    const weekend = dow === 5 || dow === 6; // Fri/Sat (Bahrain weekend often Fri/Sat)
    const rate = win
      ? (weekend && win.weekendRate ? win.weekendRate : win.baseRate)
      : (opts.fallbackRate ?? null);

    out.push({
      date: day,
      status: rate ? "OPEN" : "CLOSED",
      rate: rate ? rate.toString() : null,
      minNights: win ? win.minNights : null,
      maxNights: win ? win.maxNights : null,
      appliedRuleId: win?.id ?? null,
      appliedRuleName: win?.name ?? null,
    });
  }

  return out;
}

export function toCsv(rows: RateDay[], currency: string) {
  const header = ["date", "status", "rate", "currency", "min_nights", "max_nights", "rule"].join(",");
  const lines = rows.map((r) => {
    const d = r.date.toISOString().slice(0, 10);
    return [
      d,
      r.status,
      r.rate ?? "",
      currency,
      r.minNights ?? "",
      r.maxNights ?? "",
      r.appliedRuleName ?? "",
    ].map((x) => String(x).replaceAll('"', '""')).map((x) => `"${x}"`).join(",");
  });
  return [header, ...lines].join("\n");
}
