import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
} from "recharts";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { Panel, RiskBadge, TierBadge, ScoreRing, Spinner, Cite } from "../components/ui.jsx";
import AiFlag from "../components/AiFlag.jsx";
import { fmtNum, SOURCE_LABEL, cn, CHART } from "../lib/utils";

export default function Customer360() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setContext, showToast } = useStore();
  const list = useApi(() => api.rankedQueue(0), []);
  const selected = id;

  const selectedName =
    (list.data?.customers || []).find((c) => c.customer_id === selected)?.name || null;

  useEffect(() => {
    setContext({
      page: "Customer 360",
      customer_id: selected || null,
      customer_name: selectedName,
    });
  }, [selected, selectedName, setContext]);

  // Auto-select the first CRM-divergence customer (Eleanor) when none chosen.
  useEffect(() => {
    if (!selected && list.data?.customers?.length) {
      const eleanor = list.data.customers.find((c) => c.crm_divergence);
      navigate(`/customers/${(eleanor || list.data.customers[0]).customer_id}`, {
        replace: true,
      });
    }
  }, [selected, list.data, navigate]);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      {/* Customer picker */}
      <Panel title="Customers" bodyClass="max-h-[calc(100vh-160px)] overflow-y-auto">
        {list.loading && <div className="p-3"><Spinner /></div>}
        {(list.data?.customers || []).map((c) => (
          <button
            key={c.customer_id}
            onClick={() => navigate(`/customers/${c.customer_id}`)}
            className={cn(
              "flex w-full items-center gap-2 border-b border-apex-border px-3 py-2 text-left transition hover:bg-apex-surface2",
              c.customer_id === selected && "bg-apex-surface2"
            )}
          >
            <span className="flex-1">
              <span className="block text-[12px] font-semibold">{c.name}</span>
              <span className="text-[10px] text-apex-muted">{c.tier} tier</span>
            </span>
            <span className="text-[12px] font-bold" style={{ color: RISK_HEX[c.risk_level] }}>
              {Math.round(c.composite_score)}
            </span>
          </button>
        ))}
      </Panel>

      {selected ? <CustomerDetail id={selected} showToast={showToast} navigate={navigate} /> : <div />}
    </div>
  );
}

const RISK_HEX = { LOW: "#34d399", MEDIUM: "#f59e0b", HIGH: "#fb923c", CRITICAL: "#f87171" };

function CustomerDetail({ id, showToast, navigate }) {
  const cust = useApi(() => api.getCustomer(id), [id]);
  const [score, setScore] = useState(null);

  useEffect(() => {
    api.score(id).then(setScore).catch(() => {});
  }, [id]);

  if (cust.loading || !cust.data) return <Spinner label="Loading customer…" />;
  const c = cust.data;
  const s = score || c.churn_score;
  const sig = c.signals || {};

  const radarData = (s?.signal_contributions || []).map((x) => ({
    signal: SOURCE_LABEL[x.source] || x.source,
    value: x.normalized_score,
  }));

  const breakdown = (s?.signal_contributions || [])
    .slice()
    .sort((a, b) => b.weighted_contribution - a.weighted_contribution)
    .map((x) => ({
      name: SOURCE_LABEL[x.source] || x.source,
      contribution: x.weighted_contribution,
      hex: RISK_HEX[bandFor(x.normalized_score)],
    }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel flex items-center gap-4 p-4">
        {s && <ScoreRing score={s.composite_score} level={s.risk_level} size={72} />}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{c.name}</h2>
            <TierBadge tier={c.tier} />
            {s && <RiskBadge level={s.risk_level} />}
            {s?.interaction_boost_applied && (
              <span className="rounded-full bg-apex-accent/15 px-2 py-0.5 text-[10px] font-semibold text-apex-accent">
                +{fmtNum(s.interaction_boost, 0)} interaction boost
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-apex-muted">
            {c.email} · Member since{" "}
            {new Date(c.join_date).toLocaleDateString()} · LTV ${Math.round(c.ltv).toLocaleString()}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate(`/brief/${id}`)}>
          ◈ Generate Retention Brief
        </button>
      </div>

      {/* Conflict Highlighter */}
      {s?.crm_divergence && (
        <div className="flex items-start gap-3 rounded-[10px] border border-apex-red/40 bg-apex-red/[0.07] px-4 py-3">
          <span className="text-base">⚠</span>
          <div className="text-[12.5px] leading-relaxed">
            <strong className="text-apex-red">Conflict detected — trust the composite.</strong>{" "}
            Salesforce CRM rates this customer{" "}
            <strong>{fmtNum(s.crm_health_score, 0)}/100 "healthy"</strong>, but the cross-system
            composite says <strong>{fmtNum(s.composite_score, 0)} {s.risk_level}</strong>. Behavioural,
            loyalty and support signals contradict the CRM. <Cite>CRM + Scoring</Cite>
          </div>
        </div>
      )}

      <AiFlag
        area="Customer 360"
        severity={s?.risk_level === "CRITICAL" ? "red" : "orange"}
        confidence={s?.confidence || 85}
        text={
          <>
            The biggest warning sign is <strong>{breakdown[0]?.name}</strong>. The
            combined score is more reliable than the CRM's health rating here —
            worth preparing a retention brief.
          </>
        }
        evidence={(s?.signal_contributions || [])
          .slice(0, 4)
          .map((x) => `${x.signal_name} ${fmtNum(x.normalized_score, 0)} [${SOURCE_LABEL[x.source]}]`)}
        acceptLabel="✓ Accept recommendation"
        onAccept={() => navigate(`/brief/${id}`)}
        onToast={showToast}
      />

      {/* Score breakdown + radar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Composite Score Breakdown">
          <div className="p-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={breakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={CHART.axisTick} />
                <YAxis type="category" dataKey="name" tick={CHART.axisTick} width={60} />
                <Tooltip
                  contentStyle={CHART.tooltip}
                  formatter={(v) => [`${fmtNum(v, 1)} pts`, "Weighted"]}
                />
                <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                  {breakdown.map((e, i) => (
                    <Cell key={i} fill={e.hex} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-1 text-center text-[10px] text-apex-muted">
              Each bar = weight × normalized risk. Base {fmtNum(s?.base_score, 0)}
              {s?.interaction_boost_applied ? ` + ${fmtNum(s.interaction_boost, 0)} boost` : ""} ={" "}
              {fmtNum(s?.composite_score, 0)} composite.
            </div>
          </div>
        </Panel>

        <Panel title="Cross-System Signal Radar">
          <div className="p-3">
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={CHART.grid} />
                <PolarAngleAxis dataKey="signal" tick={CHART.axisTick} />
                <Radar dataKey="value" stroke="#4f6ef7" fill="#4f6ef7" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Six system panels */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SystemPanel title="Salesforce CRM" tag="CRM" icon="◎" rows={sfRows(sig.salesforce)} />
        <SystemPanel title="Shopify" tag="Shopify" icon="🛒" rows={shopRows(sig.shopify)} />
        <SystemPanel title="Yotpo Loyalty" tag="Yotpo" icon="💠" rows={yotpoRows(sig.yotpo)} />
        <SystemPanel title="Klaviyo" tag="Klaviyo" icon="✉" rows={klaviyoRows(sig.klaviyo)} />
        <SystemPanel title="Zendesk" tag="Zendesk" icon="🎫" rows={zendeskRows(sig.zendesk)} />
        <SystemPanel title="Google Analytics" tag="GA" icon="📉" rows={gaRows(sig.google_analytics)} />
      </div>
    </div>
  );
}

function bandFor(score) {
  if (score <= 25) return "LOW";
  if (score <= 50) return "MEDIUM";
  if (score <= 75) return "HIGH";
  return "CRITICAL";
}

function SystemPanel({ title, tag, icon, rows }) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <span>{icon}</span> {title}
        </span>
      }
      right={<span className="tag">{tag}</span>}
    >
      <div className="divide-y divide-apex-border/60">
        {rows ? (
          rows.map(([k, v, warn]) => (
            <div key={k} className="flex items-center justify-between px-4 py-2">
              <span className="text-[11px] text-apex-muted">{k}</span>
              <span className={cn("text-[12px] font-semibold", warn && "text-apex-red")}>{v}</span>
            </div>
          ))
        ) : (
          <div className="px-4 py-4 text-center text-[11px] text-apex-muted">
            No data — system not connected for this customer.
          </div>
        )}
      </div>
    </Panel>
  );
}

