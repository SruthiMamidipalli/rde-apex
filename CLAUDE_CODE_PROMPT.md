# Build Prompt for Claude Code

Paste this into Claude Code CLI on your VM after cloning the repo:

---

## PROMPT START (copy everything below this line)

You are building a working prototype for an Accenture Reinvention Deployed Engineering bootcamp. This is a 1-day build. Read the spec files in `.kiro/specs/apex-loyalty-ai-retention/` (requirements.md, design.md, tasks.md) for full context.

## What to Build

An AI-powered customer retention system for "Apex Retail" that:
1. Cross-references 6 siloed data systems (mock data) to compute composite churn scores
2. Uses an AI agent (Claude via Bedrock) to analyze churn drivers, generate personalized offers, retention briefs, and multi-channel outreach
3. Routes tasks to different models for cost optimization (Sonnet for complex reasoning, Haiku for content generation)
4. Provides a React dashboard with approval workflow
5. Exposes capabilities as MCP tools

## Tech Stack (non-negotiable)

- Backend: Python 3.11+ / FastAPI
- Frontend: React 18 + TailwindCSS + shadcn/ui + Recharts
- AI: Amazon Bedrock (Claude Sonnet 4 for analysis/offers/briefs, Claude 3.5 Haiku for outreach/formatting)
- Data: JSON mock files (no database needed)
- MCP: Python `mcp` SDK
- Monorepo structure: `backend/` and `frontend/` directories

## Build Order (follow this exactly)

### Phase 1: Backend Foundation
1. Create `backend/` with FastAPI app, config, Pydantic data models for all 6 systems
2. Create `backend/data/mock/` with 6 JSON files (salesforce.json, shopify.json, yotpo.json, klaviyo.json, zendesk.json, google_analytics.json) — seed 25 customers with realistic varied data across all risk levels (LOW, MEDIUM, HIGH, CRITICAL)
3. Implement DataLoaderService that consolidates all 6 systems per customer
4. Implement ChurnScoreEngine with weighted scoring (transaction_recency: 0.25, engagement_drop: 0.20, support_sentiment: 0.15, session_decline: 0.15, loyalty_inactivity: 0.15, email_disengagement: 0.10)

### Phase 2: Model Router + AI Agent
5. Implement ModelRouter that routes to Claude Sonnet 4 vs Claude 3.5 Haiku based on task type, tracks token usage and costs
6. Create prompt templates in `backend/prompts/` for: analyze_drivers, generate_offer, generate_brief, generate_outreach
7. Implement RetentionAgentService with full workflow: score → analyze → offer → brief → outreach (uses ModelRouter)
8. Implement ApprovalService and AuditService

### Phase 3: API + MCP
9. Create all REST API endpoints (customers, scoring, agent, approvals, dashboard metrics, cost-optimization)
10. Implement MCP server with 5 tools: calculate_churn_score, generate_retention_offer, get_customer_signals, generate_outreach_content, get_at_risk_customers

### Phase 4: Frontend
11. Set up React project with TailwindCSS + shadcn/ui
12. Build DashboardPage with CustomerCards (color-coded by risk), MetricsBar (aggregates), radar chart (6-axis signal breakdown)
13. Build CustomerDetailPage with RetentionBrief, OutreachPreview (email/SMS/push tabs), ApprovalWorkflow (approve/override/escalate), Timeline
14. Build ComparisonPanel (before vs after metrics) and CostOptimizationPanel (model routing savings)
15. Dark/Light mode toggle

## Critical Details

- Churn score range: 0-100. Risk levels: LOW (0-25), MEDIUM (26-50), HIGH (51-75), CRITICAL (76-100)
- Customer tiers: Bronze, Silver, Gold, Platinum — higher tier = higher value offers
- Offer types: discount/bonus_points (transaction signals), exclusive_access (engagement signals), service_recovery (support signals)
- Outreach: Email (full), SMS (≤160 chars), Push (title ≤50, body ≤100 chars)
- Before vs After panel shows: campaign time 4-7 days → <2min, churn 28% → <14%, personalization 8% → 85%+, analyst hours 4-8h → <5min
- Cost panel shows: requests by model (Sonnet 4 vs Haiku), token usage, cost per model, total cost, savings vs all-Sonnet-4 baseline

## Environment Variables Needed

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
BEDROCK_MODEL_HEAVY=anthropic.claude-sonnet-4-20250514-v1:0
BEDROCK_MODEL_LIGHT=anthropic.claude-3-5-haiku-20241022-v1:0
```

## What "Done" Looks Like

- `cd backend && pip install -r requirements.txt && uvicorn main:app` starts the API on port 8000
- `cd frontend && npm install && npm run dev` starts the dashboard on port 5173
- Dashboard shows 25 customers with risk scores, clicking one shows full AI-generated retention brief
- MCP server can be connected from any MCP client
- Cost optimization panel shows actual savings from multi-model routing

## DO NOT

- Do not use Azure OpenAI — use Amazon Bedrock only
- Do not set up a database — JSON files are sufficient
- Do not skip the mock data — the demo needs realistic customer scenarios
- Do not make the UI ugly — this is a bootcamp presentation, visual appeal matters

Build everything now. Start with Phase 1 and work through sequentially. Make it production-quality code with proper error handling. Go.
