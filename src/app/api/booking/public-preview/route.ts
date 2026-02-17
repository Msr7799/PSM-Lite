import { NextRequest, NextResponse } from "next/server";
import { getOrFetchPublicPreview, isAllowedPublicUrl } from "@/lib/publicPreview";

export const runtime = "nodejs";

/**
 * POST /api/booking/public-preview
 * Body: { url: string }
 *
 * NOTE: Despite the path name, this endpoint supports Booking/Airbnb/Agoda
 * via the shared preview fetcher (SSRF-protected + cached).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = body?.url;

    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    if (!isAllowedPublicUrl(rawUrl)) {
      return NextResponse.json(
        { error: "Only https:// links from Booking/Airbnb/Agoda are allowed." },
        { status: 403 }
      );
    }

    const preview = await getOrFetchPublicPreview(rawUrl, { force: true });

    return NextResponse.json(preview);
  } catch (err: unknown) {
    console.error("[public-preview] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
