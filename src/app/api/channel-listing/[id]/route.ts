import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PATCH /api/channel-listing/[id]
 * Updates publicUrl or editUrl for a ChannelListing.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const listing = await prisma.channelListing.findUnique({
            where: { id },
        });

        if (!listing) {
            return NextResponse.json(
                { error: "Listing not found." },
                { status: 404 }
            );
        }

        // Only allow updating publicUrl and editUrl
        const data: Record<string, string | null> = {};
        if ("publicUrl" in body) data.publicUrl = body.publicUrl || null;
        if ("editUrl" in body) data.editUrl = body.editUrl || null;

        const updated = await prisma.channelListing.update({
            where: { id },
            data,
        });

        return NextResponse.json({ ok: true, listing: updated });
    } catch (err: unknown) {
        console.error("[channel-listing] error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
