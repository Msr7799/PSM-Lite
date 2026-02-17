import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

export default async function ImportsPage() {
  const t = await getTranslations();

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold">{t("imports_title")}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("imports_desc")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href="/imports/booking/ops"
          className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80"
        >
          <div className="text-base font-semibold">{t("imports_booking_ops_title")}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("imports_booking_ops_desc")}</div>
        </Link>

        <div className="rounded-2xl border border-dashed border-slate-500/40 bg-white/5 p-4 text-sm text-slate-300">
          {t("imports_more_soon")}
        </div>
      </div>
    </main>
  );
}
