import { Booking, Unit } from "@prisma/client";
import { eachDayOfInterval, format } from "date-fns";

function utcDay(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function isBookedOnDay(b: Booking, day: Date) {
  const dd = utcDay(day).getTime();
  const s = utcDay(b.startDate).getTime();
  const e = utcDay(b.endDate).getTime();
  // booking covers [start, end) in most iCal feeds
  return s <= dd && dd < e;
}

export default function AvailabilityGrid({
  units,
  bookings,
}: {
  units: Unit[];
  bookings: Booking[];
}) {
  const days = eachDayOfInterval({ start: new Date(), end: new Date(Date.now() + 29 * 86400000) });

  const byUnit: Record<string, Booking[]> = {};
  for (const b of bookings) {
    (byUnit[b.unitId] ||= []).push(b);
  }

  return (
    <div className="overflow-auto">
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-950">
            <th className="sticky left-0 z-10 border border-slate-200 bg-slate-50 p-2 text-left font-semibold dark:border-slate-700 dark:bg-slate-950">
              Unit
            </th>
            {days.map((d) => (
              <th
                key={d.toISOString()}
                className="border border-slate-200 p-2 text-center font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                <div>{format(d, "MM-dd")}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{format(d, "EEE")}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const bs = byUnit[u.id] || [];
            return (
              <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/60">
                <td className="sticky left-0 z-10 border border-slate-200 bg-white p-2 font-medium dark:border-slate-700 dark:bg-slate-900">
                  {u.name}
                </td>
                {days.map((d) => {
                  const booked = bs.some((b) => isBookedOnDay(b, d));
                  return (
                    <td
                      key={u.id + d.toISOString()}
                      className={`border border-slate-200 p-2 text-center dark:border-slate-700 ${
                        booked
                          ? "bg-rose-200 dark:bg-rose-900/50"
                          : "bg-emerald-50 dark:bg-emerald-900/20"
                      }`}
                    >
                      <span className="text-xs">{booked ? "Booked" : "Free"}</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {units.length === 0 ? (
            <tr>
              <td
                colSpan={days.length + 1}
                className="border border-slate-200 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400"
              >
                No units yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
