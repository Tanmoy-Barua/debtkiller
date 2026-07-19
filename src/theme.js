/** Light / dark palettes for Debt Destroyer (cockpit look). */

export const DARK = {
  mode: "dark",
  pageBg: "#070B10",
  pageMid: "#0A1018",
  pageDeep: "#06090D",
  asphalt: "#070B10", // ink on bright accents
  surface: "#121820",
  surface2: "#1A222C",
  line: "#2A3542",
  lineSoft: "#1E2732",
  text: "#F2F5F8",
  muted: "#8A97A6",
  faint: "#5B6875",
  green: "#3DDC97",
  greenDim: "#164A38",
  red: "#FF6B6B",
  redDim: "#4A1F1F",
  amber: "#F5C451",
  amberDim: "#4A3A12",
  lane: "#FFE566",
  blue: "#6BB0FF",
  navBg: "rgba(11,15,20,0.94)",
  glowLane: "rgba(255,229,102,.09)",
  glowGreen: "rgba(61,220,151,.05)",
};

/** Cool steel light theme — keeps green/amber accents, avoids cream/purple defaults. */
export const LIGHT = {
  mode: "light",
  pageBg: "#E8EEF5",
  pageMid: "#F3F6FA",
  pageDeep: "#D9E2EC",
  asphalt: "#0B1220", // ink on bright accents
  surface: "#FFFFFF",
  surface2: "#F1F5FA",
  line: "#CDD7E3",
  lineSoft: "#E2E8F0",
  text: "#0F172A",
  muted: "#5B6B7C",
  faint: "#8494A7",
  green: "#0B9B6A",
  greenDim: "#D0F5E6",
  red: "#DC2626",
  redDim: "#FEE2E2",
  amber: "#C27803",
  amberDim: "#FEF3C7",
  lane: "#B45309",
  blue: "#1D6FD8",
  navBg: "rgba(255,255,255,0.92)",
  glowLane: "rgba(180,83,9,.10)",
  glowGreen: "rgba(11,155,106,.07)",
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
