# Apex Retention Intelligence Platform — Specification Document

## 1. Executive Summary

**Product**: A real-time, multi-agent churn detection and retention orchestration platform that sits above six existing retail systems, computes unified composite churn scores, and fires personalized retention interventions with human approval — all in under 2 minutes.

**Problem**: Apex Retail's $2.1M loyalty platform hasn't reduced churn (28%, 3× benchmark). Six systems hold the answer but don't talk to each other. Manual retention workflows take 4-7 days. By then, customers are gone.

**Solution**: An intelligence and orchestration layer that uses specialized AI agents to autonomously gather data, detect conflicts between systems, design personalized interventions, and draft multi-channel outreach — presenting everything to a human for 1-click approval.

**Core Promise**: "Is this customer about to churn, and what offer would keep them?" — answered in <2 minutes with cited evidence, not 4-8 hours of manual work.

---

## 2. Platform Structure

### Seven Application Areas + AI Layer

| # | Area | Primary User | Core Question |
|---|------|-------------|---------------|
| 1 | Command Center | All | "What's happening right now?" |
| 2 | At-Risk Queue | Analyst/Ops | "Who needs intervention, ranked by risk × value?" |
| 3 | Customer 360 | Analyst/DRI | "What's the full cross-system story?" |
| 4 | Retention Brief | Analyst/DRI | "What's the recommended action, and why?" |
| 5 | Campaign & Outreach | Analyst/Marketing | "What are we sending, and did it work?" |
| 6 | Impact & ROI | Finance/Exec | "Is this moving churn, redemption, revenue?" |
| 7 | Admin & Governance | Admin | "Are integrations healthy, is scoring correct?" |

### AI Layer (present on ALL areas)
- **Recommendation Flags** (§12 pattern): Inline, color-coded, cited, confidence-scored suggestions per section
- **AI Chatbot Assistant**: Docked, context-aware, action-capable, cross-section flagging

---

## 3. Technical Architecture

### 3.1 Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + TailwindCSS + shadcn/ui + Recharts | 7-area SPA with chatbot overlay |
| Backend API | Python 3.11+ / FastAPI | REST endpoints for all areas |
| AI Models | Claude 3.5 Sonnet + Claude 3 Haiku via Amazon Bedrock | Multi-model routing |
| Data | JSON mock files (6 systems + audit + cost tracking) | 25 customers seeded |
| MCP | Python `mcp` SDK | 5+ exposed tools |
| Deployment | Azure VM (local dev server) | FastAPI :8000, Vite :5173 |

### 3.2 Cross-Cutting Engines

| Engine | Role | LLM Usage |
|--------|------|-----------|
| Composite Score Engine | Normalize → weight → blend → classify all customers | None (algorithmic, free) |
| Agent Orchestration | 4 specialized agents with autonomy | Sonnet + Haiku (cost-optimized) |
| Identity Resolution Service | Join 6 system IDs → golden customer record | None (deterministic) |
| Feedback Orchestrator | Write-back, conflict resolution, rollback | None (transactional) |
| Audit Trail | Immutable log of all actions (100% coverage) | None (persistence) |
| Cost Optimization Service | Route models, track tokens, compute savings | None (metadata) |

### 3.3 Multi-Agent System

```
Orchestrator (decides pipeline based on risk level)
│
├── Signal Collector Agent (Haiku — cheap)
│   Tools: query_crm, query_shopify, query_yotpo, query_klaviyo, query_zendesk, query_analytics
│   Autonomy: decides query order, skips stale systems, re-queries if needed
│
├── Conflict Detector Agent (Sonnet — complex reasoning)
│   Reasons: finds contradictions between systems, identifies gap types
│   Autonomy: CAN REJECT entire pipeline ("not real churn, seasonal pattern")
│
├── Offer Strategist Agent (Sonnet — judgment)
│   Tools: get_tier, get_offer_history, check_margin
│   Autonomy: CAN ESCALATE ("needs DRI personal call"), combines offers
│
├── Engagement Crafter Agent (Haiku — content)
│   Tools: get_channel_prefs, get_brand_voice
│   Autonomy: picks channel priority, negotiates with Offer Agent on wording
│
└── Chatbot Agent (Sonnet/Haiku — mixed)
    Capabilities: explain, navigate, flag sections, take actions within RBAC
```

### 3.4 Cost Optimization Model

| Component | Model | Cost (per M tokens) | Per-Customer |
|-----------|-------|--------------------:|-------------:|
| Scoring Engine | No LLM | $0.00 | $0.000 |
| Signal Collector | Haiku | $0.25/$1.25 | ~$0.008 |
| Conflict Detector | Sonnet | $3.00/$15.00 | ~$0.140 |
| Offer Strategist | Sonnet | $3.00/$15.00 | ~$0.140 |
| Engagement Crafter | Haiku | $0.25/$1.25 | ~$0.008 |
| **Total per intervention** | | | **~$0.30** |
| **All-Sonnet baseline** | | | **~$1.05** |
| **Savings** | | | **71%** |

