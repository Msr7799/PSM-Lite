"use client";

import * as React from "react";
import { THEME_KEY, applyTheme, normalizeThemeState, type ThemeState } from "@/lib/theme";

export function ThemeInit() {
  React.useEffect(() => {
    // Apply theme on first paint (client)
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw) {
        const parsed = normalizeThemeState(JSON.parse(raw));
        if (parsed) {
          applyTheme(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }

    applyTheme({ accent: "blue" });

    // Keep in sync if theme changes in another tab/window
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return;
      try {
        const parsed = e.newValue ? normalizeThemeState(JSON.parse(e.newValue)) : null;
        applyTheme(parsed ?? ({ accent: "blue" } as ThemeState));
      } catch {
        applyTheme({ accent: "blue" });
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}
