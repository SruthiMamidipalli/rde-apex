import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { KpiCard, Panel, LiveChip, Spinner, RiskBadge } from "../components/ui.jsx";
import AiFlag from "../components/AiFlag.jsx";
import { money, moneyExact, fmtInt } from "../lib/utils";

// 90-day churn trend heading toward the <14% target.
const CHURN_TREND = [
  { d: "90d", v: 28 },
  { d: "75d", v: 27.1 },
  { d: "60d", v: 26 },
  { d: "45d", v: 25.2 },
  { d: "30d", v: 24 },
  { d: "20d", v: 23.5 },
  { d: "10d", v: 23.1 },
  { d: "today", v: 23.1 },
];

export default function CommandCenter() {
  const navigate = useNavigate();
  const { setContext, showToast } = useStore();
  const cc = useApi(() => api.kpiCommandCenter(), []);
  const feed = useApi(() => api.signalsFeed(), []);
  const approvals = useApi(() => api.pendingApprovals(), []);

  useEffect(() => setContext({ page: "Command Center", customer_id: null }), [setContext]);

  const bands = cc.data?.risk_bands || {};
  const pending = approvals.data || [];

  return (
    <div className="space-y-4">
      <AiFlag
        area="Command Center"
        severity="orange"
        confidence={88}
        text={
          <>
            Churn-risk spike in Loyalty Tier 2 —{" "}
            <strong>{fmtInt((bands.HIGH || 0) + (bands.CRITICAL || 0))} customers</strong>{" "}
            at HIGH+ risk. Session-collapse pattern matches the prior churn cohort.
            Work the At-Risk Queue by risk × value first.
          </>
        }
        evidence={["Sessions -60% [GA]", "Zero redemptions [Yotpo]", "Unresolved tickets [Zendesk]"]}
        acceptLabel="✓ Go to At-Risk Queue"
        onAccept={() => navigate("/queue")}
        onToast={showToast}
      />

      {/* KPI row */}
      {cc.loading && <Spinner label="Computing KPIs…" />}
      {cc.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cc.data.kpis.map((k) => (
            <KpiCard key={k.name} kpi={k} />
          ))}
        </div>
      )}

      {/* Revenue ticker */}
      {cc.data && (
        <div className="panel flex flex-wrap items-center gap-4 px-[18px] py-3.5">
          <div>
            <div className="label-caps">Revenue at Risk</div>
            <div className="text-[20px] font-extrabold tracking-tight text-apex-red">
              {money(cc.data.revenue_at_risk)}
            </div>
          </div>
          <Divider />
          <Stat label="Total ARR baseline" value={money(cc.data.total_arr)} />
          <Divider />
          <Stat
            label="Secured (interventions)"
            value={money(cc.data.revenue_secured)}
            color="text-apex-green"
          />
          <div className="flex-1" />
          <div className="flex gap-3">
            <RiskDot label="CRIT" n={bands.CRITICAL} color="bg-apex-red" />
            <RiskDot label="HIGH" n={bands.HIGH} color="bg-apex-orange" />
            <RiskDot label="MED" n={bands.MEDIUM} color="bg-apex-amber" />
            <RiskDot label="LOW" n={bands.LOW} color="bg-apex-green" />
          </div>
        </div>
      )}

      {/* Two-col: signals feed + right rail */}
      <div className="grid gap-3.5 lg:grid-cols-[1fr_340px]">
        {/* Signals feed */}
        <Panel
          title="Signals Firing Now"
          right={<LiveChip />}
          bodyClass="max-h-[420px] overflow-y-auto"
        >
          {feed.loading && <div className="p-4"><Spinner /></div>}
          {(feed.data?.events || []).slice(0, 12).map((e) => (
            <button
              key={e.customer_id}
              onClick={() => navigate(`/customers/${e.customer_id}`)}
              className="flex w-full items-start gap-2.5 border-b border-apex-border px-4 py-2.5 text-left transition hover:bg-apex-surface2"
            >
              <span className="mt-0.5 text-sm">{e.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] leading-tight">
                  <strong>{e.name}</strong> — {e.text}
                  {e.boost && (
                    <span className="ml-1 rounded bg-apex-accent/15 px-1 text-[9px] text-apex-accent">
                      interaction boost
                    </span>
                  )}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className="tag">{e.tag}</span>
                  <span className="tag">{e.category}</span>
                  <RiskBadge level={e.band} showDot={false} />
                </span>
              </span>
              <span className="text-[11px] font-bold text-apex-red">{Math.round(e.score)}</span>
            </button>
          ))}
        </Panel>

        {/* Right rail */}
        <div className="flex flex-col gap-3.5">
          <Panel
            title="Pending Approval"
            right={
              <span className="text-[11px] font-bold text-apex-amber">
                {pending.length} awaiting
              </span>
            }
            bodyClass="max-h-[240px] overflow-y-auto"
          >
            {approvals.loading && <div className="p-4"><Spinner /></div>}
            {pending.length === 0 && !approvals.loading && (
              <div className="px-4 py-6 text-center text-[11px] text-apex-muted">
                No approvals pending. Run agents from the At-Risk Queue.
              </div>
            )}
            {pending.slice(0, 5).map((p) => {
              const wf = p.workflow_result;
              return (
                <button
                  key={p.approval_id}
                  onClick={() => navigate(`/brief/${wf.customer_id}`)}
                  className="block w-full border-b border-apex-border px-4 py-2.5 text-left transition hover:bg-apex-surface2"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-[12px] font-semibold">
                      {wf.customer_id}
                    </span>
                    <RiskBadge level={wf.score.risk_level} showDot={false} />
                    <span className="text-[11px] font-bold text-apex-red">
                      {Math.round(wf.score.composite_score)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-apex-muted">
                    <span className="tag">{wf.offer.offer_type.replace("_", " ")}</span>
                    {p.escalated && (
                      <span className="text-apex-amber">⬆ escalated to DRI</span>
                    )}
                  </div>
                </button>
              );
            })}
          </Panel>

          <Panel title="Churn Rate — 90d Trend">
            <div className="px-3 py-3">
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={CHURN_TREND} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="churnG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={[10, 30]} tick={{ fill: "#7a82a0", fontSize: 9 }} width={28} />
                  <ReferenceLine y={14} stroke="#7a82a0" strokeDasharray="4 3" label={{ value: "14% target", fill: "#7a82a0", fontSize: 9, position: "insideBottomRight" }} />
                  <Tooltip
                    contentStyle={{ background: "#1c2030", border: "1px solid #2a3050", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "#7a82a0" }}
                    formatter={(v) => [`${v}%`, "Churn"]}
                  />
                  <Area type="monotone" dataKey="v" stroke="#f87171" strokeWidth={2} fill="url(#churnG)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-1 flex justify-between text-[9px] text-apex-muted">
                <span>28% (90d ago)</span>
                <span className="text-apex-red">↓ trending to target</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-apex-border" />;
}
function Stat({ label, value, color }) {
  return (
    <div>
      <div className={`text-[14px] font-bold ${color || "text-apex-text"}`}>{value}</div>
      <div className="text-[10px] text-apex-muted">{label}</div>
    </div>
  );
}
function RiskDot({ label, n, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[11px] text-apex-muted">{label}</span>
      <span className="text-[11px] font-bold">{n ?? "—"}</span>
    </div>
  );
}
