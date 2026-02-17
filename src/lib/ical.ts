import { addDays } from "date-fns";
import { promises as fs } from "fs";
import path from "path";

export type ParsedEvent = {
  uid: string;
  summary?: string;
  start: Date;
  end: Date; // end is exclusive day (UTC date-only)
};

function toUtcDateOnly(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day));
}

function parseDateOnly(v: string): Date | null {
  // YYYYMMDD
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d));
}

function parseDateTime(v: string): Date | null {
  // YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const s = v.trim();
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6]);
  const isUtc = m[7] === "Z";
  return isUtc ? new Date(Date.UTC(y, mo, d, hh, mm, ss)) : new Date(y, mo, d, hh, mm, ss);
}

function unfoldLines(icsText: string): string[] {
  // RFC5545 line folding: lines that start with space/tab are continuations
  const raw = icsText.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if (!line) continue;
    if (/^[ \t]/.test(line) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseEventBlock(lines: string[]): ParsedEvent | null {
  const fields: Record<string, { value: string; params: Record<string, string> }> = {};

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);

    const [nameRaw, ...paramParts] = left.split(";");
    const name = nameRaw.toUpperCase();

    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const [k, v] = p.split("=");
      if (k && v) params[k.toUpperCase()] = v;
    }

    // Keep the first occurrence only (good enough for our use)
    if (!fields[name]) fields[name] = { value, params };
  }

  const uid = (fields["UID"]?.value ?? "").trim();
  if (!uid) return null;

  const summary = fields["SUMMARY"]?.value?.trim() || undefined;

  const dtStart = fields["DTSTART"];
  const dtEnd = fields["DTEND"];

  if (!dtStart) return null;

  const startIsDateOnly = (dtStart.params["VALUE"] || "").toUpperCase() === "DATE" || /^\d{8}$/.test(dtStart.value.trim());
  const endIsDateOnly = dtEnd ? ((dtEnd.params["VALUE"] || "").toUpperCase() === "DATE" || /^\d{8}$/.test(dtEnd.value.trim())) : startIsDateOnly;

  const startRaw = startIsDateOnly ? parseDateOnly(dtStart.value) : parseDateTime(dtStart.value);
  if (!startRaw) return null;

  let endRaw: Date | null = null;
  if (dtEnd) {
    endRaw = endIsDateOnly ? parseDateOnly(dtEnd.value) : parseDateTime(dtEnd.value);
  }

  // Convert to UTC date-only (all-day semantics)
  const start = toUtcDateOnly(startRaw);
  const end = toUtcDateOnly(endRaw ?? addDays(startRaw, 1));

  const safeEnd = end <= start ? toUtcDateOnly(addDays(startRaw, 1)) : end;

  return { uid, summary, start, end: safeEnd };
}

export function parseIcsText(icsText: string): ParsedEvent[] {
  const lines = unfoldLines(icsText);

  const events: ParsedEvent[] = [];
  let buf: string[] | null = null;

  for (const line of lines) {
    const up = line.toUpperCase();

    if (up === "BEGIN:VEVENT") {
      buf = [];
      continue;
    }
    if (up === "END:VEVENT") {
      if (buf) {
        const ev = parseEventBlock(buf);
        if (ev) events.push(ev);
      }
      buf = null;
      continue;
    }

    if (buf) buf.push(line);
  }

  return events;
}

function isHttpUrl(u: string) {
  return /^https?:\/\//i.test(u);
}

function normalizePublicPath(u: string) {
  // Allow: /ics/file.ics or ics/file.ics
  const cleaned = u.replace(/^\./, "").trim();
  const rel = cleaned.startsWith("/") ? cleaned.slice(1) : cleaned;
  // Only serve from public/ics
  if (!rel.toLowerCase().startsWith("ics/")) return null;
  if (!rel.toLowerCase().endsWith(".ics")) return null;
  // Prevent path traversal
  const safe = rel.replace(/\\/g, "/");
  if (safe.includes("..")) return null;
  return safe;
}

export async function fetchIcsFromUrl(url: string): Promise<string> {
  // Support local files placed under /public/ics
  if (!isHttpUrl(url)) {
    const rel = normalizePublicPath(url);
    if (rel) {
      const full = path.join(process.cwd(), "public", rel);
      return await fs.readFile(full, "utf8");
    }
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}
