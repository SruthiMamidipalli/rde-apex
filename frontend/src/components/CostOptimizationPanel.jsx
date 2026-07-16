import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Coins, Zap } from "lucide-react";
import { useTheme } from "../lib/theme.jsx";
import { money } from "../lib/utils";

const MODEL_COLOR = { "Sonnet 4.5": "#6366f1", "Haiku 4.5": "#10b981" };

export default function CostOptimizationPanel({ cost }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  if (!cost) return null;

  const hasData = cost.total_requests > 0;
  const chartData = (cost.by_model || []).map((m) => ({
    model: m.model,
    cost: m.cost,
    requests: m.requests,
  }));
  const grid = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#94a3b8" : "#475569";

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Coins className="text-amber-500" size={20} />
        <h2 className="text-lg font-bold">Model Routing & Cost Optimization</h2>
      </div>

      {!hasData ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No AI requests yet. Run an agent workflow to populate routing costs.
        </p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">Total cost</div>
              <div className="text-xl font-bold">{money(cost.total_cost)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                All-Sonnet baseline
              </div>
              <div className="text-xl font-bold text-slate-400 line-through">
                {money(cost.all_sonnet_baseline)}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
              <div className="text-xs text-emerald-600 dark:text-emerald-400">Saved</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {money(cost.savings)}
              </div>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-500/10">
              <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                <Zap size={12} /> Savings
              </div>
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {cost.savings_percentage}%
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 12 }}>
              <XAxis type="number" tick={{ fill: text, fontSize: 11 }} stroke={grid} />
              <YAxis
                dataKey="model"
                type="category"
                tick={{ fill: text, fontSize: 12, fontWeight: 600 }}
                stroke={grid}
                width={80}
              />
              <Tooltip
                cursor={{ fill: dark ? "#1e293b" : "#f1f5f9" }}
                contentStyle={{
                  background: dark ? "#0f172a" : "#fff",
                  border: `1px solid ${grid}`,
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v, n, p) => [
                  `${money(v)} · ${p.payload.requests} req`,
                  p.payload.model,
                ]}
              />
              <Bar dataKey="cost" radius={[0, 8, 8, 0]}>
                {chartData.map((d) => (
                  <Cell key={d.model} fill={MODEL_COLOR[d.model] || "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
            {(cost.by_model || []).map((m) => (
              <span key={m.model} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: MODEL_COLOR[m.model] || "#64748b" }}
                />
                {m.model}: {m.requests} req · {(m.input_tokens + m.output_tokens).toLocaleString()} tok
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
