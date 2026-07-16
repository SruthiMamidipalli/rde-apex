import { useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  Legend,
} from "recharts";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { KpiCard, Panel, Spinner } from "../components/ui.jsx";
import AiFlag from "../components/AiFlag.jsx";
import { money, moneyExact, fmtKpi, CHART } from "../lib/utils";

export default function ImpactRoi() {
  const { setContext, showToast } = useStore();
  const impact = useApi(() => api.kpiImpactRoi(), []);
  const comparison = useApi(() => api.comparison(), []);
  useEffect(() => setContext({ page: "Impact & ROI", customer_id: null }), [setContext]);

  const roi = impact.data?.roi;
  const kpis = impact.data?.kpis || [];

  // Before/after bars for the headline KPIs that have baselines.
  const baData = kpis
    .filter((k) => k.baseline != null && k.format === "pct")
    .map((k) => ({ name: k.name.replace(/ Rate| \/ yr/, ""), Before: k.baseline, After: k.value }));

  return (
    <div className="space-y-4">
      <AiFlag
        area="Impact & ROI"
        severity="orange"
        confidence={86}
        text={
          <>
            <strong>Reward redemption</strong> is improving but still under the 35%
            goal. Offering double points to inactive Gold and Platinum members
            would speed it up. Everything else is on track.
          </>
        }
        evidence={["Redemption rate", "Customer save rate"]}
        onToast={showToast}
      />

      {/* ROI model */}
      {roi && (
        <div className="grid gap-3 sm:grid-cols-4">
          <RoiTile label="Platform cost" value={money(roi.platform_cost)} />
          <RoiTile label="Revenue protected / yr" value={money(roi.revenue_protected)} color="text-apex-green" />
          <RoiTile label="Net value" value={money(roi.net)} color={roi.net >= 0 ? "text-apex-green" : "text-apex-red"} />
          <RoiTile label="ROI multiple" value={`${roi.roi_multiple}×`} color="text-apex-green" />
        </div>
      )}

      {impact.loading && <Spinner label="Computing outcome KPIs…" />}

      {/* KPI scorecard */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.name} kpi={k} />
          ))}
        </div>
      )}

      {/* Before -> After */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Before → After (Case Study Slides 8/9)">
          <div className="p-3">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={baData} margin={{ left: -10, right: 10 }}>
                <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={CHART.axisTick} />
                <Tooltip
                  contentStyle={CHART.tooltip}
                  formatter={(v) => `${v}%`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Before" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="After" fill="#7745e6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Manual vs Agentic — Speed & Effort">
          {comparison.loading && <div className="p-4"><Spinner /></div>}
          <div className="divide-y divide-apex-border/60">
            {(comparison.data?.metrics || []).map((m) => (
              <div key={m.label} className="px-4 py-3">
                <div className="text-[12px] font-semibold">{m.label}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  <span className="rounded bg-apex-surface3 px-2 py-0.5 text-apex-muted">{m.manual}</span>
                  <span className="text-apex-muted">→</span>
                  <span className="rounded bg-apex-accent/15 px-2 py-0.5 text-apex-green">{m.agentic}</span>
                  <span className="ml-auto text-[10px] font-semibold text-apex-green">{m.improvement}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RoiTile({ label, value, color }) {
  return (
    <div className="panel p-4">
      <div className="label-caps">{label}</div>
      <div className={`mt-1 text-[22px] font-extrabold ${color || "text-apex-text"}`}>{value}</div>
    </div>
  );
}
