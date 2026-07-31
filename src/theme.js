/** Light / dark palettes for Debt Destroyer — precision finance aesthetic. */

export const DARK = {
  mode: "dark",
  pageBg: "#050810",
  pageMid: "#080D14",
  pageDeep: "#030508",
  asphalt: "#050810",
  surface: "rgba(14, 20, 28, 0.72)",
  surfaceSolid: "#0E141C",
  surface2: "rgba(22, 30, 40, 0.85)",
  surface2Solid: "#161E28",
  line: "rgba(255, 255, 255, 0.08)",
  lineStrong: "rgba(255, 255, 255, 0.14)",
  lineSoft: "rgba(255, 255, 255, 0.05)",
  text: "#F4F7FA",
  muted: "#94A3B4",
  faint: "#5C6B7A",
  green: "#2EF0A0",
  greenDim: "rgba(46, 240, 160, 0.12)",
  greenGlow: "rgba(46, 240, 160, 0.35)",
  red: "#FF6B7A",
  redDim: "rgba(255, 107, 122, 0.12)",
  amber: "#FFC857",
  amberDim: "rgba(255, 200, 87, 0.12)",
  lane: "#FFC857",
  blue: "#6BB8FF",
  navBg: "rgba(8, 12, 18, 0.88)",
  navHover: "rgba(255, 255, 255, 0.04)",
  glowLane: "rgba(255, 200, 87, 0.08)",
  glowGreen: "rgba(46, 240, 160, 0.06)",
  glowBlue: "rgba(107, 184, 255, 0.05)",
  glowAccent: "rgba(46, 240, 160, 0.08)",
  heroGlow: "rgba(255, 200, 87, 0.14)",
  cardShadow: "0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.03) inset",
  cardShadowHover: "0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
  focusRing: "rgba(46, 240, 160, 0.22)",
  scrollbarThumb: "#2A3542",
};

export const LIGHT = {
  mode: "light",
  pageBg: "#E4EBF4",
  pageMid: "#EEF2F8",
  pageDeep: "#D5DEE9",
  asphalt: "#0A1220",
  surface: "rgba(255, 255, 255, 0.82)",
  surfaceSolid: "#FFFFFF",
  surface2: "rgba(241, 246, 252, 0.9)",
  surface2Solid: "#F1F6FC",
  line: "rgba(15, 23, 42, 0.1)",
  lineStrong: "rgba(15, 23, 42, 0.16)",
  lineSoft: "rgba(15, 23, 42, 0.06)",
  text: "#0C1524",
  muted: "#5A6B7D",
  faint: "#8494A7",
  green: "#0A9B68",
  greenDim: "rgba(10, 155, 104, 0.12)",
  greenGlow: "rgba(10, 155, 104, 0.25)",
  red: "#DC3545",
  redDim: "rgba(220, 53, 69, 0.1)",
  amber: "#B45309",
  amberDim: "rgba(180, 83, 9, 0.1)",
  lane: "#B45309",
  blue: "#1D6FD8",
  navBg: "rgba(255, 255, 255, 0.9)",
  navHover: "rgba(15, 23, 42, 0.04)",
  glowLane: "rgba(180, 83, 9, 0.08)",
  glowGreen: "rgba(10, 155, 104, 0.06)",
  glowBlue: "rgba(29, 111, 216, 0.05)",
  glowAccent: "rgba(10, 155, 104, 0.08)",
  heroGlow: "rgba(180, 83, 9, 0.1)",
  cardShadow: "0 4px 20px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.04) inset",
  cardShadowHover: "0 8px 28px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.06) inset",
  focusRing: "rgba(10, 155, 104, 0.2)",
  scrollbarThumb: "#C5D0DC",
};

export const THEME_OPTIONS = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "system", label: "System" },
];

export function resolveThemeMode(preference = "dark") {
  const pref = String(preference || "dark").toLowerCase();
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

export function paletteFor(mode) {
  return mode === "light" ? LIGHT : DARK;
}

/** Sync palette tokens to CSS custom properties on :root */
export function applyCssVars(palette, root = typeof document !== "undefined" ? document.documentElement : null) {
  if (!root) return;
  const map = {
    "--dd-page-bg": palette.pageBg,
    "--dd-surface": palette.surfaceSolid || palette.surface,
    "--dd-surface-2": palette.surface2Solid || palette.surface2,
    "--dd-line": palette.line,
    "--dd-line-strong": palette.lineStrong,
    "--dd-green": palette.green,
    "--dd-green-glow": palette.greenGlow,
    "--dd-glow-accent": palette.glowAccent,
    "--dd-glow-lane": palette.glowLane,
    "--dd-glow-blue": palette.glowBlue,
    "--dd-hero-glow": palette.heroGlow,
    "--dd-focus-ring": palette.focusRing,
    "--dd-nav-hover": palette.navHover,
    "--dd-scrollbar-thumb": palette.scrollbarThumb,
    "--dd-text": palette.text,
    "--dd-muted": palette.muted,
    "--dd-faint": palette.faint,
  };
  Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
}
