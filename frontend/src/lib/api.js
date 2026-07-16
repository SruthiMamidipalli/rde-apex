// API client wrapper for the Apex Retention FastAPI backend.
// In dev, Vite proxies /api -> http://localhost:8000.

const BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/health"),

  // Customers
  listCustomers: () => request("/customers"),
  getCustomer: (id) => request(`/customers/${id}`),
  getSignals: (id) => request(`/customers/${id}/signals`),
  getAudit: (id) => request(`/customers/${id}/audit`),

  // Scoring
  score: (id) => request(`/score/${id}`, { method: "POST" }),
  atRisk: (threshold = 50) => request(`/score/at-risk?threshold=${threshold}`),
  rankedQueue: (threshold = 50) => request(`/queue/ranked?threshold=${threshold}`),

  // Agents
  runAgent: (id) => request(`/agent/run/${id}`, { method: "POST" }),
  runAll: (threshold = 50) =>
    request(`/agent/run-all?threshold=${threshold}`, { method: "POST" }),
  getBrief: (id) => request(`/agent/brief/${id}`),

  // Approvals
  pendingApprovals: () => request("/approvals/pending"),
  approve: (approvalId, approver = "sarah.a") =>
    request(`/approvals/${approvalId}/approve`, {
      method: "POST",
      body: JSON.stringify({ approver }),
    }),
  override: (approvalId, modifications, approver = "sarah.a") =>
    request(`/approvals/${approvalId}/override`, {
      method: "POST",
      body: JSON.stringify({ approver, modifications }),
    }),
  escalate: (approvalId, reason = "Manual escalation to DRI") =>
    request(`/approvals/${approvalId}/escalate`, {
      method: "POST",
      body: JSON.stringify({ approver: "sarah.a", reason, escalated_to: "DRI" }),
    }),

  // Dashboard / KPIs
  metrics: () => request("/dashboard/metrics"),
  comparison: () => request("/dashboard/comparison"),
  costOptimization: () => request("/dashboard/cost-optimization"),
  signalsFeed: () => request("/dashboard/signals-feed"),
  systemHealth: () => request("/dashboard/system-health"),
  kpiCommandCenter: () => request("/kpi/command-center"),
  kpiAtRiskQueue: () => request("/kpi/at-risk-queue"),
  kpiImpactRoi: () => request("/kpi/impact-roi"),
  kpiAdmin: () => request("/kpi/admin"),
  costPerCustomer: () => request("/kpi/cost-per-customer"),

  // Campaigns & Admin
  campaigns: () => request("/campaigns"),
  adminConfig: () => request("/admin/config"),
  adminAudit: (limit = 100) => request(`/admin/audit?limit=${limit}`),

  // Chatbot
  chatbot: (message, context = {}) =>
    request("/chatbot", {
      method: "POST",
      body: JSON.stringify({ message, context }),
    }),
};
