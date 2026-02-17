import { prisma } from "@/lib/prisma";
import BookingsClient from "./bookings-client";

export default async function BookingsPage() {
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">Bookings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Add financials for each booking (gross, commission, taxes, fees). Net is auto-calculated if you leave it empty.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <BookingsClient units={units} />
      </div>
    </main>
  );
}
