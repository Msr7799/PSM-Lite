import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Channel } from "@prisma/client";

export const runtime = "nodejs";

type MappedRow = {
    bookingPropertyId: string;
    propertyName: string;
    locationText?: string;
    statusText?: string;
    checkins48h?: number;
    checkouts48h?: number;
    guestMessagesCount?: number;
    bookingMessagesCount?: number;
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { rows, mapping } = body as {
            rows: Record<string, string>[];
            mapping: Record<string, string>;
        };

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: "No rows provided." }, { status: 400 });
        }

        if (!mapping || !mapping.bookingPropertyId || !mapping.propertyName) {
            return NextResponse.json(
                { error: "Missing required mapping: bookingPropertyId, propertyName" },
                { status: 400 }
            );
        }

        const results: {
            created: number;
            updated: number;
            errors: string[];
        } = { created: 0, updated: 0, errors: [] };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                const mapped: MappedRow = {
                    bookingPropertyId: String(
                        row[mapping.bookingPropertyId] ?? ""
                    ).trim(),
                    propertyName: String(row[mapping.propertyName] ?? "").trim(),
                    locationText: mapping.locationText
                        ? String(row[mapping.locationText] ?? "").trim()
                        : undefined,
                    statusText: mapping.statusText
                        ? String(row[mapping.statusText] ?? "").trim()
                        : undefined,
                    checkins48h: mapping.checkins48h
                        ? parseInt(String(row[mapping.checkins48h] ?? "0"), 10) || 0
                        : 0,
                    checkouts48h: mapping.checkouts48h
                        ? parseInt(String(row[mapping.checkouts48h] ?? "0"), 10) || 0
                        : 0,
                    guestMessagesCount: mapping.guestMessagesCount
                        ? parseInt(String(row[mapping.guestMessagesCount] ?? "0"), 10) || 0
                        : 0,
                    bookingMessagesCount: mapping.bookingMessagesCount
                        ? parseInt(String(row[mapping.bookingMessagesCount] ?? "0"), 10) ||
                        0
                        : 0,
                };

                if (!mapped.bookingPropertyId || !mapped.propertyName) {
                    results.errors.push(
                        `Row ${i + 1}: Missing bookingPropertyId or propertyName`
                    );
                    continue;
                }

                // Check if ChannelListing exists
                const existing = await prisma.channelListing.findUnique({
                    where: {
                        channel_externalId: {
                            channel: Channel.BOOKING,
                            externalId: mapped.bookingPropertyId,
                        },
                    },
                    include: { unit: true },
                });

                let unitId: string;

                if (existing) {
                    // Update existing
                    unitId = existing.unitId;
                    await prisma.unit.update({
                        where: { id: unitId },
                        data: { name: mapped.propertyName },
                    });
                    results.updated++;
                } else {
                    // Check if unit exists by name to avoid duplicates
                    const existingUnitByName = await prisma.unit.findFirst({
                        where: { name: mapped.propertyName }
                    });

                    if (existingUnitByName) {
                        // Case: Unit exists but wasn't linked to Booking.com yet.
                        // Link it now to avoid creating a duplicate unit.
                        unitId = existingUnitByName.id;

                        await prisma.channelListing.create({
                            data: {
                                unitId,
                                channel: Channel.BOOKING,
                                externalId: mapped.bookingPropertyId,
                            },
                        });
                        results.updated++;
                    } else {
                        // Case: New unit completely.
                        const unit = await prisma.unit.create({
                            data: {
                                name: mapped.propertyName,
                                isActive: true,
                            },
                        });
                        unitId = unit.id;

                        await prisma.channelListing.create({
                            data: {
                                unitId,
                                channel: Channel.BOOKING,
                                externalId: mapped.bookingPropertyId,
                            },
                        });
                        results.created++;
                    }
                }

                // Upsert ops snapshot
                await prisma.channelOpsSnapshot.create({
                    data: {
                        unitId,
                        channel: Channel.BOOKING,
                        statusText: mapped.statusText ?? null,
                        locationText: mapped.locationText ?? null,
                        checkins48h: mapped.checkins48h ?? 0,
                        checkouts48h: mapped.checkouts48h ?? 0,
                        guestMessagesCount: mapped.guestMessagesCount ?? 0,
                        bookingMessagesCount: mapped.bookingMessagesCount ?? 0,
                    },
                });
            } catch (rowErr: unknown) {
                const message =
                    rowErr instanceof Error ? rowErr.message : "Unknown error";
                results.errors.push(`Row ${i + 1}: ${message}`);
            }
        }

        return NextResponse.json({ ok: true, results });
    } catch (err: unknown) {
        console.error("[import] error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
