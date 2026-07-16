import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, ShieldCheck, Check } from "lucide-react";
import { useStore } from "../lib/store";
import { PERSONAS, DEFAULT_PERSONA } from "../lib/personas";

const PERSONA_META = {
  crm: {
    Icon: BarChart3,
    sub: "Manage retention queue, review AI offers, and track customer health",
  },
  dri: {
    Icon: ShieldCheck,
    sub: "Approve high-value interventions and monitor business outcomes",
  },
};

export default function Login() {
  const { setPersona } = useStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(DEFAULT_PERSONA);

  function signIn() {
    setPersona(selected);
    navigate(PERSONAS[selected].home, { replace: true });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          "linear-gradient(135deg,#c84b9e 0%,#7b52c8 40%,#3a5fd4 70%,#0d0d2b 100%)",
      }}
    >
      <div className="grid w-full max-w-[960px] overflow-hidden rounded-[20px] border border-white/20 shadow-[0_32px_80px_rgba(0,0,0,0.4)] md:grid-cols-2 md:min-h-[580px]">
        {/* Hero */}
        <div
          className="relative flex flex-col justify-between overflow-hidden p-8"
          style={{
            background:
              "linear-gradient(160deg,#c84b9e 0%,#9b4fc4 20%,#6a4ec8 40%,#3a5fd4 62%,#1a1a6e 80%,#080820 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 120% 60% at 20% 30%,rgba(200,75,158,0.55) 0%,transparent 60%),radial-gradient(ellipse 100% 50% at 80% 20%,rgba(106,78,200,0.45) 0%,transparent 55%),radial-gradient(ellipse 90% 70% at 50% 80%,rgba(10,10,80,0.70) 0%,transparent 60%)",
            }}
          />
          <div className="relative z-10 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.15em] text-white/55">
            Apex Intelligence
            <span className="h-px flex-1 bg-white/20" />
          </div>
          <div className="relative z-10">
            <h1 className="display mb-4 text-[52px] leading-[1.05] text-white">
              Retain
              <br />
              Every
              <br />
              Customer
            </h1>
            <p className="max-w-[280px] text-[13px] leading-relaxed text-white/60">
              AI-powered retention intelligence — surface risk, act fast, and save
              every relationship that matters.
            </p>
          </div>
        </div>

        {/* Auth panel */}
        <div className="flex flex-col items-start justify-center bg-white px-[52px] py-12">
          <div className="mb-10 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-brand-gradient">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M8 17L12 7L16 17" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.5 14H14.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[17px] font-bold tracking-tight text-apex-text">APEX</span>
          </div>

          <h2 className="display mb-1.5 text-[32px] text-apex-text">Welcome back</h2>
          <p className="mb-7 text-[13px] text-apex-muted">Select your role to continue</p>

          <div className="mb-6 flex w-full flex-col gap-3">
            {Object.values(PERSONAS).map((persona) => {
              const meta = PERSONA_META[persona.id];
              const active = selected === persona.id;
              return (
                <button
                  key={persona.id}
                  onClick={() => setSelected(persona.id)}
                  className={cn2(
                    "flex w-full items-center gap-3.5 rounded-xl border px-[18px] py-4 text-left transition-all",
                    active
                      ? "border-2 border-apex-accent bg-apex-accent/[0.05] shadow-[0_0_0_3px_rgba(119,69,230,0.12)]"
                      : "border-[1.5px] border-apex-border bg-white hover:border-apex-muted"
                  )}
                >
                  <meta.Icon
                    size={22}
                    className={active ? "text-apex-accent" : "text-apex-muted"}
                  />
                  <div className="flex-1">
                    <div
                      className={cn2(
                        "mb-0.5 text-[14px] font-semibold",
                        active ? "text-apex-accent" : "text-apex-text"
                      )}
                    >
                      {persona.title}
                    </div>
                    <div className="text-[12px] leading-snug text-apex-muted">{meta.sub}</div>
                  </div>
                  <span
                    className={cn2(
                      "flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full transition-all",
                      active ? "border-2 border-apex-accent bg-apex-accent" : "border-[1.5px] border-apex-border"
                    )}
                  >
                    {active && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={signIn}
            className="mb-3 flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-apex-ink py-3.5 text-[15px] font-medium text-white transition hover:bg-neutral-800"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Sign in with SSO
          </button>
          <p className="w-full text-center text-[12px] text-apex-muted">
            Prototype · mock sign-in — no password required.
          </p>
        </div>
      </div>
    </div>
  );
}

// local classnames helper (avoids importing to keep this self-contained)
function cn2(...xs) {
  return xs.filter(Boolean).join(" ");
}
