import { NextRequest, NextResponse } from "next/server";
import { tavily } from "@tavily/core";

export const runtime = "nodejs";
export const maxDuration = 60;

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

/**
 * POST /api/content/extract
 * Extracts property content from Booking.com/Agoda URLs using Tavily Extract API
 * to bypass challenge pages and bot detection.
 * 
 * Body: { url: string }
 * Returns: extracted property data (title, description, images, amenities, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = body?.url;

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "Valid URL is required" },
        { status: 400 }
      );
    }

    // Use Tavily Extract to bypass bot detection
    const extracted = await tvly.extract([url], {
      extract_depth: "advanced", // Get tables, embedded content, etc.
    });

    if (!extracted || !extracted.results || extracted.results.length === 0) {
      return NextResponse.json(
        { error: "Failed to extract content from URL" },
        { status: 500 }
      );
    }

    const result = extracted.results[0];
    const rawContent = result.raw_content || "";

    // Detect channel
    const urlLower = url.toLowerCase();
    const isBooking = urlLower.includes("booking.com");
    const isAgoda = urlLower.includes("agoda.com");
    const isAirbnb = urlLower.includes("airbnb.com");

    // Parse extracted content
    const parsed = parseExtractedContent(rawContent, {
      isBooking,
      isAgoda,
      isAirbnb,
      url,
    });

    return NextResponse.json({
      ok: true,
      data: parsed,
      source: "tavily-extract",
    });
  } catch (err: unknown) {
    console.error("[extract] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message, hint: "Check TAVILY_API_KEY env variable" },
      { status: 500 }
    );
  }
}

interface ParseContext {
  isBooking: boolean;
  isAgoda: boolean;
  isAirbnb: boolean;
  url: string;
}

function parseExtractedContent(
  content: string,
  ctx: ParseContext
): Record<string, any> {
  const lines = content.split("\n").map((l) => l.trim());

  // Extract title (usually first substantial line or marked with ##)
  let title = "";
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else {
    // Fallback: first line with decent length
    for (const line of lines) {
      if (line.length > 10 && line.length < 150 && !line.startsWith("http")) {
        title = line;
        break;
      }
    }
  }

  // Extract description (first paragraph or sentences)
  let description = "";
  const descLines: string[] = [];
  let inDesc = false;
  for (const line of lines) {
    if (line.length > 50 && !line.startsWith("#") && !line.startsWith("http")) {
      descLines.push(line);
      inDesc = true;
      if (descLines.join(" ").length > 500) break;
    } else if (inDesc && line.length < 10) {
      break;
    }
  }
  description = descLines.join(" ").slice(0, 800);

  // Extract images (look for image URLs in content)
  const images: string[] = [];
  const imgRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|webp|gif)/gi;
  const matches = content.matchAll(imgRegex);
  for (const match of matches) {
    images.push(match[0]);
    if (images.length >= 15) break;
  }

  // Extract amenities (look for lists or bullet points)
  const amenities: string[] = [];
  const amenityPatterns = [
    /[-*•]\s*([^-*•\n]+)/g, // Bullet lists
    /(?:amenities?|facilities?|features?):\s*([^\n]+)/gi,
  ];
  for (const pattern of amenityPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const item = match[1].trim();
      if (item.length > 3 && item.length < 100) {
        amenities.push(item);
        if (amenities.length >= 20) break;
      }
    }
    if (amenities.length >= 20) break;
  }

  // Extract rules, check-in/out, address, etc.
  const houseRules = extractSection(content, [
    "house rules",
    "property rules",
    "policies",
  ]);
  const checkInInfo = extractSection(content, ["check-in", "check in time"]);
  const checkOutInfo = extractSection(content, ["check-out", "check out time"]);
  const address = extractSection(content, ["address", "location", "situated"]);
  const guestCapacity = extractCapacity(content);
  const propertyHighlights = extractSection(content, [
    "highlights",
    "popular amenities",
    "most popular",
  ]);
  const damageDeposit = extractSection(content, ["deposit", "security deposit"]);
  const cancellationPolicy = extractSection(content, [
    "cancellation",
    "refund policy",
  ]);
  const nearbyPlaces = extractSection(content, ["nearby", "attractions", "area"]);

  return {
    title: title || "Untitled Property",
    description: description || "",
    images,
    amenities: [...new Set(amenities)].slice(0, 30),
    houseRules: houseRules || "",
    checkInInfo: checkInInfo || "",
    checkOutInfo: checkOutInfo || "",
    address: address || "",
    locationNote: "",
    guestCapacity: guestCapacity || "",
    propertyHighlights: propertyHighlights || "",
    damageDeposit: damageDeposit || "",
    cancellationPolicy: cancellationPolicy || "",
    nearbyPlaces: nearbyPlaces || "",
  };
}

function extractSection(content: string, keywords: string[]): string {
  for (const keyword of keywords) {
    const regex = new RegExp(
      `(${keyword})[:\\s]*([^\\n]{20,300})`,
      "i"
    );
    const match = content.match(regex);
    if (match && match[2]) {
      return match[2].trim();
    }
  }
  return "";
}

function extractCapacity(content: string): string {
  const capacityRegex = /(\d+)\s*(?:guests?|people|adults?|persons?|ضيوف)/i;
  const match = content.match(capacityRegex);
  return match ? match[1] : "";
}
