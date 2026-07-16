import { cn, RISK_META, TIER_META, fmtKpi, kpiTone, kpiProgress } from "../lib/utils";

export function Badge({ children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
        className
      )}
    >
      {children}
    </span>
  );
}

export function RiskBadge({ level, showDot = true }) {
  const m = RISK_META[level] || RISK_META.LOW;
  return (
    <Badge className={cn(m.bg, m.text, "border", m.border)}>
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />}
      {m.label}
    </Badge>
  );
}

export function TierBadge({ tier }) {
  return (
    <Badge className={cn(TIER_META[tier] || TIER_META.Silver, "font-semibold")}>
      {tier}
    </Badge>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-3 py-6 text-apex-muted">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-apex-red/30 bg-apex-red/10 px-4 py-3 text-xs text-apex-red">
      <span>⚠ {message}</span>
      {onRetry && (
        <button className="btn !py-1" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Panel({ title, right, children, className, bodyClass }) {
  return (
    <div className={cn("panel flex flex-col overflow-hidden", className)}>
      {(title || right) && (
        <div className="panel-header">
          <div className="panel-title">{title}</div>
          {right}
        </div>
      )}
      <div className={cn("flex-1", bodyClass)}>{children}</div>
    </div>
  );
}

export function LiveChip({ label = "LIVE", color = "red" }) {
  const map = {
    red: "bg-apex-red/12 text-apex-red border-apex-red/25",
    green: "bg-apex-green/12 text-apex-green border-apex-green/25",
    accent: "bg-apex-accent/12 text-apex-accent border-apex-accent/25",
  };
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]",
        map[color]
      )}
    >
      <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-current" />
      {label}
    </span>
  );
}

// KPI card driven by the backend KPI contract.
export function KpiCard({ kpi }) {
  const tone = kpiTone(kpi.value, kpi.target, kpi.direction);
  const barColor = tone.replace("text-", "bg-");
  const pct = kpiProgress(kpi.value, kpi.target, kpi.direction);
  const delta =
    kpi.baseline != null
      ? kpi.value - kpi.baseline
      : null;
  return (
    <div className="panel card-hover flex flex-col gap-2 p-5" title={kpi.formula}>
      <div className="flex items-center justify-between">
        <div className="label-caps">{kpi.name}</div>
        {delta != null && kpi.direction !== "neutral" && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              (kpi.direction === "lower" ? delta < 0 : delta > 0)
                ? "bg-apex-green/10 text-apex-green"
                : "bg-apex-red/10 text-apex-red"
            )}
          >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
      <div className={cn("stat-value", tone)}>{fmtKpi(kpi.value, kpi.format)}</div>
      {kpi.target != null && (
        <div className="text-[11px] text-apex-muted">
          Target {fmtKpi(kpi.target, kpi.format)}
        </div>
      )}
      <div className="mt-1 h-1.5 rounded-full bg-apex-surface3">
        <div
          className={cn("h-1.5 rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-apex-muted">
        <span className="text-apex-accent">◈</span> {kpi.source}
      </div>
    </div>
  );
}

export function ScoreRing({ score, level, size = 64 }) {
  const m = RISK_META[level] || RISK_META.LOW;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" stroke="#e9edf3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="6"
          stroke={m.hex}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-extrabold" style={{ color: m.hex }}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

// Citation tag e.g. [GA]
export function Cite({ children }) {
  return <span className="text-[11px] text-apex-muted">[{children}]</span>;
}

export function ProgressBar({ value, max = 100, color = "bg-apex-accent" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-apex-surface3">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }}
      />
    </div>
  );
}
