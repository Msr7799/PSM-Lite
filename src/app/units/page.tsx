import { prisma } from "@/lib/prisma";
import UnitsClient from "./units-client";

export default async function UnitsPage() {
  const units = await prisma.unit.findMany({
    include: { feeds: true },
    orderBy: { createdAt: "asc" },
  });

  const safeUnits = units.map((u) => ({
    id: u.id,
    name: u.name,
    code: u.code,
    isActive: u.isActive,
    feeds: u.feeds.map((f) => ({
      id: f.id,
      channel: f.channel,
      type: f.type,
      name: f.name,
      url: f.url,
      lastSyncAt: f.lastSyncAt ? f.lastSyncAt.toISOString() : null,
    })),
  }));

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">Units</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Add your units and attach iCal feeds (URL or .ics file). If you added a wrong feed, delete it here.
        </p>
      </div>

      <UnitsClient initialUnits={safeUnits} />
    </main>
  );
}
