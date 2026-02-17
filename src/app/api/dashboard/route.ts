import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeRatePreview, type RateRuleRow } from "@/lib/rates";

export const runtime = "nodejs";

/**
 * GET /api/dashboard
 * Returns all units with channel listing, latest snapshot, preview cache, and rate info.
 */
export async function GET() {
    try {
        const units = await prisma.unit.findMany({
            where: { isActive: true },
            include: {
                content: true,
                channelListings: true,
                opsSnapshots: {
                    orderBy: { capturedAt: "desc" },
                    take: 1,
                },
                rateRules: true,
            },
            orderBy: { createdAt: "asc" },
        });

        const now = new Date();

        const cards = await Promise.all(
            units.map(async (unit) => {
                const listing = unit.channelListings.find(
                    (l) => l.channel === "BOOKING"
                );
                const snapshot = unit.opsSnapshots[0] ?? null;

                // Get cached preview if publicUrl exists
                let preview = null;
                if (listing?.publicUrl) {
                    const cached = await prisma.publicPreviewCache.findUnique({
                        where: { url: listing.publicUrl },
                    });
                    if (cached) {
                        preview = {
                            ogTitle: cached.ogTitle,
                            ogDesc: cached.ogDesc,
                            ogImage: cached.ogImage,
                        };
                    }
                }

                // Compute tonight's rate
                let tonightRate: string | null = null;
                if (unit.rateRules.length > 0) {
                    const rules: RateRuleRow[] = unit.rateRules.map((r) => ({
                        id: r.id,
                        unitId: r.unitId,
                        channel: r.channel,
                        name: r.name,
                        startDate: r.startDate,
                        endDate: r.endDate,
                        baseRate: r.baseRate,
                        weekendRate: r.weekendRate,
                        minNights: r.minNights,
                        maxNights: r.maxNights,
                        stopSell: r.stopSell,
                        daysOfWeek: r.daysOfWeek as number[] | null,
                        priority: r.priority,
                        updatedAt: r.updatedAt,
                    }));

                    const ratePreview = computeRatePreview({
                        start: now,
                        days: 1,
                        channel: null,
                        rules,
                        fallbackRate: unit.defaultRate,
                    });

                    if (ratePreview[0]) {
                        tonightRate = ratePreview[0].rate;
                    }
                } else if (unit.defaultRate) {
                    tonightRate = unit.defaultRate.toString();
                }

                return {
                    id: unit.id,
                    name: unit.name,
                    code: unit.code,
                    currency: unit.currency,
                    address:
                        (unit.content as any)?.address ??
                        unit.content?.addressLine1 ??
                        unit.content?.city ??
                        snapshot?.locationText ??
                        null,
                    guestCapacity: (unit.content as any)?.guestCapacity ?? null,
                    propertyHighlights: (unit.content as any)?.propertyHighlights ?? null,
                    bookingPublicUrl: listing?.publicUrl ?? null,
                    bookingPropertyId: listing?.externalId ?? null,
                    tonightRate,
                    preview,
                    snapshot: snapshot
                        ? {
                            statusText: snapshot.statusText,
                            locationText: snapshot.locationText,
                            checkins48h: snapshot.checkins48h,
                            checkouts48h: snapshot.checkouts48h,
                            guestMessagesCount: snapshot.guestMessagesCount,
                            bookingMessagesCount: snapshot.bookingMessagesCount,
                        }
                        : null,
                };
            })
        );

        return NextResponse.json({ cards });
    } catch (err: unknown) {
        console.error("[dashboard] error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
