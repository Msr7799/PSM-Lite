import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeRatePreview, type RateRuleRow } from "@/lib/rates";

export const runtime = "nodejs";

/**
 * GET /api/property/:id
 * Returns full property detail for read-only display page.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        content: {
          include: { channelContents: true },
        },
        channelListings: true,
        opsSnapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
        rateRules: true,
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const snapshot = unit.opsSnapshots[0] ?? null;
    const listing = unit.channelListings.find((l) => l.channel === "BOOKING");

    // Get cached preview
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
    const now = new Date();
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

    const content = unit.content as any;
    const contentImages = Array.isArray(content?.images) ? content.images : [];

    const property = {
      id: unit.id,
      name: unit.name,
      code: unit.code,
      currency: unit.currency,
      tonightRate,
      defaultRate: unit.defaultRate?.toString() ?? null,
      title: content?.title ?? null,
      description: content?.description ?? null,
      houseRules: content?.houseRules ?? null,
      checkInInfo: content?.checkInInfo ?? null,
      checkOutInfo: content?.checkOutInfo ?? null,
      amenities: Array.isArray(content?.amenities) ? content.amenities : [],
      images: contentImages,
      locationNote: content?.locationNote ?? null,
      address: content?.address ?? content?.addressLine1 ?? content?.city ?? snapshot?.locationText ?? null,
      guestCapacity: content?.guestCapacity ?? null,
      propertyHighlights: content?.propertyHighlights ?? null,
      nearbyPlaces: content?.nearbyPlaces ?? null,
      damageDeposit: content?.damageDeposit ?? null,
      cancellationPolicy: content?.cancellationPolicy ?? null,
      bookingPublicUrl: listing?.publicUrl ?? null,
      bookingPropertyId: listing?.externalId ?? null,
      preview,
      channels: unit.channelListings.map((l) => ({
        channel: l.channel,
        publicUrl: l.publicUrl,
        externalId: l.externalId,
      })),
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

    return NextResponse.json({ property });
  } catch (err: unknown) {
    console.error("[property] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
