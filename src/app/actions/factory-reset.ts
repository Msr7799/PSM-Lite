"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createBackup() {
    try {
        const units = await prisma.unit.findMany({
            include: {
                feeds: true,
                bookings: true,
                expenses: true,
                content: {
                    include: {
                        channelContents: true,
                    },
                },
                rateRules: true,
                publishLogs: true,
                channelListings: true,
                opsSnapshots: true,
            },
        });

        const payouts = await prisma.payout.findMany({
            include: {
                lines: true,
            },
        });

        const publicPreviewCache = await prisma.publicPreviewCache.findMany();

        const backupData = {
            timestamp: new Date().toISOString(),
            data: {
                units,
                payouts,
                publicPreviewCache,
            },
        };

        return { success: true, data: JSON.stringify(backupData, null, 2) };
    } catch (error) {
        console.error("Backup creation failed:", error);
        return { success: false, error: "Failed to create backup" };
    }
}

export async function performFactoryReset() {
    try {
        await prisma.$transaction([
            // Delete Payouts first (cascades to PayoutLine)
            prisma.payout.deleteMany(),
            // Delete Units (cascades to almost everything else)
            prisma.unit.deleteMany(),
            // Delete Cache
            prisma.publicPreviewCache.deleteMany(),
        ]);

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Factory reset failed:", error);
        return { success: false, error: "Failed to perform factory reset" };
    }
}