**Scale economics**: 400 interventions/week = ~$120 agent cost vs. 80-160 analyst hours saved.

**Threshold gating**: LOW risk customers = $0 (scoring only). Only HIGH/CRITICAL invoke agents. This means ~80% of customers cost nothing.

---

## 4. Composite Score Engine (The Core Algorithm)

### Signal Normalization
Each raw metric → 0-100 risk sub-score (higher = more churn risk):

| System | Signal | Normalization Rule |
|--------|--------|--------------------|
| GA | Session change % | `min(100, abs(change) × 1.4)` — decay curve |
| Shopify | AOV decline + discount rate | Composite of recency + margin erosion |
| Yotpo | Days since redemption | Step function: 0 redemptions @ 4+ weeks = 95-100 |
| Klaviyo | Open rate | `max(0, (1 - open_rate/0.25) × 100)` vs 25% benchmark |
| Zendesk | Unresolved + sentiment | Linear ramp on duration + sentiment penalty |
| Salesforce | Engagement score | Inverted: `100 - engagement_score` (lowest weight — lagging) |

### Weighting
```
transaction_recency (Shopify):    0.25  ← strongest predictor
engagement_drop (CRM):            0.20  ← but lagging, lowest trust
support_sentiment (Zendesk):      0.15  ← proven precursor
session_decline (GA):             0.15  ← earliest signal (2-3 week lead)
loyalty_inactivity (Yotpo):       0.15  ← strongest single signal
email_disengagement (Klaviyo):    0.10  ← confirmation signal
                                  ────
                                  1.00
```

### Interaction Boost
When GA-collapse + zero-redemption + unresolved-ticket co-occur → multiplier lifts score (this produces the 91/100 exemplar from the case study).

### Output Contract
```json
{
  "score": 91,
  "band": "CRITICAL",
  "top_signals": [
    {"source": "GA", "signal": "session_decline", "sub_score": 84, "weight": 0.15},
    {"source": "Yotpo", "signal": "loyalty_inactivity", "sub_score": 100, "weight": 0.15},
    {"source": "Zendesk", "signal": "support_sentiment", "sub_score": 73, "weight": 0.15}
  ],
  "confidence": 88,
  "model_version": "v1.0",
  "interaction_boost_applied": true
}
```

---

## 5. Key User Flows

### Flow 1: Automated Detection → Intervention (Happy Path)
1. GA session collapse fires trigger
2. Scoring Engine computes: 91/100 CRITICAL
3. Orchestrator invokes full agent pipeline
4. Signal Collector gathers all 6 systems (parallel)
5. Conflict Detector: "CRM says healthy, 4 systems say churning. Gap identified."
6. Offer Strategist: "Gold tier + transaction signal → double-points + service recovery. Confidence 87%."
7. Engagement Crafter: "SMS first (email ignored). Urgent tone. Personalized."
8. Package delivered to dashboard (elapsed: 47 seconds)
9. Analyst clicks Approve
10. Campaign live. Audit logged. KPIs update.

### Flow 2: Chatbot-Initiated
1. Analyst opens chatbot: "Show me today's top 10 high-value at-risk customers"
2. Chatbot queries At-Risk Queue (risk × value sorted)
3. Returns list with deep links
4. Analyst: "Generate brief for customer #1042"
5. Chatbot triggers agent pipeline, returns brief in panel
6. Analyst reviews, approves via chatbot: "Approve this"
7. Chatbot submits to approval gate → campaign fires

### Flow 3: Cross-Section Flagging
1. DRI opens chatbot: "Flag every area that needs my attention"
2. Chatbot scans all 7 areas:
   - 🔴 At-Risk Queue: 120 high-value CRITICAL customers unactioned
   - 🟠 Command Center: churn spike in Tier 2
   - 🟡 Campaign: 3 sends blocked by consent
   - 🟠 Impact & ROI: Segment 3 below target
   - 🟢 Customer 360 / Brief / Admin: no attention needed
3. DRI clicks deep link → goes directly to the issue

---

## 6. KPIs & Dashboard Metrics

### Before → After (from Case Study Slides 8/9)

| KPI | Before | After (Target) | How Computed in Platform |
|-----|--------|----------------|--------------------------|
| Annual churn rate | 28% | < 14% | HIGH+CRITICAL customers / total |
| Campaign launch time | 4-7 days | < 2 min | signal_detected_at → campaign_approved_at |
| Loyalty redemption rate | 0% (8 wk) | > 35% (90d) | Simulated post-intervention success |
| Offer personalization | ~8% | > 85% | offer_signal_matched / total interventions |
| Analyst hours/segment | 4-8 hrs | < 5 min | Agent pipeline duration |
| Churn signal lead time | 0 days | 14 days | GA signal vs CRM detection lag |
| Audit trail coverage | 0% | 100% | Actions with audit / total actions |
| Revenue saved/intervention | $0 | $180-$420 | LTV × churn_probability_reduction |
| Annual revenue protected | $0 | > $7M | Sum of all interventions annualized |
| CSAT on loyalty | 54/100 | 80+/100 | Simulated |

