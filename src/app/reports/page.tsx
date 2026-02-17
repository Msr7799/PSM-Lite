import ReportsClient from "./reports-client";

export default function ReportsPage() {
  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Profit = net bookings - expenses (BHD).
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <ReportsClient />
      </div>
    </main>
  );
}
