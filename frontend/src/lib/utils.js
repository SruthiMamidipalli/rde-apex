import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Risk band metadata — hex values from apex-combined.html band dots.
export const RISK_META = {
  LOW: {
    label: "LOW",
    text: "text-apex-low",
    bg: "bg-apex-low/10",
    border: "border-apex-low/25",
    dot: "bg-apex-low",
    hex: "#30D158",
  },
  MEDIUM: {
    label: "MED",
    text: "text-apex-amber",
    bg: "bg-apex-med/15",
    border: "border-apex-med/40",
    dot: "bg-apex-med",
    hex: "#FFCC00",
  },
  HIGH: {
    label: "HIGH",
    text: "text-apex-high",
    bg: "bg-apex-high/10",
    border: "border-apex-high/25",
    dot: "bg-apex-high",
    hex: "#FF9500",
  },
  CRITICAL: {
    label: "CRITICAL",
    text: "text-apex-crit",
    bg: "bg-apex-crit/10",
    border: "border-apex-crit/25",
    dot: "bg-apex-crit",
    hex: "#FF3B30",
  },
};

export const TIER_META = {
  Bronze: "text-amber-800 bg-amber-100",
  Silver: "text-slate-700 bg-slate-200",
  Gold: "text-yellow-800 bg-yellow-100",
  Platinum: "text-indigo-700 bg-indigo-100",
};

// Shared recharts theming for the light "zentra" design.
export const CHART = {
  axisTick: { fill: "#6b7280", fontSize: 10 },
  grid: "#e7eaf0",
  tooltip: {
    background: "#ffffff",
    border: "1px solid #e7eaf0",
    borderRadius: 12,
    fontSize: 11,
    boxShadow: "0 8px 32px rgba(16,24,40,0.12)",
    color: "#0d0f14",
  },
  accent: "#7745e6",
  accent2: "#10b981",
  muted: "#9ca3af",
};

// Source-system short labels + citation tags.
export const SOURCE_LABEL = {
  google_analytics: "GA",
  yotpo: "Yotpo",
  zendesk: "Zendesk",
  shopify: "Shopify",
  klaviyo: "Klaviyo",
  salesforce: "CRM",
};

export function money(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function moneyExact(n) {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function microMoney(n) {
  if (n == null) return "$0.00";
  if (n < 0.01 && n > 0) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

export function fmtNum(n, digits = 1) {
  if (n == null) return "—";
  return Number(n).toFixed(digits);
}

export function fmtInt(n) {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

// Format a KPI value by its declared format type.
export function fmtKpi(value, format) {
  if (value == null) return "—";
  switch (format) {
    case "pct":
      return `${fmtNum(value, 1)}%`;
    case "money":
      return money(value);
    case "minutes":
      return value < 1 ? `${Math.round(value * 60)}s` : `${fmtNum(value, 1)} min`;
    case "days":
      return `${fmtNum(value, 0)} days`;
    case "count":
      return fmtInt(value);
    case "score":
      return `${fmtNum(value, 0)}/100`;
    default:
      return String(value);
  }
}

// Decide good/warn/bad color given value, target and direction.
export function kpiTone(value, target, direction) {
  if (target == null || direction === "neutral") return "text-apex-text";
  if (direction === "lower") {
    if (value <= target) return "text-apex-green";
    if (value <= target * 1.5) return "text-apex-amber";
    return "text-apex-red";
  }
  // higher is better
  if (value >= target) return "text-apex-green";
  if (value >= target * 0.7) return "text-apex-amber";
  return "text-apex-red";
}

// Progress fraction toward target for a KPI bar.
export function kpiProgress(value, target, direction) {
  if (!target) return 60;
  if (direction === "lower") {
    return Math.min(100, Math.max(5, (target / Math.max(value, 0.01)) * 60));
  }
  return Math.min(100, Math.max(5, (value / target) * 100));
}
