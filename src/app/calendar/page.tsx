import { prisma } from "@/lib/prisma";
import AvailabilityGrid from "./availability-grid";
import { addDays } from "date-fns";

export default async function CalendarPage() {
  const start = new Date();
  const end = addDays(start, 30);

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const bookings = await prisma.booking.findMany({
    where: {
      unitId: { in: units.map((u) => u.id) },
      startDate: { lt: end },
      endDate: { gt: start },
    },
    orderBy: [{ unitId: "asc" }, { startDate: "asc" }],
  });

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">Calendar</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Next 30 days availability grid (iCal-based).
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <AvailabilityGrid units={units} bookings={bookings} />
      </div>
    </main>
  );
}
