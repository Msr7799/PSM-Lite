import { prisma } from "@/lib/prisma";
import { getTranslations } from 'next-intl/server';
import CalendarClient from "./calendar-client";

export default async function CalendarPage() {
  const t = await getTranslations();

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">{t('calendar')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('calendar_desc')}
        </p>
      </div>

      <CalendarClient units={units} />
    </main>
  );
}
