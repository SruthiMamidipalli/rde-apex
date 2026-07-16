You are building the Apex Retention Intelligence Platform — a 1-day prototype for an Accenture RDE bootcamp.
READ THESE FILES FIRST (they are your source of truth):
- .kiro/specs/apex-loyalty-ai-retention/SPEC_DOCUMENT.md (full spec)
- .kiro/specs/apex-loyalty-ai-retention/FEATURE_LIST.md (all features with scope)
- .kiro/specs/apex-loyalty-ai-retention/architecture-diagrams.md (tech architecture)
- .kiro/specs/apex-loyalty-ai-retention/apex_command_center.html (UI design reference - replicate this visual style)
- .kiro/specs/apex-loyalty-ai-retention/solution_visualization_v2.html (architecture visualization reference)
- Apex_KPI­­List_Main.csv (KPI formulas, sources, refresh cadence — use these EXACT formulas in the backend)
BUILD THE FULL APPLICATION:
FRONTEND (React 18 + TailwindCSS + shadcn/ui + Recharts):
- Replicate the dark theme from apex_command_center.html exactly (colors, spacing, layout)
- 7 navigable areas: Command Center, At-Risk Queue, Customer 360, Retention Brief, Campaign & Outreach, Impact & ROI, Admin & Governance
- Plus: Token & Cost Analytics page (model routing costs)
- AI Recommendation Flags on every page (orange badge, cited, confidence, accept/modify/dismiss)
- AI Chatbot (bottom-right FAB, side panel, context-aware)
- KPIs use the EXACT formulas from the CSV
BACKEND (Python 3.11+ / FastAPI):
- Composite Score Engine: normalize → weight → blend + interaction boosts (formulas from CSV)
- Multi-agent orchestration: Signal Collector (Haiku), Conflict Detector (Sonnet), Offer Strategist (Sonnet), Engagement Crafter (Haiku)
- Model Router: routes by task complexity, tracks tokens + cost per request
- Approval Service: value-threshold routing, SLA timers
- Audit Trail: 100% coverage, immutable
- All KPI endpoints computed using formulas from the CSV
- MCP Server: 5+ tools exposed
DATA (Mock JSON — 25 customers):
- 6 JSON files: salesforce.json, shopify.json, yotpo.json, klaviyo.json, zendesk.json, google_analytics.json
- Mix of risk levels: ~5 CRITICAL, ~8 HIGH, ~7 MEDIUM, ~5 LOW
- Include the "Eleanor Voss" case (score 91, CRM says 72 healthy but actually churning)
- Include realistic LTV values for risk × value ranking
AI (Amazon Bedrock): Okay to switch models if legacy are not available.
- Claude 3.5 Sonnet for: conflict detection, offer strategy, complex chatbot queries
- Claude 3 Haiku for: signal collection, outreach drafting, simple chatbot queries
- Track token usage and cost per call for the Cost Analytics page
CRITICAL REQUIREMENTS:
1. The UI can look like apex_command_center.html — dark theme, same color palette, same component style
2. KPI formulas MUST match the CSV exactly — these are the source of truth. If UI has missing KPIs, factor them in.
3. Agents MUST be truly agentic: Signal Collector decides query order, Conflict Detector can REJECT, Offer Strategist can ESCALATE
4. Cost panel shows: per-request model + tokens + cost, savings vs all-Sonnet baseline
5. Chatbot is context-aware (knows which page/customer is selected)
STRUCTURE:
backend/
frontend/
Start building now. Phase 1: Backend + mock data. Phase 2: Frontend replicating the HTML design. Phase 3: Wire together.