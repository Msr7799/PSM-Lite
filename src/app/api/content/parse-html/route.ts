import { NextRequest, NextResponse } from "next/server";
import { parseHtmlToPreview, detectChannel } from "@/lib/publicPreview";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const html = body?.html;
    const sourceUrl = body?.sourceUrl;

    if (!html || typeof html !== "string" || html.length < 100) {
      return NextResponse.json(
        { error: "HTML content is required (minimum 100 characters)." },
        { status: 400 }
      );
    }

    if (html.length > 5_000_000) {
      return NextResponse.json(
        { error: "HTML too large (max 5MB)." },
        { status: 400 }
      );
    }

    // Detect channel from the source URL if provided, otherwise try to detect from HTML content
    let channel = "OTHER";
    if (sourceUrl && typeof sourceUrl === "string") {
      channel = detectChannel(sourceUrl);
    } else {
      // Try to detect from canonical/og:url in the HTML
      const ogUrlMatch = html.match(/property="og:url"\s+content="([^"]+)"/);
      const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
      const detectedUrl = ogUrlMatch?.[1] || canonicalMatch?.[1];
      if (detectedUrl) channel = detectChannel(detectedUrl);
    }

    const preview = parseHtmlToPreview(html, channel);

    return NextResponse.json({
      ok: true,
      preview: { ...preview, fromCache: false },
    });
  } catch (err: unknown) {
    console.error("[parse-html] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
