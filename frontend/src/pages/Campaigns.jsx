import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { Panel, Spinner, Cite } from "../components/ui.jsx";
import AiFlag from "../components/AiFlag.jsx";
import { fmtNum, cn } from "../lib/utils";

export default function Campaigns() {
  const { setContext, showToast } = useStore();
  const camp = useApi(() => api.campaigns(), []);
  const [sending, setSending] = useState(null);
  useEffect(() => setContext({ page: "Campaign & Outreach", customer_id: null }), [setContext]);

  const rows = camp.data?.campaigns || [];
  const sent = rows.filter((r) => r.sent);
  const ready = rows.filter((r) => r.sendable);
  const avgOpen = sent.length ? sent.reduce((a, r) => a + (r.open_rate || 0), 0) / sent.length : 0;

  async function send(row) {
    setSending(row.campaign_id);
    try {
      const res = await api.sendOutreach(row.campaign_id);
      showToast(`Outreach sent to ${res.customer_name} via ${res.sent_channels.join(", ")}.`);
      await camp.refetch();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-4">
      <AiFlag
        area="Campaign & Outreach"
        severity="orange"
        confidence={84}
        text={
          <>
            For your highest-risk customers, send a text first (their email
            opens have dropped), then follow up by email at <strong>10am</strong>.
            Don't contact anyone twice within 72 hours.
          </>
        }
        evidence={["Email open rate only 8%", "Texts get more replies"]}
        onToast={showToast}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Approved briefs" value={rows.length} />
        <MiniStat label="Sent" value={sent.length} color="text-apex-green" />
        <MiniStat label="Ready to send" value={ready.length} color="text-apex-amber" />
        <MiniStat label="Avg open rate (sent)" value={`${fmtNum(avgOpen * 100, 0)}%`} />
      </div>

      <Panel title="Campaign Tracking">
        {camp.loading && <div className="p-4"><Spinner /></div>}
        {!camp.loading && rows.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-apex-muted">
            No approved briefs yet. Approve a brief in Retention Brief, then send it here.
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
                  <th className="px-4 py-2">Approved by</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Open</th>
                  <th className="px-4 py-2">Redeem</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.campaign_id} className="border-b border-apex-border/60">
                    <td className="px-4 py-2.5 font-semibold">{r.customer_name}</td>
                    <td className="px-4 py-2.5">{r.offer}</td>
                    <td className="px-4 py-2.5 text-apex-muted">{r.channel}</td>
                    <td className="px-4 py-2.5 text-apex-muted">{r.approved_by || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          r.sent
                            ? "bg-apex-green/12 text-apex-green"
                            : r.sendable
                            ? "bg-apex-accent/12 text-apex-accent"
                            : "bg-apex-amber/12 text-apex-amber"
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{r.open_rate != null ? `${fmtNum(r.open_rate * 100, 0)}%` : "—"}</td>
                    <td className="px-4 py-2.5">{r.redeem_rate != null ? `${fmtNum(r.redeem_rate * 100, 0)}%` : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {r.sendable ? (
                        <button
                          className="btn btn-primary !py-1.5 !px-3"
                          onClick={() => send(r)}
                          disabled={sending === r.campaign_id}
                        >
                          <Send size={12} className={sending === r.campaign_id ? "animate-pulse" : ""} />
                          {sending === r.campaign_id ? "Sending…" : "Send"}
                        </button>
                      ) : r.sent ? (
                        <span className="text-[11px] text-apex-muted">✓ Sent</span>
                      ) : (
                        <span className="text-[11px] text-apex-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-apex-border px-4 py-2 text-[10px] text-apex-muted">
          Approved briefs are sent from here. Delivery is simulated (no real email
          provider); open / redeem rates appear once sent <Cite>Klaviyo + Yotpo</Cite>.
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
