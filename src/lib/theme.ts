export const THEME_KEY = "pmslite_theme_v1";

export const ACCENTS = {
  blue:   { label: "Light Blue", hex: "#60a5fa", foreground: "#0b1220", soft: "rgba(96,165,250,0.16)" },
  orange: { label: "Orange",     hex: "#fb923c", foreground: "#1a0f07", soft: "rgba(251,146,60,0.16)" },
  green:  { label: "Green",      hex: "#34d399", foreground: "#06130d", soft: "rgba(52,211,153,0.16)" },
  purple: { label: "Purple",     hex: "#a78bfa", foreground: "#0f0b1a", soft: "rgba(167,139,250,0.16)" },
  teal:   { label: "Teal",       hex: "#2dd4bf", foreground: "#041413", soft: "rgba(45,212,191,0.16)" },
  rose:   { label: "Rose",       hex: "#fb7185", foreground: "#1a070a", soft: "rgba(251,113,133,0.16)" },
  amber:  { label: "Amber",      hex: "#fbbf24", foreground: "#1a1205", soft: "rgba(251,191,36,0.16)" },
  indigo: { label: "Indigo",     hex: "#818cf8", foreground: "#0b0f1f", soft: "rgba(129,140,248,0.16)" },
} as const;

export type AccentKey = keyof typeof ACCENTS;

export type ThemeState = {
  accent: AccentKey;
};

export function normalizeThemeState(value: unknown): ThemeState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as any;
  const accent = v.accent;
  if (typeof accent !== "string") return null;
  if (!(accent in ACCENTS)) return null;
  return { accent: accent as AccentKey };
}

function svgToCursorDataUrl(svg: string) {
  const encoded = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
  return `url("data:image/svg+xml,${encoded}")`;
}

function setAccentCursors(accentHex: string) {
  if (typeof document === "undefined") return;

  const arrowSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <path d="M4 3 L4 25 L10 19 L14 29 L18 27 L14 17 L22 17 Z"
        fill="${accentHex}" stroke="#0b0b0b" stroke-width="1.2" />
    </svg>
  `;

  const pointerSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <path d="M10 16V8c0-1.2.9-2 2-2s2 .8 2 2v7h1V9c0-1.2.9-2 2-2s2 .8 2 2v8h1v-5c0-1.2.9-2 2-2s2 .8 2 2v10c0 4-3 7-7 7h-4c-2 0-4-1-5-3l-2-4c-.7-1.3.2-2.7 1.6-2.7.7 0 1.3.3 1.7.9l1.7 2.5V16z"
        fill="${accentHex}" stroke="#0b0b0b" stroke-width="1.2" />
    </svg>
  `;

  const root = document.documentElement;

  // Hotspots (x y)
  const arrow = `${svgToCursorDataUrl(arrowSvg)} 4 3, auto`;
  const pointer = `${svgToCursorDataUrl(pointerSvg)} 12 6, pointer`;

  root.style.setProperty("--cursor-default", arrow);
  root.style.setProperty("--cursor-pointer", pointer);
}

export function applyTheme(state: ThemeState) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const accent = ACCENTS[state.accent] ?? ACCENTS.blue;

  // Core accent vars
  root.style.setProperty("--accent", accent.hex);
  root.style.setProperty("--accent-foreground", accent.foreground);
  root.style.setProperty("--accent-soft", accent.soft);

  // shadcn mapping (buttons/ring)
  root.style.setProperty("--primary", accent.hex);
  root.style.setProperty("--primary-foreground", accent.foreground);
  root.style.setProperty("--ring", accent.hex);

  // Sidebar active styling helpers
  root.style.setProperty("--sidebar-accent", accent.soft);
  root.style.setProperty("--sidebar-accent-foreground", accent.hex);

  // Cursor follows accent ✅
  setAccentCursors(accent.hex);
}
