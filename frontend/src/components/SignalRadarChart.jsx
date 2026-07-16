import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useTheme } from "../lib/theme.jsx";

const SHORT = {
  shopify: "Transaction",
  salesforce: "Engagement",
  zendesk: "Support",
  google_analytics: "Sessions",
  yotpo: "Loyalty",
  klaviyo: "Email/SMS",
};

export default function SignalRadarChart({ contributions }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const data = (contributions || []).map((c) => ({
    axis: SHORT[c.source] || c.source,
    risk: c.normalized_score,
    weighted: c.weighted_contribution,
  }));

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        No signal data available
      </div>
    );
  }

  const grid = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#94a3b8" : "#475569";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={grid} />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: text, fontSize: 12, fontWeight: 600 }}
        />
        <PolarRadiusAxis
          domain={[0, 100]}
          tick={{ fill: text, fontSize: 10 }}
          stroke={grid}
        />
        <Radar
          name="Churn risk"
          dataKey="risk"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.45}
        />
        <Tooltip
          contentStyle={{
            background: dark ? "#0f172a" : "#fff",
            border: `1px solid ${grid}`,
            borderRadius: 12,
            fontSize: 12,
          }}
          formatter={(v, n) => [`${Number(v).toFixed(1)}`, n === "risk" ? "Risk (0-100)" : n]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
