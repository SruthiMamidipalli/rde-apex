# Apex Loyalty AI Retention

An AI-powered customer-retention system for **Apex Retail**. It cross-references
six siloed data systems to compute composite churn scores, then uses an AI agent
(Claude via Amazon Bedrock, with cost-optimized multi-model routing) to analyze
churn drivers, generate tier-matched retention offers, structured retention
briefs, and multi-channel outreach — all behind a human-in-the-loop approval
workflow and exposed both as a REST API, a React dashboard, and MCP tools.

Built for an Accenture *Reinvention Deployed Engineering* bootcamp (1-day build).

---

## Architecture

```
6 mock systems ──▶ DataLoader ──▶ ChurnScoreEngine ──▶ RetentionAgent ──▶ Approval ──▶ Audit
(Salesforce,                       (weighted 0-100)     (Model Router:      (HITL,        (JSON log)
 Shopify, Yotpo,                                         Sonnet 4.5 for      escalation)
 Klaviyo, Zendesk,                                       reasoning,
 Google Analytics)                                       Haiku 4.5 for
                                                         content)
        │                                                     │
        └──────────────── REST API (FastAPI) ─────────────────┤
        └──────────────── MCP Server (5 tools) ───────────────┘
                                  │
                          React Dashboard (Vite + Tailwind + Recharts)
```

- **Churn score**: weighted signals — transaction_recency 0.25, engagement_drop 0.20,
  support_sentiment 0.15, session_decline 0.15, loyalty_inactivity 0.15,
  email_disengagement 0.10. Missing systems re-normalize the weights.
- **Risk levels**: LOW 0-25, MEDIUM 26-50, HIGH 51-75, CRITICAL 76-100.
- **Degraded mode**: with no AWS credentials the agent falls back to
  deterministic generation that still satisfies every correctness property, so
  the demo is always fully populated.

---

## Backend (Python 3.11+ / FastAPI)

```bash
cd backend
python -m pip install -r requirements.txt
cp .env.example .env          # optional — add AWS creds for live Bedrock
uvicorn main:app --port 8000  # http://localhost:8000/docs
```

Mock data (25 customers across all risk levels) is seeded automatically on
startup. Regenerate manually with `python data/seed.py`.

### Tests (property-based, Hypothesis)

```bash
cd backend
FORCE_DEGRADED=true python -m pytest tests/ -q   # 18 correctness properties
```

### MCP server

```bash
cd backend
python -m mcp_server.server                      # stdio transport
```

Exposes 5 tools: `calculate_churn_score`, `generate_retention_offer`,
`get_customer_signals`, `generate_outreach_content`, `get_at_risk_customers`.

Example client config (`.mcp.json`):

```json
{
  "mcpServers": {
    "apex-retention": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "backend"
    }
  }
}
```

---

## Frontend (React 18 + Tailwind + Recharts)

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api -> :8000)
```

- **Dashboard**: metrics bar, color-coded customer cards (sorted by churn score),
  before/after comparison, model-routing cost panel.
- **Customer detail**: 6-axis signal radar, cited retention brief, email/SMS/push
  outreach preview, approve / override / escalate workflow, timeline.
- Dark / light theme toggle.

---

## Key API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/customers` | All customers, sorted by score desc |
| GET  | `/api/customers/{id}` | Profile + signals + score |
| POST | `/api/agent/run/{id}` | Full retention workflow |
| POST | `/api/agent/run-all` | Trigger all at-risk (priority order) |
| GET  | `/api/agent/brief/{id}` | Latest brief + workflow |
| GET  | `/api/approvals/pending` | Pending approvals (CRITICAL first) |
| POST | `/api/approvals/{id}/approve` \| `/override` \| `/escalate` | Decisions |
| GET  | `/api/dashboard/metrics` \| `/comparison` \| `/cost-optimization` | Dashboard data |

---

## Tech stack

Backend: FastAPI · Pydantic · Anthropic Bedrock SDK · `mcp` · Hypothesis.
Frontend: React 18 · Vite · TailwindCSS · Recharts · lucide-react.
AI: Amazon Bedrock — Claude Sonnet 4.5 (reasoning) + Claude Haiku 4.5 (content).
