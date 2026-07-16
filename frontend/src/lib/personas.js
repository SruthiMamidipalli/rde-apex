// Persona definitions — drive the login picker, top-nav set, and which
// dashboards each role sees. Sourced from KPI_CRM_DRI_Overview.md.
//
// CRM Analyst works the queue day-to-day (detection → prioritise → intervene).
// DRI owns the outcome (approves high-value briefs, watches churn/revenue move).

export const PERSONAS = {
  crm: {
    id: "crm",
    name: "Sarah A.",
    title: "CRM Analyst",
    initials: "SA",
    blurb: "Works at-risk customers day to day — the queue, the story, the brief.",
    // Analytical view: detection + prioritisation + intervention.
    nav: [
      { to: "/", label: "Overview", end: true },
      { to: "/queue", label: "At-Risk Queue" },
      { to: "/customers", label: "Customer 360" },
      { to: "/brief", label: "Retention Brief" },
      { to: "/campaigns", label: "Campaigns" },
    ],
    home: "/",
  },
  dri: {
    id: "dri",
    name: "Dana R.",
    title: "DRI — Directly Responsible Individual",
    initials: "DR",
    blurb: "Owns the outcome — approves high-value briefs, watches churn & revenue move.",
    // Analytical view: outcomes + governance + high-value approvals.
    nav: [
      { to: "/", label: "Overview", end: true },
      { to: "/impact", label: "Impact & ROI" },
      { to: "/brief", label: "Approvals" },
      { to: "/cost", label: "Cost & Models" },
      { to: "/admin", label: "Governance" },
    ],
    home: "/",
  },
};

export const DEFAULT_PERSONA = "crm";

// Static demo credentials (prototype — no real auth backend).
// username -> { password, persona }
export const CREDENTIALS = {
  "sarah.crm": { password: "apex123", persona: "crm" },
  "dana.dri": { password: "apex123", persona: "dri" },
};

// Shown on the login page as a convenience for the demo.
export const DEMO_ACCOUNTS = [
  { persona: "crm", username: "sarah.crm", password: "apex123" },
  { persona: "dri", username: "dana.dri", password: "apex123" },
];

// Validate a username/password pair. Returns the persona id or null.
export function authenticate(username, password) {
  const rec = CREDENTIALS[(username || "").trim().toLowerCase()];
  if (rec && rec.password === password) return rec.persona;
  return null;
}
