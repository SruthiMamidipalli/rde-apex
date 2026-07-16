import { AlertTriangle, Gauge, Rocket, Clock, Users } from "lucide-react";
import { fmtNum } from "../lib/utils";

function Stat({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`rounded-xl p-2.5 ${accent}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight">{value}</div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </div>
        {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function MetricsBar({ metrics }) {
  if (!metrics) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <Stat
        icon={Users}
        label="Total Customers"
        value={metrics.total_customers}
        accent="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      />
      <Stat
        icon={AlertTriangle}
        label="At-Risk Customers"
        value={metrics.total_at_risk}
        sub="score > 50"
        accent="bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
      />
      <Stat
        icon={Gauge}
        label="Avg Churn Score"
        value={fmtNum(metrics.average_churn_score)}
        accent="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
      />
      <Stat
        icon={Clock}
        label="Pending Approval"
        value={metrics.campaigns_pending}
        accent="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
      />
      <Stat
        icon={Rocket}
        label="Campaigns Launched"
        value={metrics.campaigns_launched}
        accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
      />
    </div>
  );
}
