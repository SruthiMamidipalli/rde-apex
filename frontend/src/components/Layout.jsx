import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { cn } from "../lib/utils";
import HealthStrip from "./HealthStrip.jsx";

const NAV = [
  { section: "Operate" },
  { to: "/", icon: "⬡", label: "Command Center", end: true },
  { to: "/queue", icon: "⚠", label: "At-Risk Queue", badgeKey: "at_risk" },
  { to: "/customers", icon: "◎", label: "Customer 360" },
  { to: "/brief", icon: "◈", label: "Retention Brief" },
  { section: "Execute" },
  { to: "/campaigns", icon: "✉", label: "Campaign & Outreach" },
  { section: "Analyse" },
  { to: "/impact", icon: "◫", label: "Impact & ROI" },
  { to: "/cost", icon: "⬡", label: "Token & Cost Analytics" },
  { section: "Configure" },
  { to: "/admin", icon: "⚙", label: "Admin & Governance" },
];

const TITLES = {
  "/": ["Command Center", "Live dashboard · all segments"],
  "/queue": ["At-Risk Queue", "Ranked by risk × value"],
  "/customers": ["Customer 360", "Cross-system deep view"],
  "/brief": ["Retention Brief", "Agent recommendation & approval"],
  "/campaigns": ["Campaign & Outreach", "Multi-channel orchestration"],
  "/impact": ["Impact & ROI", "Outcome scorecard"],
  "/cost": ["Token & Cost Analytics", "Multi-model routing economics"],
  "/admin": ["Admin & Governance", "Config, audit & model monitoring"],
};

function Clock() {
  const [t, setT] = useState("—");
  useEffect(() => {
    const tick = () =>
      setT(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="rounded-full border border-apex-border bg-apex-surface2 px-2.5 py-1 text-[11px] text-apex-muted">
      {t}
    </span>
  );
}

export default function Layout({ children }) {
  const loc = useLocation();
  const metrics = useApi(() => api.metrics(), []);
  const health = useApi(() => api.health(), []);
  const atRisk = metrics.data?.total_at_risk;

  // Match the most specific route for the title.
  const pathKey =
    Object.keys(TITLES)
      .filter((k) => k !== "/")
      .find((k) => loc.pathname.startsWith(k)) ||
    (loc.pathname === "/" ? "/" : null);
  const [title, sub] = TITLES[pathKey] || ["Apex", ""];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-[220px] min-w-[220px] flex-col border-r border-apex-border bg-apex-surface">
        <div className="border-b border-apex-border px-[18px] py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-apex-accent">
            Apex
          </div>
          <div className="mt-0.5 text-[9px] tracking-[0.08em] text-apex-muted">
            Retention Intelligence Platform
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2.5">
          {NAV.map((item, i) =>
            item.section ? (
              <div
                key={i}
                className="px-[18px] pb-1 pt-3.5 text-[9px] font-bold uppercase tracking-[0.12em] text-apex-muted"
              >
                {item.section}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 border-l-[3px] px-[18px] py-2.5 text-[12px] font-medium transition-all",
                    isActive
                      ? "border-apex-accent bg-apex-surface2 text-apex-text"
                      : "border-transparent text-apex-muted hover:bg-apex-surface2 hover:text-apex-text"
                  )
                }
              >
                <span className="w-[18px] text-center text-sm">{item.icon}</span>
                {item.label}
                {item.badgeKey === "at_risk" && atRisk != null && (
                  <span className="ml-auto rounded-full bg-apex-red px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {atRisk}
                  </span>
                )}
              </NavLink>
            )
          )}
        </nav>
        <div className="border-t border-apex-border px-[18px] py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-apex-accent to-apex-accent2 text-[11px] font-bold text-white">
              SA
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold">Sarah A.</div>
              <div className="text-[10px] text-apex-muted">CRM Analyst</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-[52px] flex-shrink-0 items-center gap-4 border-b border-apex-border bg-apex-surface px-6">
          <div className="flex-1 text-[15px] font-bold">
            {title}
            <span className="ml-2 text-[11px] font-normal text-apex-muted">{sub}</span>
          </div>
          <div className="flex items-center gap-2">
            {health.data?.mode && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  health.data.mode === "full"
                    ? "bg-apex-green/15 text-apex-green"
                    : "bg-apex-amber/15 text-apex-amber"
                )}
                title={
                  health.data.mode === "full"
                    ? "Amazon Bedrock connected"
                    : "Deterministic fallback (no Bedrock credentials)"
                }
              >
                {health.data.mode === "full" ? "● Bedrock live" : "● Degraded mode"}
              </span>
            )}
            <Clock />
          </div>
        </div>

        <HealthStrip />

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
