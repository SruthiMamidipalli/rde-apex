import { useEffect } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { Panel, Spinner, Cite } from "../components/ui.jsx";
import AiFlag from "../components/AiFlag.jsx";
import { fmtNum, cn } from "../lib/utils";

export default function Campaigns() {
  const { setContext, showToast } = useStore();
  const camp = useApi(() => api.campaigns(), []);
  useEffect(() => setContext({ page: "Campaign & Outreach", customer_id: null }), [setContext]);

  const rows = camp.data?.campaigns || [];
  const live = rows.filter((r) => r.delivered);
  const avgOpen = live.length ? live.reduce((a, r) => a + (r.open_rate || 0), 0) / live.length : 0;

  return (
    <div className="space-y-4">
      <AiFlag
        area="Campaign & Outreach"
        severity="orange"
        confidence={84}
        text={
          <>
            Best channel + send time: lead with <strong>SMS</strong> for CRITICAL customers (email
            open rates have collapsed), follow with email at <strong>10am local</strong>. Apply
            frequency capping — suppress anyone contacted in the last 72h.
          </>
        }
        evidence={["Open rate 8.2% [Klaviyo]", "SMS response higher [Klaviyo]"]}
        onToast={showToast}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Campaigns" value={rows.length} />
        <MiniStat label="Live" value={live.length} color="text-apex-green" />
        <MiniStat label="Avg open rate" value={`${fmtNum(avgOpen * 100, 0)}%`} />
        <MiniStat
          label="Pending"
          value={rows.length - live.length}
          color="text-apex-amber"
        />
      </div>

      <Panel title="Campaign Tracking">
        {camp.loading && <div className="p-4"><Spinner /></div>}
        {!camp.loading && rows.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-apex-muted">
            No campaigns yet. Approve briefs in the Retention Brief area to launch campaigns.
          </div>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-apex-border text-left text-[10px] uppercase tracking-wide text-apex-muted">
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Offer</th>
                  <th className="px-4 py-2">Channel</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Open</th>
                  <th className="px-4 py-2">Redeem</th>
                  <th className="px-4 py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.campaign_id} className="border-b border-apex-border/60">
                    <td className="px-4 py-2.5 font-semibold">{r.customer_id}</td>
                    <td className="px-4 py-2.5">{r.offer}</td>
                    <td className="px-4 py-2.5 text-apex-muted">{r.channel}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          r.status === "Live"
                            ? "bg-apex-green/12 text-apex-green"
                            : r.status === "Escalated"
                            ? "bg-apex-amber/12 text-apex-amber"
                            : "bg-apex-surface3 text-apex-muted"
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{r.open_rate != null ? `${fmtNum(r.open_rate * 100, 0)}%` : "—"}</td>
                    <td className="px-4 py-2.5">{r.redeem_rate != null ? `${fmtNum(r.redeem_rate * 100, 0)}%` : "—"}</td>
                    <td className="px-4 py-2.5 font-semibold text-apex-green">{Math.round(r.confidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-apex-border px-4 py-2 text-[10px] text-apex-muted">
          Performance simulated from approved interventions <Cite>Klaviyo + Yotpo</Cite>. Frequency
          capping active. Write-back to source systems is on the production roadmap.
        </div>
      </Panel>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="panel p-4">
      <div className="label-caps">{label}</div>
      <div className={cn("mt-1 text-[22px] font-extrabold", color || "text-apex-text")}>{value}</div>
    </div>
  );
}
