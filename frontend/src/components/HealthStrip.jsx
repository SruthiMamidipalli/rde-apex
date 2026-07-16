import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { cn } from "../lib/utils";

const COLOR = {
  green: "bg-apex-green/10 border-apex-green/25 text-apex-green",
  amber: "bg-apex-amber/10 border-apex-amber/25 text-apex-amber",
  red: "bg-apex-red/10 border-apex-red/25 text-apex-red",
};

export default function HealthStrip() {
  const health = useApi(() => api.systemHealth(), []);
  const connectors = health.data?.connectors || [];
  return (
    <div className="flex items-center gap-1.5 border-b border-apex-border bg-apex-surface px-6 py-2">
      <span className="mr-1 label-caps">Connectors</span>
      {connectors.map((c) => (
        <span
          key={c.name}
          title={`${c.name} · ${c.uptime_pct}% uptime · ${c.last_sync}`}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
            COLOR[c.status]
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-current",
              c.status !== "amber" && "animate-pulse2"
            )}
          />
          {c.name}
          {c.status === "amber" && (
            <span className="text-[9px] opacity-80">{c.last_sync}</span>
          )}
        </span>
      ))}
      <div className="flex-1" />
      <span className="text-[10px] text-apex-muted">
        {health.data ? `${health.data.healthy}/${health.data.total} healthy` : "—"} · last
        sync just now
      </span>
    </div>
  );
}
