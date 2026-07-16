import { useEffect } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { KpiCard, Panel, Spinner, ProgressBar } from "../components/ui.jsx";
import AiFlag from "../components/AiFlag.jsx";
import { fmtNum, cn } from "../lib/utils";

const EVENT_COLOR = {
  recommendation: "text-apex-accent",
  approval: "text-apex-green",
  escalation: "text-apex-amber",
};

export default function AdminGovernance() {
  const { setContext, showToast } = useStore();
  const kpi = useApi(() => api.kpiAdmin(), []);
  const config = useApi(() => api.adminConfig(), []);
  const audit = useApi(() => api.adminAudit(60), []);
  const health = useApi(() => api.systemHealth(), []);
  useEffect(() => setContext({ page: "Admin & Governance", customer_id: null }), [setContext]);

  const weights = config.data?.weights || {};
  const labels = config.data?.signal_labels || {};

  return (
    <div className="space-y-4">
      <AiFlag
        area="Admin & Governance"
        severity="orange"
        confidence={83}
        text={
          <>
            Weights to retune: <strong>engagement_drop (CRM)</strong> carries 20% weight but is the
            lagging, lowest-trust signal — consider lowering. Connectors to fix:{" "}
            <strong>Klaviyo</strong> is running a 15-minute sync lag.
          </>
        }
        evidence={["Weight config [Scoring]", "Connector health [All 6]"]}
        onToast={showToast}
      />

      {/* Model monitoring KPIs */}
      {kpi.loading && <Spinner />}
      {kpi.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {kpi.data.kpis.map((k) => (
            <KpiCard key={k.name} kpi={k} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Connector health */}
        <Panel title="Connector Health Dashboard">
          <div className="divide-y divide-apex-border/60">
            {(health.data?.connectors || []).map((c) => (
              <div key={c.name} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    c.status === "green" ? "bg-apex-green" : c.status === "amber" ? "bg-apex-amber" : "bg-apex-red"
                  )}
                />
                <span className="flex-1 text-[12px] font-semibold">{c.name}</span>
                <span className="text-[11px] text-apex-muted">{c.last_sync}</span>
                <span className="w-12 text-right text-[11px] font-semibold">{c.uptime_pct}%</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Scoring config */}
        <Panel title="Scoring Engine Config — Signal Weights">
          <div className="space-y-2.5 p-4">
            {Object.entries(weights).map(([k, w]) => (
              <div key={k}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-apex-muted">{labels[k] || k}</span>
                  <span className="font-semibold">{fmtNum(w * 100, 0)}%</span>
                </div>
                <div className="mt-1">
                  <ProgressBar value={w * 100} max={30} color="bg-apex-accent" />
                </div>
              </div>
            ))}
            <div className="pt-1 text-[10px] text-apex-muted">
              Thresholds: LOW 0–25 · MED 26–50 · HIGH 51–75 · CRITICAL 76–100 · Model{" "}
              {config.data?.model_version}
            </div>
          </div>
        </Panel>
      </div>

      {/* Audit trail */}
      <Panel
        title="Audit Trail Viewer"
        right={<span className="text-[11px] text-apex-muted">immutable · 100% coverage</span>}
        bodyClass="max-h-[360px] overflow-y-auto"
      >
        {audit.loading && <div className="p-4"><Spinner /></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="sticky top-0 border-b border-apex-border bg-apex-surface text-left text-[10px] uppercase tracking-wide text-apex-muted">
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Detail</th>
                <th className="px-4 py-2">Sources</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data?.entries || []).map((e) => (
                <tr key={e.entry_id} className="border-b border-apex-border/60">
                  <td className="px-4 py-2 text-apex-muted">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2 font-semibold">{e.customer_id}</td>
                  <td className={cn("px-4 py-2 font-semibold", EVENT_COLOR[e.event_type])}>
                    {e.event_type}
                  </td>
                  <td className="px-4 py-2 text-apex-muted">
                    {e.event_type === "recommendation"
                      ? `${e.offer_type || ""} · score ${fmtNum(e.churn_score, 0)}`
                      : `${e.decision || ""}${e.approver ? ` by ${e.approver}` : ""}`}
                  </td>
                  <td className="px-4 py-2 text-apex-muted">
                    {(e.sources_consulted || []).length || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
