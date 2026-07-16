# Apex Retention Intelligence Platform — Feature List

## Prototype Scope (1-Day Build)

Features marked ✅ = in prototype scope. Features marked 🔮 = production roadmap (shown in demo as "coming next").

---

## Area 1: Command Center (Home Dashboard)

| # | Feature | Scope | Description |
|---|---------|-------|-------------|
| 1.1 | Live Churn Risk Summary | ✅ | Customer counts by risk band (CRITICAL/HIGH/MEDIUM/LOW) with trend |
| 1.2 | Portfolio KPIs | ✅ | Churn rate, redemption rate, campaign time, personalization rate, analyst hours |
| 1.3 | Signals Firing Feed | ✅ | Real-time list of threshold crossings ("GA collapse on 1,204 customers today") |
| 1.4 | Revenue-at-Risk Ticker | ✅ | Live $ estimate of ARR at risk |
| 1.5 | Pending Approval Count + SLA Timer | ✅ | Briefs awaiting sign-off with oldest wait time |
| 1.6 | System Health Strip | ✅ | Status of all 6 connectors (green/amber/red) |
| 1.7 | AI Recommendation Flag | ✅ | "Where to focus today" suggestion (§12 pattern) |

## Area 2: At-Risk Queue (Working Surface)

| # | Feature | Scope | Description |
|---|---------|-------|-------------|
| 2.1 | Risk × Value Ranked Queue | ✅ | Customers sorted by composite risk × LTV (not risk alone) |
| 2.2 | Composite Score + Top Signals Inline | ✅ | Score (0-100) + risk band + top contributing signals per row |
| 2.3 | Filters | ✅ | Risk band, loyalty tier, signal type, value tier, status |
| 2.4 | Segment View | ✅ | Group customers into segments, act in bulk |
| 2.5 | Bulk Actions | ✅ | Generate briefs for segment, assign owner, suppress |
| 2.6 | DRI Auto-Routing | 🔮 | High-value items auto-route to DRI |
| 2.7 | AI Recommendation Flag | ✅ | "Which segment to work first" suggestion |

## Area 3: Customer 360 (Deep View)

| # | Feature | Scope | Description |
|---|---------|-------|-------------|
| 3.1 | Salesforce CRM Panel | ✅ | Engagement score, last purchase, health status |
| 3.2 | Shopify Panel | ✅ | AOV trend, discount dependency, order history |
| 3.3 | Yotpo Loyalty Panel | ✅ | Points, redemptions, tier, enrollment date |
| 3.4 | Klaviyo Panel | ✅ | Emails sent, open rate, last ignored email |
| 3.5 | Zendesk Panel | ✅ | Tickets, unresolved duration, sentiment |
| 3.6 | Google Analytics Panel | ✅ | Session trend, browsing behavior, bounce rate |
| 3.7 | Composite Timeline | ✅ | All 6 systems on one chronological axis |
| 3.8 | Conflict Highlighter | ✅ | "CRM: healthy 72 ⚠ contradicts GA -60%" |
| 3.9 | Score Breakdown | ✅ | How score was computed, weight per signal |
| 3.10 | AI Recommendation Flag | ✅ | "Most decisive signal + which system to trust" |

## Area 4: Retention Brief (Agent Core Output)

| # | Feature | Scope | Description |
|---|---------|-------|-------------|
| 4.1 | Composite Score + Risk Classification | ✅ | "HIGH — 91/100" |
| 4.2 | Cited Evidence List | ✅ | Every claim tagged to source: "Sessions -60% [GA]" |
| 4.3 | Recommended Action (Signal + Tier Matched) | ✅ | Not generic 10% voucher — personalized combo |
| 4.4 | Confidence Signal | ✅ | 0-100 confidence on the recommendation |
| 4.5 | 3-Channel Outreach Drafts | ✅ | Email/SMS/Push pre-written for review |
| 4.6 | Approve / Override / Reject | ✅ | 1-click with mandatory reason on override/reject |
| 4.7 | Provenance Footer | ✅ | Which agent, when, from which data snapshot |
| 4.8 | AI Recommendation Flag | ✅ | The recommended offer IS the flag for this area |

## Area 5: Campaign & Outreach

