import { Radar, Bot, Send, CheckCircle2, AlertOctagon } from "lucide-react";

const EVENT_META = {
  recommendation: { icon: Bot, label: "AI recommendation generated", color: "text-indigo-500" },
  approval: { icon: CheckCircle2, label: "Decision recorded", color: "text-emerald-500" },
  escalation: { icon: AlertOctagon, label: "Escalated to DRI", color: "text-red-500" },
};

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function TimelineView({ audit, workflow }) {
  const events = [];
  // Synthetic "signal detected" anchor.
  if (workflow) {
    events.push({
      icon: Radar,
      color: "text-amber-500",
      title: "Churn signals detected",
      detail: `Composite score ${Math.round(workflow.score.composite_score)} · ${workflow.score.risk_level}`,
      ts: workflow.completed_at,
    });
    events.push({
      icon: Send,
      color: "text-indigo-500",
      title: "Workflow completed",
      detail: `Analysis → offer → brief → outreach in ${workflow.elapsed_seconds}s`,
      ts: workflow.completed_at,
    });
  }
  (audit || []).forEach((e) => {
    const m = EVENT_META[e.event_type] || EVENT_META.recommendation;
    events.push({
      icon: m.icon,
      color: m.color,
      title: m.label,
      detail:
        e.decision
          ? `${e.decision}${e.approver ? ` by ${e.approver}` : ""}`
          : e.offer_type
          ? `${e.offer_type} · ${e.offer_value || ""}`
          : "",
      ts: e.timestamp,
    });
  });

  if (!events.length) {
    return (
      <div className="card p-5">
        <h2 className="mb-2 text-lg font-bold">Timeline</h2>
        <p className="text-sm text-slate-400">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-lg font-bold">Timeline</h2>
      <ol className="relative border-l border-slate-200 pl-6 dark:border-slate-800">
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <li key={i} className="mb-5 last:mb-0">
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-slate-100 dark:bg-slate-900 dark:ring-slate-950">
                <Icon size={13} className={e.color} />
              </span>
              <div className="text-sm font-semibold">{e.title}</div>
              {e.detail && (
                <div className="text-xs text-slate-500 dark:text-slate-400">{e.detail}</div>
              )}
              <div className="text-[11px] text-slate-400">{fmt(e.ts)}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
