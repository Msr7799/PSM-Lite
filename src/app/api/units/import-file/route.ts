import { prisma } from "@/lib/prisma";
import { getOrFetchPublicPreview } from "@/lib/publicPreview";
import { Channel, FeedType, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const maxDuration = 60;

function normKey(k: string) {
  return String(k || "").trim().toLowerCase();
}

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function cleanStr(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function cleanArr(v: any): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of v) {
    const s = cleanStr(it);
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function parseChannel(v: any): Channel {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BOOKING" || s === "AIRBNB" || s === "AGODA" || s === "MANUAL" || s === "OTHER") return s as Channel;
  return Channel.BOOKING;
}

function parseDecimal3(v: any): Prisma.Decimal | null {
  const s = String(v ?? "").replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(n.toFixed(3));
}

function externalIdFromUrl(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    return `${u.hostname}${u.pathname}`.toLowerCase();
  } catch {
    return rawUrl;
  }
}

export async function POST(req: Request) {
  const fd = await req.formData();
  const file = fd.get("file") as File | null;

  if (!file) return new Response("file is required", { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const name = (file.name || "").toLowerCase();

  let rows: any[] = [];

  if (name.endsWith(".csv")) {
    const text = buf.toString("utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return new Response("Empty CSV", { status: 400 });

    const headers = lines[0].split(",").map((h) => normKey(h));
    for (const line of lines.slice(1)) {
      const parts = line.split(",");
      const obj: any = {};
      headers.forEach((h, i) => (obj[h] = parts[i] ?? ""));
      rows.push(obj);
    }
  } else {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return new Response("No sheet found", { status: 400 });
    const ws = wb.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
    // normalize keys to lowercase
    rows = rows.map((r) => {
      const o: any = {};
      for (const [k, v] of Object.entries(r)) o[normKey(k)] = v;
      return o;
    });
  }

  const results: Array<{ row: number; unitId?: string; ok: boolean; error?: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? {};
    try {
      const unitName = cleanStr(pick(r, ["name", "unit", "property", "unit name", "property name"])) ?? null;
      if (!unitName) {
        results.push({ row: i + 2, ok: false, error: "Missing name" });
        continue;
      }

      const code = cleanStr(pick(r, ["code", "unitcode", "unit code"])) ?? null;
      const currency = cleanStr(pick(r, ["currency"])) ?? "BHD";
      const defaultRate = parseDecimal3(pick(r, ["defaultrate", "default rate", "rate", "price"]));

      const publicUrl = cleanStr(pick(r, ["publicurl", "public url", "url", "listing"])) ?? null;
      const channel = parseChannel(pick(r, ["channel", "platform"]));
      const icsUrl = cleanStr(pick(r, ["icsurl", "ics url", "ical", "icalurl", "calendar"])) ?? null;

      const unit = await prisma.unit.create({
        data: {
          name: unitName,
          code,
          currency,
          defaultRate: defaultRate ?? undefined,
          isActive: true,
        },
        select: { id: true, currency: true },
      });

      // Listing + preview + auto-fill content
      if (publicUrl) {
        const externalId = externalIdFromUrl(publicUrl);
        await prisma.channelListing.create({
          data: {
            unitId: unit.id,
            channel,
            publicUrl,
            externalId,
          },
        });

        const preview = await getOrFetchPublicPreview(publicUrl, { force: true });
        const details = (preview.details ?? {}) as any;

        await (prisma.unitContent as any).upsert({
          where: { unitId: unit.id },
          create: {
            unitId: unit.id,
            title: cleanStr(preview.ogTitle),
            description: cleanStr(details.descriptionLong ?? preview.ogDesc),
            houseRules: cleanStr(details.houseRules),
            checkInInfo: cleanStr(details.checkInInfo),
            checkOutInfo: cleanStr(details.checkOutInfo),
            locationNote: cleanStr(details.locationNote),
            amenities: cleanArr(preview.amenities),
            images: cleanArr(preview.images),
            address: cleanStr(details.address),
            guestCapacity: cleanStr(details.guestCapacity),
            propertyHighlights: cleanStr(details.propertyHighlights),
            nearbyPlaces: cleanStr(details.nearbyPlaces),
            damageDeposit: cleanStr(details.damageDeposit),
            cancellationPolicy: cleanStr(details.cancellationPolicy),
            addressLine1: cleanStr(details.addressLine1),
            city: cleanStr(details.city),
            country: cleanStr(details.country),
            lat: details.lat != null ? Number(details.lat) : null,
            lng: details.lng != null ? Number(details.lng) : null,
          },
          update: {},
        });

        // Price sync (best-effort)
        const p = cleanStr(details.price);
        const c = cleanStr(details.priceCurrency);
        const currencyOk = !c || c.toUpperCase() === unit.currency.toUpperCase();
        if (p && currencyOk) {
          const dec = parseDecimal3(p);
          if (dec) {
            await prisma.unit.update({
              where: { id: unit.id },
              data: { defaultRate: dec },
            });
          }
        }
      }

      // iCal feed
      if (icsUrl) {
        await prisma.icalFeed.create({
          data: {
            unitId: unit.id,
            channel,
            type: FeedType.URL,
            url: icsUrl,
            name: `${channel}-import`,
          },
        });
      }

      results.push({ row: i + 2, ok: true, unitId: unit.id });
    } catch (e) {
      results.push({ row: i + 2, ok: false, error: String(e) });
    }
  }

  const okCount = results.filter((x) => x.ok).length;
  const failCount = results.length - okCount;

  return Response.json({ ok: true, okCount, failCount, results });
}