| # | Feature | Scope | Description |
|---|---------|-------|-------------|
| 5.1 | Multi-Channel Composer | ✅ | Email/SMS/Push, pre-populated from brief, editable |
| 5.2 | Offer Selector | ✅ | Tied to catalog, matched to signal type + tier |
| 5.3 | Approval Workflow | ✅ | Value-threshold routing, SLA timer |
| 5.4 | Campaign Tracking | ✅ | Delivery, open, redemption per campaign |
| 5.5 | Write-Back to Source | 🔮 | Push offer to Yotpo, suppress Klaviyo, update CRM |
| 5.6 | A/B Test Framework | 🔮 | Agent offer vs control |
| 5.7 | Frequency Capping | ✅ | Max messages per window, suppress over-contacted |
| 5.8 | AI Recommendation Flag | ✅ | "Best channel + send time" suggestion |

## Area 6: Impact & ROI

| # | Feature | Scope | Description |
|---|---------|-------|-------------|
| 6.1 | KPI Scorecard (Before → After) | ✅ | All 10 KPIs from Slide 8/9 |
| 6.2 | Revenue Protected Attribution | ✅ | $ saved per intervention, annualized |
| 6.3 | Loyalty ROI Model | ✅ | $2.1M platform cost vs revenue protected |
| 6.4 | Cohort Comparison | ✅ | Before/after on same cohort |
| 6.5 | Trend Charts (30/60/90 day) | 🔮 | Over rollout period |
| 6.6 | **Cost Optimization Panel** | ✅ | **Model routing costs, Sonnet vs Haiku breakdown, savings %** |
| 6.7 | AI Recommendation Flag | ✅ | "Which lever is underperforming" suggestion |

## Area 7: Admin & Governance

| # | Feature | Scope | Description |
|---|---------|-------|-------------|
| 7.1 | Connector Health Dashboard | ✅ | Status, last sync, error logs per system |
| 7.2 | Scoring Engine Config | ✅ | View/edit weights, thresholds, trigger rules |
| 7.3 | Offer Catalog Management | 🔮 | Define offers, eligibility, margin guardrails |
| 7.4 | RBAC | 🔮 | User/role management, approval thresholds |
| 7.5 | Audit Trail Viewer | ✅ | Immutable log of all actions |
| 7.6 | Model Monitoring | 🔮 | Score drift, FP/FN rates, precision alerts |
| 7.7 | AI Recommendation Flag | ✅ | "Weights to retune, connectors to fix" |

## Cross-Cutting: AI Chatbot Assistant

| # | Feature | Scope | Description |
|---|---------|-------|-------------|
| C.1 | Always-On Launcher | ✅ | Docked bottom-right on all screens |
| C.2 | Context-Aware Responses | ✅ | Knows current screen + customer/segment |
| C.3 | Cross-Section Flagging | ✅ | "Flag every area needing attention" → checklist |
| C.4 | Action-Capable | ✅ | Generate brief, draft outreach, queue approval |
| C.5 | Grounded + Cited | ✅ | Answers cite source systems, never fabricates |
| C.6 | Fully Audited | 🔮 | Every chatbot action in audit trail |

## Cross-Cutting: Cost Optimization (NEW — Missing from IA doc)

| # | Feature | Scope | Description |
|---|---------|-------|-------------|
| CO.1 | Multi-Model Routing | ✅ | Sonnet for reasoning, Haiku for content |
| CO.2 | Per-Request Cost Tracking | ✅ | Token usage + estimated cost per agent call |
| CO.3 | Cost Dashboard Panel | ✅ | Total cost, by-model breakdown, savings vs baseline |
| CO.4 | Cost-Per-Customer Metric | ✅ | Average $ spent on AI per retention intervention |
| CO.5 | Threshold-Based Invocation | ✅ | No LLM for LOW risk (free scoring only) |
| CO.6 | Model Fallback | ✅ | If Sonnet fails, fall back to Haiku with flag |

---

## Feature Count Summary

| Category | Prototype (✅) | Roadmap (🔮) | Total |
|----------|---------------|-------------|-------|
| Area 1-7 Features | 42 | 10 | 52 |
| AI Chatbot | 5 | 1 | 6 |
| Cost Optimization | 6 | 0 | 6 |
| **Total** | **53** | **11** | **64** |
