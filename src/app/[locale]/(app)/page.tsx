import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

const tile =
  "group rounded-2xl border border-slate-200 bg-sky-100/70 p-4 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80";

export default function Home() {
  const t = useTranslations();

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">{t('dashboard')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('dashboard_desc')}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/units" className={tile}>
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">{t('units_page_title')}</div>
            <span className="rounded-full bg-blue-600/10 px-2 py-1 text-xs text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
              {t('setup')}
            </span>
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('add_units_desc')}</div>
        </Link>

        <Link href="/calendar" className={tile}>
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">{t('calendar')}</div>
            <span className="rounded-full bg-amber-600/10 px-2 py-1 text-xs text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
              {t('view')}
            </span>
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('view_desc')}</div>
        </Link>

        <Link href="/bookings" className={tile}>
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">{t('bookings')}</div>
            <span className="rounded-full bg-emerald-600/10 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              {t('money')}
            </span>
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('money_desc')}</div>
        </Link>

        <Link href="/expenses" className={tile}>
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">{t('expenses')}</div>
            <span className="rounded-full bg-rose-600/10 px-2 py-1 text-xs text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
              {t('costs')}
            </span>
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('costs_desc')}</div>
        </Link>

        <Link href="/reports" className={`${tile} md:col-span-2`}>
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">{t('reports')}</div>
            <span className="rounded-full bg-indigo-600/10 px-2 py-1 text-xs text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300">
              {t('profit')}
            </span>
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('profit_desc')}</div>
        </Link>
      </div>
    </main>
  );
}
