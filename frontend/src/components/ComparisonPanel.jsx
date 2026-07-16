import { ArrowRight, TrendingDown } from "lucide-react";

export default function ComparisonPanel({ comparison }) {
  const metrics = comparison?.metrics || [];
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <TrendingDown className="text-emerald-500" size={20} />
        <h2 className="text-lg font-bold">Before vs After — Manual vs AI Agentic</h2>
      </div>
      <div className="space-y-2">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="col-span-12 text-sm font-semibold md:col-span-4">
              {m.label}
            </div>
            <div className="col-span-5 md:col-span-3">
              <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {m.manual}
              </span>
            </div>
            <div className="col-span-1 flex justify-center">
              <ArrowRight size={16} className="text-slate-400" />
            </div>
            <div className="col-span-5 md:col-span-2">
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                {m.agentic}
              </span>
            </div>
            <div className="col-span-12 text-right text-xs font-semibold text-indigo-500 md:col-span-2">
              {m.improvement}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
