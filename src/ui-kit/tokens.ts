// src/ui-kit/tokens.ts
// Single source of truth for UI values.
// Keep this tiny and boring. It should mirror Income/Insights.

export const ui = {
  page: {
    // Matches IncomePage wrapper: padding "18px 16px 28px"
    padding: "18px 16px 28px",
    textColor: "#ffffff",
    // Income cards use width min(720px, calc(100% - 32px))
    // The "32px" is derived from 16px left + 16px right padding.
    contentWidth: "min(720px, calc(100% - 32px))",
  },

  radius: {
    card: 16,
    inner: 14,
    row: 12,
    pill: 999,
  },

  border: {
    subtle: "1px solid rgba(255,255,255,0.12)",
    softer: "1px solid rgba(255,255,255,0.10)",
    rail: "1px solid rgba(120, 120, 120, 0.35)",
  },

  bg: {
    card: "rgba(0,0,0,0.25)",     // Income cardStyle background
    inner: "rgba(0,0,0,0.18)",    // Breakdown tiles
    row: "rgba(255,255,255,0.04)", // Recent Income rows
    rail: "rgba(120, 120, 120, 0.12)",
  },

  shadow: {
    card: "0 8px 30px rgba(0,0,0,0.35)",
  },

  typography: {
    title: { fontSize: 32, fontWeight: 700 },
    labelCaps: { fontSize: 12, letterSpacing: 1.4, opacity: 0.7 },
    valueHero: { fontSize: 32, fontWeight: 800 },
    value: { fontSize: 22, fontWeight: 800 },
  },

  colors: {
    text: "#ffffff",
    muted: "rgba(255,255,255,0.70)",
    muted2: "rgba(255,255,255,0.65)",
    pillText: "#cbd5e1",
    accent: "#3b82f6",
    danger: "#ef4444",
  },
} as const;
