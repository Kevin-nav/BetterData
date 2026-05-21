export const colors = {
  /* Original tokens — preserved */
  ink: "#111827",
  paper: "#f8fafc",
  green: "#0f7b45",
  gold: "#f2b705",
  red: "#d92d20",
  line: "#d9e2ec",

  /* Extended palette */
  greenLight: "#e6f4ed",
  greenDark: "#0a5c33",
  goldLight: "#fef7e0",
  goldDark: "#c49204",
  redLight: "#fef2f2",
  redDark: "#991b1b",

  /* Neutrals */
  white: "#ffffff",
  gray50: "#f8fafc",
  gray100: "#f1f5f9",
  gray200: "#e2e8f0",
  gray300: "#cbd5e1",
  gray400: "#94a3b8",
  gray500: "#64748b",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1e293b",
  gray900: "#0f172a",
  gray950: "#020617",

  /* Semantic */
  info: "#2563eb",
  infoLight: "#eff6ff",
  success: "#0f7b45",
  successLight: "#e6f4ed",
  warning: "#d97706",
  warningLight: "#fffbeb",
  danger: "#d92d20",
  dangerLight: "#fef2f2"
} as const;

export const spacing = {
  0: "0",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px"
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px"
} as const;

export const fontSizes = {
  xs: "0.75rem",
  sm: "0.8125rem",
  base: "0.875rem",
  md: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem"
} as const;

export const fontWeights = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800"
} as const;

export const lineHeights = {
  tight: "1.25",
  normal: "1.5",
  relaxed: "1.625"
} as const;

export const shadows = {
  xs: "0 1px 2px rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px"
} as const;

export const zIndex = {
  dropdown: "10",
  sticky: "20",
  overlay: "30",
  modal: "40",
  toast: "50"
} as const;
