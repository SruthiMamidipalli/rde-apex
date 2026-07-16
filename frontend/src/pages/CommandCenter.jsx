import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { KpiCard, Spinner } from "../components/ui.jsx";
import { PERSONAS } from "../lib/personas";
import { money, moneyExact, fmtInt, fmtKpi, kpiTone } from "../lib/utils";

// 90-day churn trend heading toward the <14% target (for the SVG path).
const CHURN_TREND = [28, 27.1, 26, 25.2, 24, 23.5, 23.1, 23.1];

const BANDS = [
  { key: "CRITICAL", label: "CRITICAL", color: "#FF3B30" },
  { key: "HIGH", label: "HIGH", color: "#FF9500" },
  { key: "MEDIUM", label: "MED", color: "#FFCC00" },
  { key: "LOW", label: "LOW", color: "#30D158" },
];

const TONE_DOT = { good: "#10b981", warn: "#f59e0b", bad: "#ef4444" };

export default function CommandCenter() {
  const navigate = useNavigate();
  const { setContext, showToast, persona } = useStore();
  const cc = useApi(() => api.kpiCommandCenter(), []);
  const feed = useApi(() => api.signalsFeed(), []);
  const approvals = useApi(() => api.pendingApprovals(), []);
  const health = useApi(() => api.systemHealth(), []);

  useEffect(() => setContext({ page: "Overview", customer_id: null }), [setContext]);

  const bands = cc.data?.risk_bands || {};
  const pending = approvals.data || [];
  const p = PERSONAS[persona];
  const firstName = (p?.name || "there").split(" ")[0];

  // Build typewriter KPI lines from the live KPI payload.
  const streamLines = cc.data ? buildStream(cc.data) : [];

  return (
    <div className="space-y-4">
      {/* Greeting + connectors */}
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="label-caps mb-1">{todayLabel()}</div>
          <h2 className="display text-[24px]">Good {dayPart()}, {firstName}.</h2>
        </div>
        <div className="flex flex-col items-end gap-1.5 pt-1">
          <span className="whitespace-nowrap text-[11px] text-apex-muted">
            {health.data ? `${health.data.healthy}/${health.data.total} healthy` : "—"} · last sync just now
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="label-caps">Connectors</span>
            {(health.data?.connectors || []).map((c) => (
              <span
                key={c.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-apex-border bg-apex-surface2 px-2.5 py-[3px] text-[11px] font-medium text-apex-muted2"
                title={`${c.uptime_pct}% uptime · ${c.last_sync}`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: c.status === "green" ? "#30D158" : c.status === "amber" ? "#FF9500" : "#FF3B30" }}
                />
                {c.name === "Google Analytics" ? "GA" : c.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* AI Banner — typewriter KPI stream + recommendation */}
      <AiKpiBanner
        streamLines={streamLines}
        bands={bands}
        onAccept={() => navigate("/queue")}
        onToast={showToast}
      />

      {/* KPI cards */}
      {cc.loading && <Spinner label="Computing KPIs…" />}
      {cc.data && (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {cc.data.kpis.map((k) => (
            <KpiCard key={k.name} kpi={k} />
          ))}
        </div>
      )}

      {/* Revenue at risk */}
      {cc.data && (
        <div className="panel flex flex-wrap items-center gap-6 px-6 py-5">
          <div>
            <div className="label-caps mb-1">Revenue at Risk</div>
            <div className="text-[32px] font-bold tracking-tight text-apex-red" style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(cc.data.revenue_at_risk)}
            </div>
          </div>
          <Divider />
          <Stat label="Total ARR baseline" value={money(cc.data.total_arr)} />
          <Divider />
          <Stat label="Secured (interventions)" value={money(cc.data.revenue_secured)} color="text-apex-green" />
          <div className="ml-auto flex flex-wrap items-center gap-4">
            {BANDS.map((b) => (
              <div key={b.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                <span className="text-[12px] font-semibold text-apex-muted2">{b.label}</span>
                <span className="min-w-[18px] text-[17px] font-bold tabular-nums">{bands[b.key] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Churn 90d trend — full width SVG */}
      <ChurnCard />

      {/* Bottom grid: signals + pending */}
      <div className="grid gap-3.5 lg:grid-cols-[1fr_320px]">
        {/* Signals */}
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-apex-surface3 px-5 py-4">
            <span className="text-[14px] font-semibold">Signals Firing Now</span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-apex-red">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-apex-red" />
              LIVE
            </span>
          </div>
          {feed.loading && <div className="p-4"><Spinner /></div>}
          <div className="max-h-[420px] overflow-y-auto">
            {(feed.data?.events || []).slice(0, 12).map((e) => {
              const hex = RISK_HEX[e.band] || "#9ca3af";
              return (
                <button
                  key={e.customer_id}
                  onClick={() => navigate(`/customers/${e.customer_id}`)}
                  className="flex w-full items-center gap-3 border-b border-apex-surface2 px-5 py-3 text-left transition last:border-b-0 hover:bg-apex-surface2"
                >
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ background: `${hex}1a`, color: hex }}
                  >
                    {initials(e.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-apex-text">
                      {e.name}
                      {e.boost && (
                        <span className="ml-1.5 rounded bg-apex-accent/10 px-1 text-[9px] font-semibold text-apex-accent">
                          interaction boost
                        </span>
                      )}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className="tag">{e.tag}</span>
                      <span className="tag">{e.category}</span>
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-right">
                    <span className="block text-[18px] font-bold tabular-nums" style={{ color: hex }}>
                      {Math.round(e.score)}
                    </span>
                    <span className="text-[10px] font-bold tracking-wide" style={{ color: hex }}>
                      {e.band}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pending approval */}
        <div className="panel h-fit p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[14px] font-semibold">Pending Approval</span>
            <span className="rounded-full bg-apex-surface2 px-2.5 py-0.5 text-[11px] font-semibold text-apex-muted">
              {pending.length} awaiting
            </span>
          </div>
          {approvals.loading && <Spinner />}
          {pending.length === 0 && !approvals.loading && (
            <div className="py-6 text-center text-[11px] text-apex-muted">
              No approvals pending.
            </div>
          )}
          {pending.slice(0, 5).map((pa) => {
            const wf = pa.workflow_result;
            const hex = RISK_HEX[wf.score.risk_level] || "#9ca3af";
            return (
              <button
                key={pa.approval_id}
                onClick={() => navigate(`/brief/${wf.customer_id}`)}
                className="flex w-full items-start justify-between gap-2.5 border-b border-apex-surface2 py-2.5 text-left last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-apex-text">{pa.customer_name}</div>
                  <div className="mt-0.5 text-[11px] text-apex-muted">{wf.offer.value}</div>
                  {pa.escalated && (
                    <div className="mt-1 text-[10px] font-semibold text-apex-red">⬆ escalated to DRI</div>
                  )}
                </div>
                <span className="flex-shrink-0 text-right">
                  <span className="block text-[15px] font-bold tabular-nums" style={{ color: hex }}>
                    {Math.round(wf.score.composite_score)}
                  </span>
                  <span className="text-[9px] font-bold tracking-wide" style={{ color: hex }}>
                    {wf.score.risk_level}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const RISK_HEX = { LOW: "#30D158", MEDIUM: "#FFCC00", HIGH: "#FF9500", CRITICAL: "#FF3B30" };

// ── Amber AI banner with typewriter KPI stream ──────────────────────────── //
function AiKpiBanner({ streamLines, bands, onAccept, onToast }) {
  const [visible, setVisible] = useState(0);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [acted, setActed] = useState(null);

  useEffect(() => {
    if (!streamLines.length) return;
    setVisible(0);
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setVisible(i);
      if (i >= streamLines.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 360);
    return () => clearInterval(id);
  }, [streamLines.length]);

  if (dismissed) return null;
  const atRisk = (bands.HIGH || 0) + (bands.CRITICAL || 0);

  return (
    <div className="grid overflow-hidden rounded-[14px] border border-[#fde68a] border-l-4 border-l-[#f59e0b] bg-[#fffbeb] lg:grid-cols-2">
      {/* Left: typewriter stream */}
      <div className="border-b border-[#fde68a] p-5 lg:border-b-0 lg:border-r">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#92400e]">AI KPI Summary</span>
          <span className="rounded-full bg-[#f59e0b]/20 px-2 py-0.5 text-[11px] font-semibold text-[#92400e]">
            {done ? "Confidence 88" : "Generating…"}
          </span>
        </div>
        <div className="min-h-[132px] font-mono text-[12.5px] leading-[1.75] text-apex-muted2">
          {streamLines.slice(0, visible).map((l, i) => (
            <div key={i} className="animate-fade-in">
              <span style={{ color: TONE_DOT[l.tone] || "#6b7280" }}>●</span> {l.text}
            </div>
          ))}
          {!done && <span className="ml-0.5 inline-block h-3.5 w-2 animate-pulse bg-[#f59e0b] align-middle" />}
        </div>
      </div>

      {/* Right: recommendation */}
      <div className="flex flex-col justify-between p-5">
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f59e0b] text-[11px] font-bold text-white">AI</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#92400e]">Recommendation</span>
            <span className="rounded-full bg-[#f59e0b]/20 px-2 py-0.5 text-[11px] font-semibold text-[#92400e]">Confidence 88</span>
            {acted && (
              <span className="rounded-full bg-apex-green/10 px-2 py-0.5 text-[10px] font-semibold text-apex-green">
                {acted} · logged to audit
              </span>
            )}
          </div>
          <p className="mb-2 text-[13.5px] font-medium leading-snug text-apex-text">
            <strong>{fmtInt(atRisk)} customers</strong> are at high risk of leaving. Start with the
            At-Risk Queue — it lists them by who's most valuable to save first.
          </p>
          <p className="mb-3.5 text-[11px] text-apex-muted2">
            Based on: Website visits down 60% · No reward redemptions · Open support tickets
          </p>
        </div>
        {!acted && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary rounded-lg px-4 py-1.5 text-[12px] font-semibold" onClick={() => { setActed("Accepted"); onAccept?.(); }}>
              Go to At-Risk Queue
            </button>
            <button className="rounded-lg border border-apex-border bg-white px-3.5 py-1.5 text-[12px] font-medium text-apex-muted2" onClick={() => { setActed("Modified"); onToast?.("Recommendation modified — logged to model monitoring."); }}>
              Modify
            </button>
            <button className="rounded-lg border border-apex-border bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-apex-muted" onClick={() => setDismissed(true)}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Full-width churn trend SVG (matches HTML) ───────────────────────────── //
function ChurnCard() {
  const min = 14, max = 30;
  const W = 800, H = 140;
  const pts = CHURN_TREND.map((v, i) => {
    const x = (i / (CHURN_TREND.length - 1)) * W;
    const y = H - ((v - min) / (max - min)) * (H - 12) - 6;
    return [x, y];
  });
  const line = pts.map((p) => `${p[0].toFixed(0)},${p[1].toFixed(0)}`).join(" ");
  const areaPath = `M0,${pts[0][1].toFixed(0)} ${pts.map((p) => `L${p[0].toFixed(0)},${p[1].toFixed(0)}`).join(" ")} L${W},${H} L0,${H} Z`;
  const targetY = H - ((14 - min) / (max - min)) * (H - 12) - 6;

  return (
    <div className="panel px-6 py-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-[15px] font-semibold">Churn Rate — 90d Trend</div>
          <div className="text-[12px] text-apex-muted">Rolling 90-day annual churn rate across all active customers</div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-bold tabular-nums text-apex-red">23.1%</div>
          <div className="text-[11px] text-apex-muted">current · +9.1pt vs target</div>
        </div>
      </div>
      <svg width="100%" height="140" viewBox="0 0 800 140" preserveAspectRatio="none">
        {[28, 56, 84, 112].map((y) => (
          <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="#f3f4f6" strokeWidth="1" />
        ))}
        <line x1="0" y1={targetY} x2="800" y2={targetY} stroke="#10b981" strokeWidth="1" strokeDasharray="5,4" opacity="0.5" />
        <path d={areaPath} fill="rgba(239,68,68,0.08)" />
        <polyline points={line} fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="#ef4444" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-apex-muted">
        <span>Apr 16</span>
        <span>Jul 16</span>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────── //
function buildStream(data) {
  const lines = [];
  const total = Object.values(data.risk_bands || {}).reduce((a, b) => a + b, 0);
  lines.push({ tone: "neutral", text: `Analysing ${total} customers across 6 CRM sources…` });
  const b = data.risk_bands || {};
  lines.push({
    tone: "bad",
    text: `Revenue at risk: ${money(data.revenue_at_risk)} — ${b.CRITICAL || 0} CRITICAL, ${b.HIGH || 0} HIGH, ${b.MEDIUM || 0} MED, ${b.LOW || 0} LOW`,
  });
  for (const k of data.kpis || []) {
    const tone = kpiTone(k.value, k.target, k.direction).replace("text-apex-", "");
    const t = tone === "green" ? "good" : tone === "red" ? "bad" : tone === "amber" ? "warn" : "neutral";
    lines.push({ tone: t, text: `${k.name}: ${fmtKpi(k.value, k.format)}${k.target != null ? ` (target ${fmtKpi(k.target, k.format)})` : ""}` });
  }
  return lines;
}

function initials(name) {
  return (name || "")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function dayPart() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
function Divider() {
  return <div className="h-11 w-px bg-apex-surface3" />;
}
function Stat({ label, value, color }) {
  return (
    <div>
      <div className={`text-[17px] font-bold tabular-nums ${color || "text-apex-text"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-apex-muted">{label}</div>
    </div>
  );
}
