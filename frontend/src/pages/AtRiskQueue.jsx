import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Filter } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { KpiCard, Panel, RiskBadge, TierBadge, Spinner, ErrorBanner } from "../components/ui.jsx";
import AiFlag from "../components/AiFlag.jsx";
import { moneyExact, cn } from "../lib/utils";

const RISK_FILTERS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function AtRiskQueue() {
  const navigate = useNavigate();
  const { setContext, showToast } = useStore();
  const queue = useApi(() => api.rankedQueue(0), []);
  const kpi = useApi(() => api.kpiAtRiskQueue(), []);
  const [filter, setFilter] = useState("ALL");
  const [tier, setTier] = useState("ALL");
  const [running, setRunning] = useState(false);

  useEffect(() => setContext({ page: "At-Risk Queue", customer_id: null }), [setContext]);

  const rows = useMemo(() => {
    let list = queue.data?.customers || [];
    if (filter !== "ALL") list = list.filter((c) => c.risk_level === filter);
    if (tier !== "ALL") list = list.filter((c) => c.tier === tier);
    return list;
  }, [queue.data, filter, tier]);

  async function runAll() {
    setRunning(true);
    try {
      const res = await api.runAll(50);
      showToast(`Agent pipeline ran on ${res.processed} customers — briefs queued.`);
      await Promise.all([queue.refetch(), kpi.refetch()]);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setRunning(false);
    }
  }

  const topCritical = (queue.data?.customers || []).find((c) => c.risk_level === "CRITICAL");

  return (
    <div className="space-y-4">
      <AiFlag
        area="At-Risk Queue"
        severity="red"
        confidence={90}
        text={
          <>
            Start with your highest-risk, highest-value customers.
            {topCritical && (
              <>
                {" "}
                Top priority: <strong>{topCritical.name}</strong> — risk score{" "}
                {Math.round(topCritical.composite_score)} and worth{" "}
                {moneyExact(topCritical.ltv)} over their lifetime.
              </>
            )}
          </>
        }
        evidence={["Risk score", "Customer lifetime value"]}
        acceptLabel="✓ Run agents on all at-risk"
        onAccept={runAll}
        onToast={showToast}
      />

      {kpi.data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {kpi.data.kpis.map((k) => (
            <KpiCard key={k.name} kpi={k} />
          ))}
        </div>
      )}

      <Panel
        title="Risk × Value Ranked Queue"
        right={
          <button className="btn btn-primary" onClick={runAll} disabled={running}>
            <Play size={13} className={running ? "animate-pulse" : ""} />
            {running ? "Running agents…" : "Run agents on segment"}
          </button>
        }
      >
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-apex-border px-4 py-2.5">
          <Filter size={13} className="text-apex-muted" />
          {RISK_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold transition",
                filter === f
                  ? "bg-apex-accent text-white"
                  : "bg-apex-surface2 text-apex-muted hover:text-apex-text"
              )}
            >
              {f}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-apex-border" />
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="rounded-md border border-apex-border bg-apex-surface2 px-2 py-1 text-[10px] text-apex-text outline-none"
          >
            {["ALL", "Platinum", "Gold", "Silver", "Bronze"].map((t) => (
              <option key={t} value={t}>
                {t === "ALL" ? "All tiers" : t}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-apex-muted">{rows.length} customers</span>
        </div>

        {queue.loading && <div className="p-4"><Spinner /></div>}
        {queue.error && <div className="p-4"><ErrorBanner message={queue.error} onRetry={queue.refetch} /></div>}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-apex-border text-left text-[10px] uppercase tracking-wide text-apex-muted">
                <th className="px-4 py-2 font-semibold">#</th>
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-4 py-2 font-semibold">Tier</th>
                <th className="px-4 py-2 font-semibold">Score</th>
                <th className="px-4 py-2 font-semibold">Band</th>
                <th className="px-4 py-2 font-semibold">LTV</th>
                <th className="px-4 py-2 font-semibold">Risk × Value</th>
                <th className="px-4 py-2 font-semibold">Top Signal</th>
                <th className="px-4 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr
                  key={c.customer_id}
                  className="cursor-pointer border-b border-apex-border/60 transition hover:bg-apex-surface2"
                  onClick={() => navigate(`/customers/${c.customer_id}`)}
                >
                  <td className="px-4 py-2.5 text-apex-muted">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-[10px] text-apex-muted">{c.tier} tier</div>
                  </td>
                  <td className="px-4 py-2.5"><TierBadge tier={c.tier} /></td>
                  <td className="px-4 py-2.5 font-bold">{Math.round(c.composite_score)}</td>
                  <td className="px-4 py-2.5"><RiskBadge level={c.risk_level} /></td>
                  <td className="px-4 py-2.5">{moneyExact(c.ltv)}</td>
                  <td className="px-4 py-2.5 font-semibold text-apex-accent">
                    {moneyExact(c.value_rank)}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-apex-muted">
                    {c.top_signal}
                    {c.crm_divergence && (
                      <span className="ml-1 rounded bg-apex-red/15 px-1 text-[9px] text-apex-red">
                        CRM divergence
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      className="btn !px-2 !py-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/brief/${c.customer_id}`);
                      }}
                    >
                      Brief →
                    </button>
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
