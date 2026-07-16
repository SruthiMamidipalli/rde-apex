import { useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { Panel, Spinner } from "../components/ui.jsx";
import AiFlag from "../components/AiFlag.jsx";
import { microMoney, fmtInt, fmtNum } from "../lib/utils";

const MODEL_COLORS = { "Sonnet 4.5": "#4f6ef7", "Haiku 4.5": "#6ee7b7" };

export default function CostAnalytics() {
  const { setContext, showToast } = useStore();
  const cost = useApi(() => api.costOptimization(), []);
  const cpc = useApi(() => api.costPerCustomer(), []);
  useEffect(() => setContext({ page: "Token & Cost Analytics", customer_id: null }), [setContext]);

  const d = cost.data;
  const byModel = d?.by_model || [];
  const pie = byModel.map((m) => ({ name: m.model, value: m.cost }));
  const tokenBars = byModel.map((m) => ({
    name: m.model,
    Input: m.input_tokens,
    Output: m.output_tokens,
  }));

  return (
    <div className="space-y-4">
      <AiFlag
        area="Token & Cost Analytics"
        severity="orange"
        confidence={92}
        text={
          <>
            Multi-model routing is saving{" "}
            <strong>{d ? fmtNum(d.savings_percentage, 0) : "—"}%</strong> vs an all-Sonnet baseline.
            Signal collection & outreach run on Haiku; only conflict detection and offer strategy use
            Sonnet. Keep threshold gating on — LOW-risk customers cost $0.
          </>
        }
        evidence={["Router logs [Cost service]"]}
        onToast={showToast}
      />

      {cost.loading && <Spinner label="Loading cost telemetry…" />}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CostTile label="Total AI cost" value={microMoney(d.total_cost)} />
            <CostTile label="All-Sonnet baseline" value={microMoney(d.all_sonnet_baseline)} color="text-apex-muted" />
            <CostTile label="Savings" value={microMoney(d.savings)} color="text-apex-green" />
            <CostTile label="Savings %" value={`${fmtNum(d.savings_percentage, 0)}%`} color="text-apex-accent2" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CostTile label="Requests" value={fmtInt(d.total_requests)} />
            <CostTile
              label="Cost / customer"
              value={microMoney(cpc.data?.cost_per_customer)}
            />
            <CostTile label="Scoring cost" value="$0.00" color="text-apex-green" />
            <CostTile label="LOW-risk agent cost" value="$0.00" color="text-apex-green" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Panel title="Cost by Model">
              <div className="p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {pie.map((e, i) => (
                        <Cell key={i} fill={MODEL_COLORS[e.name] || "#7a82a0"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1c2030", border: "1px solid #2a3050", borderRadius: 8, fontSize: 11 }}
                      formatter={(v) => microMoney(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Token Usage by Model">
              <div className="p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={tokenBars} margin={{ left: 10, right: 10 }}>
                    <XAxis dataKey="name" tick={{ fill: "#7a82a0", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#7a82a0", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#1c2030", border: "1px solid #2a3050", borderRadius: 8, fontSize: 11 }}
                      formatter={(v) => fmtInt(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Input" stackId="a" fill="#4f6ef7" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Output" stackId="a" fill="#6ee7b7" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <Panel title="Per-Model Detail">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-apex-border text-left text-[10px] uppercase tracking-wide text-apex-muted">
                    <th className="px-4 py-2">Model</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Requests</th>
                    <th className="px-4 py-2">Input tokens</th>
                    <th className="px-4 py-2">Output tokens</th>
                    <th className="px-4 py-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((m) => (
                    <tr key={m.model} className="border-b border-apex-border/60">
                      <td className="px-4 py-2.5 font-semibold">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full"
                          style={{ background: MODEL_COLORS[m.model] }}
                        />
                        {m.model}
                      </td>
                      <td className="px-4 py-2.5 text-apex-muted">
                        {m.model.includes("Sonnet") ? "Conflict detection · Offer strategy" : "Signal collection · Outreach"}
                      </td>
                      <td className="px-4 py-2.5">{fmtInt(m.requests)}</td>
                      <td className="px-4 py-2.5">{fmtInt(m.input_tokens)}</td>
                      <td className="px-4 py-2.5">{fmtInt(m.output_tokens)}</td>
                      <td className="px-4 py-2.5 font-semibold">{microMoney(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function CostTile({ label, value, color }) {
  return (
    <div className="panel p-4">
      <div className="label-caps">{label}</div>
      <div className={`mt-1 text-[20px] font-extrabold ${color || "text-apex-text"}`}>{value}</div>
    </div>
  );
}
