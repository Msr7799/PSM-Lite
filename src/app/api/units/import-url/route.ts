import { prisma } from "@/lib/prisma";
import { getOrFetchPublicPreview } from "@/lib/publicPreview";
import { Channel } from "@prisma/client";

export async function POST(req: Request) {
    try {
        const { url } = await req.json();
        if (!url) return new Response("URL is required", { status: 400 });

        // 1. Fetch preview data (this handles caching and scraping)
        const preview = await getOrFetchPublicPreview(url, { force: true });

        if (!preview.ogTitle) {
            return new Response("Could not fetch property details. Please check the URL.", { status: 400 });
        }

        // 2. Extract external ID if possible (basic heuristic for Booking.com)
        // Booking.com urls usually look like: https://www.booking.com/hotel/sa/some-name.html
        let externalId = "imported-" + Date.now();
        try {
            const u = new URL(url);
            const pathParts = u.pathname.split('/').filter(Boolean);
            const hotelName = pathParts.find(p => p.endsWith('.html'))?.replace('.html', '') || pathParts[pathParts.length - 1];
            if (hotelName) externalId = hotelName;
        } catch (e) { }

        // 3. Create Unit
        const unit = await prisma.unit.create({
            data: {
                name: preview.ogTitle.split('|')[0].trim() || "New Unit", // Booking titles often have '| Booking.com'
                isActive: true,
                channelListings: {
                    create: {
                        channel: Channel.BOOKING,
                        publicUrl: url,
                        externalId: externalId
                    }
                }
            }
        });

        return Response.json({ unit });
    } catch (e) {
        console.error(e);
        return new Response("Internal Server Error: " + String(e), { status: 500 });
    }
}