### Cost Optimization Metrics (NEW)

| Metric | Value |
|--------|-------|
| Cost per intervention | ~$0.30 |
| All-Sonnet baseline | ~$1.05 |
| Savings percentage | 71% |
| % customers requiring agents | ~20% (HIGH + CRITICAL only) |
| Scoring cost (all customers) | $0 (algorithmic) |
| Weekly agent spend (at scale) | ~$120 |
| Weekly analyst hours saved | 80-160 hrs |

---

## 7. AI Recommendation Pattern (§12)

Every recommendation on every screen follows this consistent structure:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 CRITICAL                                                  │
│                                                              │
│ Trust the composite, not CRM: GA -60% + 0 redemptions       │
│ override the 72/100 "healthy" score.                         │
│                                                              │
│ Evidence: Sessions -60% [GA] · Zero redemptions [Yotpo] ·   │
│ Unresolved 6d [Zendesk] · AOV -34% [Shopify]                │
│                                                              │
│ Confidence: 90/100                                           │
│                                                              │
│ [✓ Accept]  [✏️ Modify]  [✕ Dismiss]                         │
└─────────────────────────────────────────────────────────────┘
```

All actions logged to audit trail. Dismissed/modified recs feed model monitoring.

---

## 8. Loophole Resolutions Summary

| # | Gap | Resolution | Where |
|---|-----|-----------|-------|
| 1 | Scoring model undefined | Fully specified: normalize → weight → blend + interaction boosts | Score Engine |
| 2 | Real-time unproven | Fast path (streaming) + full path (batch), latency SLA per connector | Integration layer |
| 3 | No identity resolution | Identity Resolution Service (deterministic + probabilistic) | Cross-cutting engine |
| 4 | Write-back unspecified | Feedback Orchestrator (idempotent, conflict-aware, rollback) | Campaign service |
| 5 | No admin role | Area 7 + Admin/Platform Owner role | Admin & Governance |
| 6 | DRI bottleneck | Approval policy engine (delegation, SLA, auto-approve) | Approval service |
| 7 | No privacy/consent | Consent & Compliance layer (GDPR, opt-out, channel consent) | Governance |
| 8 | No frequency capping | Contact policy service (max messages, cooldown, suppression) | Campaign service |
| 9 | Attribution undefined | A/B framework, incremental lift × value, confidence intervals | Impact & ROI |
| 10 | No value ranking | Risk × LTV ranking in queue | At-Risk Queue |
| 11 | No FP/FN handling | Model monitoring (precision/recall, drift alerts) | Admin |
| 12 | No margin guardrails | Per-offer cost metadata + margin ceiling per intervention | Offer catalog |
| 13 | Single-customer scope | Cohort validation + cold-start rules | Rollout plan |
| 14 | Marketing distrust | Catalog ownership + agent-vs-marketing governance | Admin |
| 15 | No degraded mode | Partial-data scoring + low-confidence flag + human fallback | Cross-cutting |

---

## 9. Prototype Scope (1-Day Build)

### What we build:
- All 7 UI areas (with key features per area)
- Composite Score Engine (full algorithm)
- 4-agent pipeline with multi-model routing
- AI Chatbot (basic context-aware version)
- Recommendation flags on each area
- Cost optimization panel
- Mock data (25 customers, 6 systems)
- MCP server (5 tools)
- Audit trail

### What we simulate:
- Identity resolution (pre-joined in mock data)
- Write-back to source systems (logged but not executed)
- Real-time streaming (periodic recalc instead)
- A/B testing framework (static comparison data)
- RBAC (single-user prototype)

### What we show on roadmap slide:
- Full identity graph service
- Production write-back with conflict resolution
- Real-time event streaming (GA + Shopify webhooks)
- ML model training on historical churn data
- GDPR/CCPA compliance layer
- Multi-tenant RBAC

---

## 10. Demo Script (Suggested)

1. **Open Command Center**: "Here's the live state — 340 customers at HIGH+ risk, $14.2M ARR exposed"
2. **At-Risk Queue**: "Ranked by risk × value. These 120 high-value customers are priority."
3. **Click customer #1042**: Customer 360 shows all 6 systems. Conflict Highlighter: "CRM says healthy, but look at GA, Yotpo, Zendesk..."
4. **Generate Brief**: Agent pipeline runs live. Show timer: "47 seconds total."
5. **Retention Brief**: "Cited evidence. Personalized offer. 3-channel outreach. Confidence 91%."
6. **Approve**: 1-click. Campaign queued.
7. **Impact & ROI**: KPIs update live. "28% → trending toward 14%."
8. **Cost Panel**: "We did this for $0.30 per customer. All-Sonnet would be $1.05. 71% savings."
9. **Chatbot**: "Flag every area needing attention" → cross-section scan.
10. **MCP**: "Any external AI agent can invoke these capabilities via MCP tools."

**Closing line**: "The agent IS the integration layer. No ETL. No data warehouse. AI reconciles the silos in real-time."
