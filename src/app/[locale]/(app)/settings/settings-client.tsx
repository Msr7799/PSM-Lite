"use client";

import * as React from "react";
import { createBackup, performFactoryReset } from "@/app/actions/factory-reset";
import { Loader2, Trash2 } from "lucide-react";

const THEME_KEY = "pmslite_theme_v1";

type ThemeState = {
  accent: "blue" | "orange";
};

function applyTheme(state: ThemeState) {
  const root = document.documentElement;
  root.style.setProperty("--accent", state.accent === "blue" ? "#60a5fa" : "#fb923c");
}

function FactoryResetButton() {
  const [loading, setLoading] = React.useState(false);

  const handleReset = async () => {
    if (!confirm("Are you sure you want to perform a factory reset? This will wipe all data.")) return;

    setLoading(true);
    try {
      // 1. Backup
      const backup = await createBackup();
      if (!backup.success || !backup.data) throw new Error(backup.error);

      // Trigger download
      const blob = new Blob([backup.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pms-lite-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 2. Confirm Wipe
      // We need a small delay or a second confirmation to ensure download started
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!confirm("Backup downloaded successfully. Do you want to proceed with WIPING ALL DATA? This cannot be undone.")) {
        setLoading(false);
        return;
      }

      // 3. Wipe
      const result = await performFactoryReset();
      if (!result.success) throw new Error(result.error);

      alert("Factory reset complete. The application will now reload.");
      window.location.href = "/";
    } catch (e: any) {
      console.error(e);
      alert("An error occurred: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {loading ? "Processing..." : "Reset"}
    </button>
  );
}

export default function SettingsClient() {
  const [state, setState] = React.useState<ThemeState>({ accent: "blue" });
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ThemeState;
        if (parsed?.accent === "blue" || parsed?.accent === "orange") {
          setState(parsed);
          applyTheme(parsed);
        }
      } else {
        applyTheme({ accent: "blue" });
      }
    } catch {
      applyTheme({ accent: "blue" });
    }
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

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium text-slate-200">Accent</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setState({ accent: "blue" })}
            className={
              "rounded-xl px-3 py-2 text-sm transition " +
              (state.accent === "blue"
                ? "bg-[color:var(--accent)] text-white"
                : "bg-[color:var(--sidebar-2)] text-slate-200 hover:bg-white/10")
            }
          >
            Light Blue
          </button>
          <button
            type="button"
            onClick={() => setState({ accent: "orange" })}
            className={
              "rounded-xl px-3 py-2 text-sm transition " +
              (state.accent === "orange"
                ? "bg-[color:var(--accent)] text-white"
                : "bg-[color:var(--sidebar-2)] text-slate-200 hover:bg-white/10")
            }
          >
            Orange
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-black/20 p-4">
        <div className="text-sm text-slate-300">Preview</div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[color:var(--accent)]" />
          <div className="text-sm text-slate-200">This color is used for highlights in the sidebar.</div>
        </div>
      </div>

      <div className="pt-8">
        <div className="text-sm font-medium text-red-400">Danger Zone</div>
        <div className="mt-2 rounded-2xl border border-red-900/50 bg-red-950/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-200">Factory Reset</div>
              <div className="text-xs text-slate-400">
                This will delete all data including bookings, units, and content.
              </div>
            </div>
            <FactoryResetButton />
          </div>
        </div>
      </div>
    </div>
  );
}
