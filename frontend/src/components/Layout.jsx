import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  LayoutGrid, BarChart3, Users, FileText, Megaphone,
  DollarSign, ShieldCheck, Search, Bell, LogOut, ChevronsLeft,
} from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { cn } from "../lib/utils";
import { PERSONAS } from "../lib/personas";

// Icon per route.
const ICONS = {
  "/": LayoutGrid,
  "/queue": BarChart3,
  "/customers": Users,
  "/brief": FileText,
  "/campaigns": Megaphone,
  "/impact": BarChart3,
  "/cost": DollarSign,
  "/admin": ShieldCheck,
};

const TITLES = {
  "/": ["Overview", "Live retention dashboard"],
  "/queue": ["At-Risk Queue", "Ranked by risk × value"],
  "/customers": ["Customer 360", "Cross-system deep view"],
  "/brief": ["Retention Brief", "Agent recommendation & approval"],
  "/campaigns": ["Campaign & Outreach", "Multi-channel orchestration"],
  "/impact": ["Impact & ROI", "Outcome scorecard"],
  "/cost": ["Token & Cost Analytics", "Multi-model routing economics"],
  "/admin": ["Admin & Governance", "Config, audit & model monitoring"],
};

export default function Layout({ children }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { persona, setPersona } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const metrics = useApi(() => api.metrics(), []);
  const health = useApi(() => api.systemHealth(), []);
  const atRisk = metrics.data?.total_at_risk;
  const degraded = (health.data?.connectors || []).filter((c) => c.status !== "green");

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function signOut() {
    setMenuOpen(false);
    setPersona(null);
    navigate("/", { replace: true });
  }

  const p = PERSONAS[persona];
  const nav = (p?.nav || []).map((n) => ({
    ...n,
    Icon: ICONS[n.to] || LayoutGrid,
    badge: n.to === "/queue" ? atRisk : undefined,
  }));

  const pathKey =
    Object.keys(TITLES)
      .filter((k) => k !== "/")
      .find((k) => loc.pathname.startsWith(k)) ||
    (loc.pathname === "/" ? "/" : null);
  const [title, sub] = TITLES[pathKey] || ["Apex", ""];

  return (
    <div className="flex h-screen overflow-hidden bg-apex-bg">
      {/* Sidebar */}
      <aside className="flex w-[224px] flex-shrink-0 flex-col border-r border-apex-border bg-apex-surface">
        <div className="flex items-center justify-between px-3.5 pb-3.5 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-brand-gradient">
              <LogoMark />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">Apex</div>
              <div className="text-[10px] font-medium text-apex-muted">Loyalty</div>
            </div>
          </div>
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border border-apex-border bg-apex-surface3 text-apex-muted">
            <ChevronsLeft size={13} />
          </div>
        </div>
        <div className="mx-3.5 mb-2.5 h-px bg-apex-surface3" />

        <nav className="flex-1 overflow-y-auto px-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative mb-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13.5px] transition-colors",
                  isActive
                    ? "bg-apex-accent/[0.08] font-medium text-apex-accent before:absolute before:-left-2 before:top-1/2 before:h-[60%] before:w-[3px] before:-translate-y-1/2 before:rounded-r-[3px] before:bg-brand-gradient"
                    : "text-apex-muted2 hover:bg-apex-surface2 hover:text-apex-text"
                )
              }
            >
              <item.Icon size={16} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge != null && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-apex-crit px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex-shrink-0 border-t border-apex-border px-2 py-2.5">
          {degraded.length > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] text-apex-amber">
              <span className="h-1.5 w-1.5 rounded-full bg-apex-amber" />
              {degraded.length} source{degraded.length > 1 ? "s" : ""} degraded
            </div>
          )}
          {/* User row + sign-out menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="mt-1 flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition hover:bg-apex-surface2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-[12px] font-bold text-white">
                {p?.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-apex-text">{p?.name}</div>
                <div className="bg-brand-gradient bg-clip-text text-[11px] font-medium text-transparent">
                  {p?.title}
                </div>
              </div>
            </button>
            {menuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-apex-border bg-apex-surface shadow-pop">
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-apex-text transition hover:bg-apex-surface2"
                >
                  <LogOut size={14} className="text-apex-muted" />
                  Sign out / switch role
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[60px] flex-shrink-0 items-center gap-3.5 border-b border-apex-border bg-apex-surface px-7">
          <div className="flex max-w-[360px] flex-1 items-center gap-2 rounded-[10px] bg-apex-surface3 px-3.5 py-2.5 text-[13.5px] text-apex-muted">
            <Search size={14} />
            <span className="flex-1">Search customers or decisions…</span>
            <kbd className="rounded-[5px] bg-black/[0.06] px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {health.data && (
              <span className="text-[11px] text-apex-muted">
                {health.data.healthy}/{health.data.total} healthy
              </span>
            )}
            <button className="relative flex h-9 w-9 items-center justify-center rounded-[9px] bg-apex-surface3 text-apex-muted2">
              <Bell size={16} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full border border-white bg-apex-brand1" />
            </button>
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-brand-gradient text-[12px] font-bold text-white">
              {p?.initials}
            </div>
          </div>
        </header>

        <div className="flex flex-shrink-0 items-baseline gap-3 px-7 pb-1 pt-5">
          <h1 className="display text-[26px]">{title}</h1>
          <span className="text-[13px] text-apex-muted">{sub}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-7 pb-8 pt-3">{children}</div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M8 17L12 7L16 17" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 14H14.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
