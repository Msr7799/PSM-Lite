import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Channel } from "@prisma/client";
import { getOrFetchPublicPreview, isAllowedPublicUrl } from "@/lib/publicPreview";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  publicUrl: z.string().optional().nullable(),
  editUrl: z.string().optional().nullable(),
  forcePreview: z.boolean().optional(),
});

function normalizeUrl(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

/**
 * PATCH /api/units/:id/primary-link
 * Stores a "primary public URL" for the unit (ChannelListing: OTHER, externalId = unitId),
 * and (optionally) refreshes OG preview cache.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const publicUrl = normalizeUrl(parsed.data.publicUrl);
    const editUrl = normalizeUrl(parsed.data.editUrl);
    const forcePreview = !!parsed.data.forcePreview;

    // Upsert the primary listing row
    const listing = await prisma.channelListing.upsert({
      where: {
        channel_externalId: { channel: Channel.OTHER, externalId: id },
      },
      create: {
        unitId: id,
        channel: Channel.OTHER,
        externalId: id,
        publicUrl,
        editUrl,
      },
      update: { publicUrl, editUrl },
    });

    // Refresh preview (only if allowed)
    let preview = null;
    if (publicUrl && isAllowedPublicUrl(publicUrl)) {
      preview = await getOrFetchPublicPreview(publicUrl, { force: forcePreview });
    }

    return NextResponse.json({ ok: true, listing, preview });
  } catch (err: unknown) {
    console.error("[primary-link] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
