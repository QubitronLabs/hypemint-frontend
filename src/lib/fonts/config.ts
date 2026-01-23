/**
 * Global Font Configuration
 *
 * This file contains all font settings for the HypeMint platform.
 * To change fonts site-wide, simply modify the values below.
 *
 * Available Google Fonts: https://fonts.google.com/
 *
 * Popular choices for crypto/fintech platforms:
 * - Inter (clean, modern)
 * - Plus Jakarta Sans (friendly, professional)
 * - Space Grotesk (techy, futuristic)
 * - DM Sans (elegant, minimal)
 * - Manrope (geometric, clean)
 * - Outfit (modern, versatile)
 * - Sora (geometric, contemporary)
 * - Urbanist (minimal, trendy)
 */

export const fontConfig = {
  // Primary font for body text, headings, and UI elements
  primary: {
    name: "Inter",
    variable: "--font-primary",
    weights: ["300", "400", "500", "600", "700", "800"],
  },

  // Monospace font for numbers, code, addresses, and prices
  mono: {
    name: "JetBrains Mono",
    variable: "--font-mono",
    weights: ["400", "500", "600", "700"],
  },

  // Display font for large headings and hero text (optional, falls back to primary)
  display: {
    name: "Space Grotesk",
    variable: "--font-display",
    weights: ["400", "500", "600", "700"],
  },
} as const;

// Font size scale - uses Tailwind's default scale
export const fontSizeScale = {
  xs: "0.75rem", // 12px
  sm: "0.875rem", // 14px
  base: "1rem", // 16px
  lg: "1.125rem", // 18px
  xl: "1.25rem", // 20px
  "2xl": "1.5rem", // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem", // 36px
  "5xl": "3rem", // 48px
} as const;

// Font weight tokens
export const fontWeights = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

// Line height tokens
export const lineHeights = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

// Letter spacing tokens
export const letterSpacing = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0em",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
} as const;

// Typography presets for common use cases
export const typographyPresets = {
  // Hero/Landing page headings
  hero: {
    fontFamily:
      "var(--font-display), var(--font-primary), system-ui, sans-serif",
    fontSize: "3rem",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
  },

  // Section headings
  h1: {
    fontFamily: "var(--font-primary), system-ui, sans-serif",
    fontSize: "2.25rem",
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
  },

  h2: {
    fontFamily: "var(--font-primary), system-ui, sans-serif",
    fontSize: "1.875rem",
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
  },

  h3: {
    fontFamily: "var(--font-primary), system-ui, sans-serif",
    fontSize: "1.5rem",
    fontWeight: 600,
    lineHeight: 1.4,
  },

  // Body text
  body: {
    fontFamily: "var(--font-primary), system-ui, sans-serif",
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: 1.5,
  },

  bodySmall: {
    fontFamily: "var(--font-primary), system-ui, sans-serif",
    fontSize: "0.875rem",
    fontWeight: 400,
    lineHeight: 1.5,
  },

  // Labels and captions
  label: {
    fontFamily: "var(--font-primary), system-ui, sans-serif",
    fontSize: "0.875rem",
    fontWeight: 500,
    lineHeight: 1.4,
  },

  caption: {
    fontFamily: "var(--font-primary), system-ui, sans-serif",
    fontSize: "0.75rem",
    fontWeight: 400,
    lineHeight: 1.4,
  },

  // Prices and numbers
  price: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "1rem",
    fontWeight: 600,
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
  },

  priceSmall: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "0.875rem",
    fontWeight: 500,
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
  },

  // Wallet addresses and hashes
  address: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "0.75rem",
    fontWeight: 400,
    lineHeight: 1.4,
  },

  // Button text
  button: {
    fontFamily: "var(--font-primary), system-ui, sans-serif",
    fontSize: "0.875rem",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "0.01em",
  },
} as const;

export type FontConfig = typeof fontConfig;
export type TypographyPresets = typeof typographyPresets;
