import crypto from "crypto";

/**
 * Stable JSON stringify (sort keys, handle arrays) so checksums are consistent.
 */
export function stableStringify(value: any): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }

  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify((value as any)[k])).join(",") + "}";
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function checksumOfJson(obj: any): string {
  return sha256Hex(stableStringify(obj));
}