// Row builders (null-tolerant).
const pct = (n) => `${fmtNum(n * 100, 1)}%`;
function sfRows(d) {
  if (!d) return null;
  return [
    ["Engagement score", fmtNum(d.engagement_score, 0), d.engagement_score < 40],
    ["Health score", fmtNum(d.health_score, 0), d.health_score < 40],
    ["Lifecycle stage", d.lifecycle_stage, d.lifecycle_stage === "At Risk"],
    ["Last interaction", new Date(d.last_interaction_date).toLocaleDateString()],
  ];
}
function shopRows(d) {
  if (!d) return null;
  return [
    ["Avg order value", `$${fmtNum(d.average_order_value, 0)}`],
    ["AOV change", `${fmtNum(d.aov_change_pct, 0)}%`, d.aov_change_pct < -20],
    ["Orders (30d)", d.order_count_30d, d.order_count_30d === 0],
    ["Discount usage", pct(d.discount_usage_rate), d.discount_usage_rate > 0.5],
    ["Last purchase", new Date(d.last_purchase_date).toLocaleDateString()],
  ];
}
function yotpoRows(d) {
  if (!d) return null;
  return [
    ["Tier", d.tier],
    ["Points balance", d.points_balance.toLocaleString()],
    ["Redemptions (30d)", d.redemptions_30d, d.redemptions_30d === 0],
    ["Days since redemption", d.days_since_last_redemption, d.days_since_last_redemption > 60],
  ];
}
function klaviyoRows(d) {
  if (!d) return null;
  return [
    ["Email open rate", pct(d.email_open_rate), d.email_open_rate < 0.15],
    ["Click rate", pct(d.email_click_rate), d.email_click_rate < 0.05],
    ["SMS response", pct(d.sms_response_rate)],
    ["Unsubscribed", d.unsubscribed ? "Yes" : "No", d.unsubscribed],
  ];
}
function zendeskRows(d) {
  if (!d) return null;
  return [
    ["Open tickets", d.open_tickets, d.open_tickets > 0],
    ["Unresolved", d.unresolved_tickets, d.unresolved_tickets > 0],
    ["Avg sentiment", fmtNum(d.avg_sentiment_score, 2), d.avg_sentiment_score < 0],
    ["Avg resolution (h)", fmtNum(d.avg_resolution_time_hours, 0), d.avg_resolution_time_hours > 72],
  ];
}
function gaRows(d) {
  if (!d) return null;
  return [
    ["Sessions (30d)", d.sessions_30d, d.sessions_30d < 5],
    ["Prev 30d", d.sessions_prev_30d],
    ["Session change", `${fmtNum(d.session_change_pct, 0)}%`, d.session_change_pct < -30],
    ["Bounce rate", pct(d.bounce_rate), d.bounce_rate > 0.7],
    ["Pages / session", fmtNum(d.pages_per_session, 1)],
  ];
}
