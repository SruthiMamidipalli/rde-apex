import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Risk band metadata keyed to the Apex palette.
export const RISK_META = {
  LOW: {
    label: "LOW",
    text: "text-apex-green",
    bg: "bg-apex-green/10",
    border: "border-apex-green/25",
    dot: "bg-apex-green",
    hex: "#34d399",
  },
  MEDIUM: {
    label: "MED",
    text: "text-apex-amber",
    bg: "bg-apex-amber/10",
    border: "border-apex-amber/25",
    dot: "bg-apex-amber",
    hex: "#f59e0b",
  },
  HIGH: {
    label: "HIGH",
    text: "text-apex-orange",
    bg: "bg-apex-orange/10",
    border: "border-apex-orange/25",
    dot: "bg-apex-orange",
    hex: "#fb923c",
  },
  CRITICAL: {
    label: "CRITICAL",
    text: "text-apex-red",
    bg: "bg-apex-red/10",
    border: "border-apex-red/25",
    dot: "bg-apex-red",
    hex: "#f87171",
  },
};

export const TIER_META = {
  Bronze: "text-amber-300 bg-amber-900/30",
  Silver: "text-slate-200 bg-slate-600/40",
  Gold: "text-yellow-300 bg-yellow-900/30",
  Platinum: "text-indigo-300 bg-indigo-900/40",
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
