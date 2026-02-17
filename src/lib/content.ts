import { Channel } from "@prisma/client";

export type MasterContent = {
  title?: string | null;
  description?: string | null;
  houseRules?: string | null;
  checkInInfo?: string | null;
  checkOutInfo?: string | null;
  amenities?: string[] | null;
  locationNote?: string | null;
  address?: string | null;
  guestCapacity?: string | null;
  propertyHighlights?: string | null;
  nearbyPlaces?: string | null;
  damageDeposit?: string | null;
  cancellationPolicy?: string | null;
};

export type ChannelOverride = Partial<MasterContent> & { channel: Channel };

function pick<T>(...vals: (T | null | undefined)[]): T | undefined {
  for (const v of vals) if (v !== null && v !== undefined && v !== "") return v as T;
  return undefined;
}

function joinBullets(items: string[]): string {
  return items.map((x) => `• ${x}`).join("\n");
}

function clampText(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
}

/**
 * Generates channel-ready text blocks (copy/paste) from your master content + optional override.
 * This DOES NOT sync to platforms; it's for manual publishing.
 */
export function generateChannelDraft(channel: Channel, master: MasterContent, override?: Partial<MasterContent>) {
  const title = pick<string>(override?.title, master.title) ?? "";
  const desc = pick<string>(override?.description, master.description) ?? "";
  const rules = pick<string>(override?.houseRules, master.houseRules) ?? "";
  const checkIn = pick<string>(override?.checkInInfo, master.checkInInfo) ?? "";
  const checkOut = pick<string>(override?.checkOutInfo, master.checkOutInfo) ?? "";
  const amenities = (override?.amenities ?? master.amenities ?? []).filter(Boolean) as string[];
  const address = pick<string>(master.address) ?? "";
  const capacity = pick<string>(master.guestCapacity) ?? "";
  const highlights = pick<string>(master.propertyHighlights) ?? "";
  const nearby = pick<string>(master.nearbyPlaces) ?? "";
  const deposit = pick<string>(master.damageDeposit) ?? "";
  const cancel = pick<string>(master.cancellationPolicy) ?? "";

  // Different marketplaces "feel" different. Keep it pragmatic.
  if (channel === Channel.BOOKING) {
    const head = title ? `${title}\n` : "";
    const body = [
      desc && clampText(desc, 2000),
      (address || capacity) ? `\n${[address, capacity].filter(Boolean).join(" · ")}` : "",
      highlights ? `\nProperty highlights\n${highlights}` : "",
      amenities.length ? `\nAmenities\n${joinBullets(amenities)}` : "",
      rules ? `\nHouse rules\n${clampText(rules, 1200)}` : "",
      checkIn ? `\nCheck-in\n${clampText(checkIn, 800)}` : "",
      checkOut ? `\nCheck-out\n${clampText(checkOut, 600)}` : "",
      deposit ? `\nDamage deposit: ${deposit}` : "",
      cancel ? `\nCancellation: ${cancel}` : "",
      nearby ? `\nNearby\n${nearby}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { title, body: (head + body).trim(), hints: { maxDescription: 2000 } };
  }

  if (channel === Channel.AIRBNB) {
    const vibe = [
      desc && clampText(desc, 3000),
      (address || capacity) ? `\n📍 ${[address, capacity].filter(Boolean).join(" · ")}` : "",
      highlights ? `\nHighlights\n${highlights}` : "",
      amenities.length ? `\nWhat this place offers\n${joinBullets(amenities)}` : "",
      (checkIn || checkOut) ? `\nCheck-in / Check-out\n${[checkIn && `Check-in: ${checkIn}`, checkOut && `Check-out: ${checkOut}`].filter(Boolean).join("\n")}` : "",
      rules ? `\nHouse rules\n${clampText(rules, 1500)}` : "",
      deposit ? `\nDamage deposit: ${deposit}` : "",
      nearby ? `\nNearby places\n${nearby}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { title, body: vibe.trim(), hints: { maxDescription: 3000 } };
  }

  if (channel === Channel.AGODA) {
    const compact = [
      desc && clampText(desc, 1200),
      (address || capacity) ? `\n${[address, capacity].filter(Boolean).join(" · ")}` : "",
      amenities.length ? `\nHighlights\n${joinBullets(amenities.slice(0, 12))}` : "",
      rules ? `\nRules\n${clampText(rules, 600)}` : "",
      checkIn ? `\nCheck-in: ${clampText(checkIn, 200)}` : "",
      checkOut ? `Check-out: ${clampText(checkOut, 200)}` : "",
      deposit ? `\nDeposit: ${deposit}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { title, body: compact.trim(), hints: { maxDescription: 1200 } };
  }

  // Fallback
  const body = [desc, amenities.length ? `\nAmenities\n${joinBullets(amenities)}` : "", rules ? `\nRules\n${rules}` : ""]
    .filter(Boolean)
    .join("\n");
  return { title, body: body.trim(), hints: {} };
}

export function snapshotContent(channel: Channel, master: MasterContent, override?: Partial<MasterContent>) {
  const draft = generateChannelDraft(channel, master, override);
  return {
    channel,
    title: draft.title,
    body: draft.body,
    // keep raw too (for diff UX)
    master,
    override: override ?? null,
  };
}
