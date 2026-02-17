import { prisma } from "@/lib/prisma";
import RatesClient from "./rates-client";
import { getTranslations } from 'next-intl/server';

export default async function RatesPage() {
  const t = await getTranslations();

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    select: { id: true, name: true, currency: true, defaultRate: true },
    orderBy: { createdAt: "asc" },
  });

  const safeUnits = (units as any[]).map((u) => ({
    ...u,
    defaultRate: u.defaultRate?.toString() ?? null,
  }));

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">{t('rates_rules')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('rates_desc')}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <RatesClient units={safeUnits} />
      </div>
    </main>
  );
}
