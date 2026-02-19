"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBackup, performFactoryReset } from "@/app/actions/factory-reset";
import { Loader2, Trash2 } from "lucide-react";
import { ACCENTS, THEME_KEY, applyTheme, normalizeThemeState, type AccentKey, type ThemeState } from "@/lib/theme";

function FactoryResetButton() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleReset = async () => {
    if (!confirm(t("settings_reset_confirm_1"))) return;

    setLoading(true);
    try {
      const backup = await createBackup();
      if (!backup.success || !backup.data) throw new Error(backup.error);

      const blob = new Blob([backup.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pms-lite-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);

      await new Promise((resolve) => setTimeout(resolve, 800));

      if (!confirm(t("settings_reset_confirm_2"))) {
        setLoading(false);
        return;
      }

      const result = await performFactoryReset();
      if (!result.success) throw new Error(result.error);

      alert(t("settings_reset_done"));
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(t("settings_reset_error", { message: e?.message || "Unknown error" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {loading ? t("settings_processing") : t("settings_reset")}
    </button>
  );
}

export default function SettingsClient() {
  const t = useTranslations();
  const [state, setState] = React.useState<ThemeState>({ accent: "blue" });
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw) {
        const parsed = normalizeThemeState(JSON.parse(raw));
        if (parsed) {
          setState(parsed);
          applyTheme(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }

    applyTheme({ accent: "blue" });
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    applyTheme(state);
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [mounted, state]);

  const current = ACCENTS[state.accent] ?? ACCENTS.blue;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium text-slate-900 dark:text-slate-200">
          {t("settings_accent")}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
            const item = ACCENTS[key];
            const active = state.accent === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setState({ accent: key })}
                className={
                  "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ring-1 ring-transparent " +
                  (active
                    ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)] shadow ring-black/5 dark:ring-white/10"
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200 ring-slate-200/60 dark:bg-[color:var(--sidebar-2)] dark:text-slate-200 dark:hover:bg-white/10 dark:ring-white/10")
                }
              >
                <span
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                  style={{ backgroundColor: item.hex }}
                />
                <span className="whitespace-nowrap">{t(`settings_accent_${key}`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/60 dark:bg-black/20 dark:ring-white/10">
        <div className="text-sm text-slate-700 dark:text-slate-300">
          {t("settings_preview")}
        </div>

        <div className="mt-2 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[color:var(--accent)]" />
          <div className="text-sm text-slate-800 dark:text-slate-200">
            {t("settings_preview_desc")}
          </div>
        </div>

        <div
          className="mt-3 rounded-xl p-3 ring-1 ring-black/5 dark:ring-white/10"
          style={{ background: "var(--accent-soft)" }}
        >
          <div className="text-xs text-slate-700 dark:text-slate-300">
            {t("settings_soft_bg")}
          </div>
          <div className="mt-1 text-sm font-medium" style={{ color: "var(--accent)" }}>
            {t("settings_current_accent", {
              label: t(`settings_accent_${state.accent}`),
              hex: current.hex,
            })}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-8">
        <div className="text-sm font-medium text-red-600 dark:text-red-400">
          {t("settings_danger_zone")}
        </div>

        <div className="mt-2 rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-200">
                {t("settings_factory_reset")}
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-400">
                {t("settings_factory_reset_desc")}
              </div>
            </div>
            <FactoryResetButton />
          </div>
        </div>
      </div>
    </div>
  );
}
