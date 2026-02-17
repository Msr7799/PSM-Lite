import { prisma } from "@/lib/prisma";
import ExpensesClient from "./expenses-client";
import { getTranslations } from 'next-intl/server';

export default async function ExpensesPage() {
  const t = await getTranslations();

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">{t('expenses')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('track_costs')}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <ExpensesClient units={units} />
      </div>
    </main>
  );
}
