import { useNavigate } from "react-router-dom";
import { ChevronRight, CheckCircle2, Clock, AlertOctagon } from "lucide-react";
import { cn, RISK_META } from "../lib/utils";
import { RiskBadge, TierBadge, ScoreRing } from "./ui.jsx";

function StatusPill({ status }) {
  if (!status) return null;
  const map = {
    pending: { icon: Clock, text: "Pending", cls: "text-indigo-500" },
    approved: { icon: CheckCircle2, text: "Launched", cls: "text-emerald-500" },
    overridden: { icon: CheckCircle2, text: "Overridden", cls: "text-emerald-500" },
    escalated: { icon: AlertOctagon, text: "Escalated", cls: "text-red-500" },
  };
  const m = map[status];
  if (!m) return null;
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", m.cls)}>
      <Icon size={13} /> {m.text}
    </span>
  );
}

export default function CustomerCard({ customer }) {
  const navigate = useNavigate();
  const meta = RISK_META[customer.risk_level] || RISK_META.LOW;
  const isCritical = customer.risk_level === "CRITICAL";

  return (
    <button
      onClick={() => navigate(`/customer/${customer.customer_id}`)}
      className={cn(
        "card group animate-fade-in w-full p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all",
        "border-l-4",
        isCritical ? "border-l-red-800" : "",
      )}
      style={{ borderLeftColor: meta.hex }}
    >
      <div className="flex items-center gap-4">
        <ScoreRing score={customer.composite_score} level={customer.risk_level} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{customer.name}</h3>
            <TierBadge tier={customer.tier} />
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {customer.email}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <RiskBadge level={customer.risk_level} />
            <StatusPill status={customer.approval_status} />
          </div>
        </div>
        <ChevronRight
          size={18}
          className="text-slate-300 transition-transform group-hover:translate-x-1 dark:text-slate-600"
        />
      </div>
    </button>
  );
}
