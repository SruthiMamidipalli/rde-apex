import { useState } from "react";
import { CheckCircle2, Edit3, AlertOctagon, Clock } from "lucide-react";
import { api } from "../lib/api";

function elapsed(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${Math.round(seconds % 60)}s`;
}

export default function ApprovalWorkflow({ approval, onChange }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideValue, setOverrideValue] = useState("");

  if (!approval) return null;
  const decided = ["approved", "overridden"].includes(approval.status);
  const escalated = approval.status === "escalated";

  async function act(fn, label) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(`✓ ${label}`);
      onChange?.();
    } catch (e) {
      setMsg(`⚠ ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Approval Workflow</h2>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Clock size={13} /> signal→delivery {elapsed(approval.time_since_signal_seconds)}
        </span>
      </div>

      {escalated && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertOctagon size={15} /> Escalated to DRI
          </div>
          {approval.escalation_reason && (
            <p className="mt-1 text-xs">{approval.escalation_reason}</p>
          )}
        </div>
      )}

      {decided ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={16} className="mr-1 inline" />
          Campaign {approval.status} and launched.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary flex-1"
              disabled={busy}
              onClick={() => act(() => api.approve(approval.approval_id), "Approved")}
            >
              <CheckCircle2 size={16} /> Approve
            </button>
            <button
              className="btn-ghost flex-1"
              disabled={busy}
              onClick={() => setShowOverride((s) => !s)}
            >
              <Edit3 size={16} /> Override
            </button>
            <button
              className="btn flex-1 border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
              disabled={busy}
              onClick={() =>
                act(
                  () => api.escalate(approval.approval_id, "Manual escalation to DRI"),
                  "Escalated"
                )
              }
            >
              <AlertOctagon size={16} /> Escalate
            </button>
          </div>

          {showOverride && (
            <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Modified offer value
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                placeholder="e.g. 30% off next order"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
              />
              <button
                className="btn-primary mt-2 w-full"
                disabled={busy || !overrideValue}
                onClick={() =>
                  act(
                    () =>
                      api.override(approval.approval_id, {
                        offer_value: overrideValue,
                      }),
                    "Overridden"
                  )
                }
              >
                Save & Approve
              </button>
            </div>
          )}
        </>
      )}

      {msg && (
        <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
          {msg}
        </p>
      )}
    </div>
  );
}
