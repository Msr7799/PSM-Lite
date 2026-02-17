import { prisma } from "@/lib/prisma";
import { getOrFetchPublicPreview } from "@/lib/publicPreview";
import { Channel } from "@prisma/client";

export async function POST(req: Request) {
    try {
        const { unitId, url, channel } = await req.json();
        if (!unitId || !url || !channel) {
            return new Response("Missing fields", { status: 400 });
        }

        const listing = await prisma.channelListing.upsert({
            where: {
                channel_externalId: {
                    channel: channel as Channel,
                    externalId: url // simplified externalId usage, better to parse from url but for now url is unique enough or use url as externalId
                }
            },
            update: { publicUrl: url },
            create: {
                unitId,
                channel: channel as Channel,
                publicUrl: url,
                externalId: url // using url as externalId for simplicity unless parsed
            }
        });

        // Fetch preview immediately
        await getOrFetchPublicPreview(url, { force: true });

        return Response.json({ ok: true, listing });
    } catch (e) {
        return new Response("Error: " + String(e), { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return new Response("Missing id", { status: 400 });

        await prisma.channelListing.delete({ where: { id } });
        return Response.json({ ok: true });
    } catch (e) {
        return new Response("Error: " + String(e), { status: 500 });
    }
}
