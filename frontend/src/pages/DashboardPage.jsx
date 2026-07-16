import { useState } from "react";
import { Play, RefreshCw, Filter } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import MetricsBar from "../components/MetricsBar.jsx";
import CustomerCard from "../components/CustomerCard.jsx";
import ComparisonPanel from "../components/ComparisonPanel.jsx";
import CostOptimizationPanel from "../components/CostOptimizationPanel.jsx";
import { Spinner, ErrorBanner } from "../components/ui.jsx";
import { cn } from "../lib/utils";

const FILTERS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function DashboardPage() {
  const customers = useApi(() => api.listCustomers(), []);
  const metrics = useApi(() => api.metrics(), []);
  const comparison = useApi(() => api.comparison(), []);
  const cost = useApi(() => api.costOptimization(), []);
  const [filter, setFilter] = useState("ALL");
  const [running, setRunning] = useState(false);

  async function runAll() {
    setRunning(true);
    try {
      await api.runAll(50);
      await Promise.all([
        customers.refetch(),
        metrics.refetch(),
        cost.refetch(),
      ]);
    } finally {
      setRunning(false);
    }
  }

  function refreshAll() {
    customers.refetch();
    metrics.refetch();
    cost.refetch();
  }

  const list = (customers.data || []).filter(
    (c) => filter === "ALL" || c.risk_level === filter
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <MetricsBar metrics={metrics.data} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ComparisonPanel comparison={comparison.data} />
        </div>
        <CostOptimizationPanel cost={cost.data} />
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">At-Risk Customers</h2>
            <span className="text-sm text-slate-400">
              sorted by churn score
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-primary"
              onClick={runAll}
              disabled={running}
            >
              <Play size={16} className={running ? "animate-pulse" : ""} />
              {running ? "Running agents…" : "Run AI on all at-risk"}
            </button>
            <button className="btn-ghost !p-2" onClick={refreshAll} title="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                filter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {customers.loading && <Spinner label="Loading customers…" />}
        {customers.error && (
          <ErrorBanner message={customers.error} onRetry={customers.refetch} />
        )}
        {!customers.loading && !customers.error && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <CustomerCard key={c.customer_id} customer={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
