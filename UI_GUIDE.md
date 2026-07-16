# Apex Retention Intelligence Platform — UI Guide

A page-by-page walkthrough of what you're looking at, what each control does,
where the numbers come from, and what every abbreviation means.

> **What this app is:** it watches **6 siloed data systems**, computes a
> **composite churn score (0–100)** for each customer, then runs an **AI agent
> pipeline** (Amazon Bedrock) to produce a retention brief, a personalised offer,
> and multi-channel outreach — all behind a **human approval** step, with a
> **100% audit trail** and **model-cost tracking**.

---

## Global vocabulary (applies everywhere)

### The 6 source systems
| Tag in UI | System | What it tells us |
|-----------|--------|------------------|
| **CRM** | Salesforce | Engagement score, health score, lifecycle stage. *The "official" health number — which the platform routinely proves wrong.* |
| **Shopify** | Shopify | Purchase recency, average order value, order counts, discount usage. |
| **Yotpo** | Yotpo Loyalty | Loyalty tier, points balance, reward redemptions. |
| **Klaviyo** | Klaviyo | Email/SMS open, click, response rates, unsubscribes. |
| **Zendesk** | Zendesk | Support tickets, unresolved count, sentiment. |
| **GA** | Google Analytics | Web session frequency, session change %, bounce rate. |

### Risk bands (composite score → label)
| Band | Score range | Colour |
|------|-------------|--------|
| **LOW** | 0–25 | green |
| **MEDIUM** (MED) | 26–50 | amber |
| **HIGH** | 51–75 | orange |
| **CRITICAL** (CRIT) | 76–100 | red |

### Common abbreviations
- **LTV** — Lifetime Value (a customer's total worth to the business, in $).
- **AOV** — Average Order Value (Shopify).
- **ARR** — Annual Recurring Revenue (the total revenue baseline of the book).
- **Risk × Value** — churn score multiplied by LTV. Ranks *who to save first*: a
  high-risk, high-value customer beats a high-risk, low-value one.
- **CSAT** — Customer Satisfaction score.
- **DRI** — Directly Responsible Individual (the human a decision escalates to).
- **CTA** — Call To Action (the button/link text in an outreach message).
- **TP / FP / FN** — True Positive / False Positive / False Negative (used in the
  scoring precision & recall formulas).
- **Composite score** — the blended 0–100 churn-risk number computed across all
  six systems (see *How the score is built* at the bottom).
- **Interaction boost** — extra risk points added when several early churn
  signals fire together (see bottom section).
- **CRM divergence** — a flag meaning Salesforce says "healthy" but the composite
  says "at risk". This is the platform's headline value: catching churn the CRM misses.

### Persistent screen furniture
- **Left sidebar** — navigation, grouped into *Operate / Execute / Analyse /
  Configure*. The **red number** next to "At-Risk Queue" is the live count of
  HIGH+CRITICAL customers. Bottom shows the logged-in user (*Sarah A., CRM Analyst* — a demo persona).
- **Top-right `● Bedrock live` chip** — green means the AI is running on Amazon
  Bedrock; amber `● Degraded mode` means no cloud credentials, so the app uses a
  deterministic fallback (still fully populated). Next to it is a live clock.
- **Connector strip** (under the header) — the 6 systems with a health dot and
  "last sync". *Klaviyo* intentionally shows a ~15-minute lag to demonstrate
  connector monitoring. "5/6 healthy" reflects that.
- **AI Recommendation flag** (orange/red bordered box, top of most pages) — an AI
  suggestion with a **confidence %**, **cited evidence** (each tagged with its
  source system), and **Accept / Modify / Dismiss** buttons. Accept performs the
  suggested action (e.g. jumps to the queue); the choice is logged.
- **Chatbot** (blue bubble, bottom-right) — see the last section.

---

## 1. Command Center  (`/` — "Live dashboard · all segments")

Your morning overview of the whole book.

- **AI flag** — highlights the current risk spike and pushes you to the queue.
- **KPI row (4 cards)** — each card shows the value, its **target**, the
  **trend vs baseline**, and the **source systems**. All figures are computed live:
  - **Annual Churn Rate** — % of customers projected to leave (target <14%).
  - **Redemption Rate** — % of loyalty members redeeming rewards (target 35%).
  - **Avg Campaign Launch** — time from signal → campaign live (target 2 min).
  - **Offer Personalisation** — % of at-risk customers with a signal-matched offer (target 85%).
- **Revenue ticker** — **Revenue at Risk** (annualised $ of HIGH+ customers),
  **Total ARR baseline**, and **Secured (interventions)** — revenue already
  protected by approved actions. On the right, the **CRIT / HIGH / MED / LOW**
  counts across the book.
- **Signals Firing Now** — a live feed of customers whose churn signals just
  crossed threshold. Each row shows the top signal, source tags, risk band, and
  score. An **interaction boost** badge appears when compounded signals apply.
  **Click any row → jumps to that customer's Customer 360.**
- **Pending Approval** (right rail) — briefs waiting for a human decision,
  CRITICAL first; "⬆ escalated to DRI" marks ones bumped to a manager. **Click →
  opens that Retention Brief.**
- **Churn Rate — 90d Trend** — area chart showing the 28% → target-14% trajectory.

---

## 2. At-Risk Queue  (`/queue` — "Ranked by risk × value")

The prioritised worklist: *who to save first, and in what order.*

- **AI flag** — names the single highest **risk × value** customer to work first.
- **3 KPI cards** — **At-Risk LTV** (total $ at stake), **Retention Save Rate**
  (% of contacted customers retained), **Predicted Inflow (30d)** (forecast of
  new customers crossing into HIGH risk).
- **"Run agents on segment" / "Run agents on all at-risk"** — triggers the
  4-agent AI pipeline on the whole at-risk segment at once, generating briefs in
  bulk. ⚠️ In Bedrock-live mode this makes real AI calls (costs tokens).
- **Filters** — risk-band pills (ALL / CRITICAL / HIGH / MEDIUM / LOW) and a
  **tier** dropdown (Platinum / Gold / Silver / Bronze). The count on the right
  updates.
- **Ranked table columns:**
  - **#** — rank order (by risk × value).
  - **Customer** — name + customer ID.
  - **Tier** — loyalty tier badge.
  - **Score** — composite churn score.
  - **Band** — risk level.
  - **LTV** — lifetime value ($).
  - **Risk × Value** — the ranking figure (score × LTV).
  - **Top Signal** — the biggest churn driver; a red **CRM divergence** badge
    appears where the CRM disagrees.
  - **Brief →** — jumps straight to that customer's Retention Brief.
  - **Clicking a row** (anywhere else) opens Customer 360.

---

## 3. Customer 360  (`/customers` — "Cross-system deep view")

Everything known about one customer, stitched across all six systems. Opens on
**Eleanor Voss** by default (the flagship CRM-divergence case).

- **Left list** — all customers with their score, colour-coded by band. Click to switch.
- **Header** — a **score ring**, name, **tier**, **risk badge**, an
  **`+N interaction boost`** chip if applicable, plus email, join date, and LTV.
  **"◈ Generate Retention Brief"** runs the pipeline for this customer.
- **Conflict Highlighter** (red banner) — appears only on CRM-divergence
  customers: *"Salesforce CRM rates this customer 72/100 healthy, but the
  cross-system composite says 85 CRITICAL."* This is the core demo moment.
- **AI flag** — names the most decisive signal and recommends generating a brief.
- **Composite Score Breakdown** (bar chart) — each system's **weighted
  contribution** to the score, sorted largest first. Caption shows the maths:
  `base + boost = composite`.
- **Cross-System Signal Radar** — the same signals as a 6-axis radar; a fuller
  shape = higher risk across more systems.
- **Six system panels** — raw values from each source (Salesforce, Shopify,
  Yotpo, Klaviyo, Zendesk, GA). **Red values flag danger thresholds** (e.g. AOV
  change < −20%, 0 orders in 30d, open rate < 15%, negative sentiment, sessions
  down > 30%). "No data" means that system isn't connected for this customer.

---

## 4. Retention Brief  (`/brief` — "Agent recommendation & approval")

Where the AI's full recommendation for one customer is reviewed and actioned.

- **Left list** — pick a customer.
- If no brief exists yet: **"Generate brief"** runs the **4-agent pipeline**.
- Once generated:
  - **Header** — risk classification + score, a one-line customer summary, and
    the **pipeline elapsed time** (how long the agents took).
  - **Cited Evidence — Signal Breakdown** — every contributing signal with its
    source citation, a **risk bar**, its **weight (`w`)**, and **points
    contributed**. Sorted by impact. Footer gives a historical comparison.
  - **Recommended Action** — the AI-generated **offer** (value + description),
    its **confidence /100**, the **offer type**, the **signal it's matched to**,
    and a **tier justification** (why this offer suits this loyalty tier).
  - **Human Approval** (the human-in-the-loop gate):
    - **Approve** — queues the campaign for send.
    - **Override** — you change the recommendation; a **reason is required** and logged.
    - **Reject / escalate to DRI** — sends it up to a human decision-maker; reason required.
  - **3-Channel Outreach Drafts** — ready-to-send **Email** (with subject), **SMS**
    (with character count), and **Push** (with title) copy, each with its CTA.
  - **Provenance footer** — which agents ran, the workflow & brief IDs, timestamp,
    whether it used real Bedrock or the deterministic fallback, and confirmation
    it's logged to the audit trail.

> **The 4 agents:** Signal Collector → Conflict Detector → Offer Strategist →
> Engagement Crafter. They're genuinely agentic — the Conflict Detector can
> *reject*, and the Offer Strategist can *escalate*.

---

## 5. Campaign & Outreach  (`/campaigns` — "Multi-channel orchestration")

Tracks the campaigns that resulted from approved briefs.

- **AI flag** — channel & send-time guidance (e.g. lead with SMS for CRITICAL,
  apply 72-hour frequency capping).
- **4 stat tiles** — **Campaigns** (total), **Live** (delivered), **Avg open
  rate**, **Pending**.
- **Campaign Tracking table** — Customer, Offer, **Channel** (e.g. "SMS → Email"),
  **Status** (Live / Escalated / Pending), **Open** rate, **Redeem** rate,
  **Confidence**. Escalated rows are the ones bumped to a human.
- **Footer note** — performance figures are *simulated* from approved
  interventions; write-back to the real source systems is flagged as a
  production-roadmap item (this is a prototype).

---

## 6. Impact & ROI  (`/impact` — "Outcome scorecard")

The business case: is the platform paying for itself?

- **AI flag** — flags the lever most behind target.
- **ROI tiles (4)** — **Platform cost**, **Revenue protected / yr**, **Net
  value** (protected − cost; red if negative), **ROI multiple** (×).
  > Note: with only the mock population secured so far, Net can read negative /
  > ROI < 1× — it climbs as more at-risk customers are secured.
- **KPI scorecard (8 cards)** — churn rate, revenue protected, redemption rate,
  save rate, **Early-Warning Lead Time** (days of warning before churn),
  **Analyst Hrs / Segment**, **Customer CSAT**, **Audit-Trail Coverage**. Each vs its target.
- **Before → After** (bar chart) — the case-study before/after for the headline
  percentage KPIs (labelled "Case Study Slides 8/9").
- **Manual vs Agentic — Speed & Effort** — old-way → new-way comparisons with the
  improvement (e.g. campaign launch "4–7 days → < 2 minutes", churn detection
  "reactive → 14 days proactive").

---

## 7. Token & Cost Analytics  (`/cost` — "Multi-model routing economics")

Proves the AI is cost-optimised by routing work to the cheapest capable model.

- **AI flag** — summarises the savings vs an all-Sonnet baseline.
- **Cost tiles (row 1)** — **Total AI cost**, **All-Sonnet baseline** (what it
  *would* cost if every call used the expensive model), **Savings ($)**, **Savings %**.
- **Cost tiles (row 2)** — **Requests** (total AI calls), **Cost / customer**,
  **Scoring cost** ($0 — scoring is pure maths, no AI), **LOW-risk agent cost**
  ($0 — low-risk customers are gated out, so they cost nothing).
- **Cost by Model** (donut) — spend split between **Sonnet 4.5** and **Haiku 4.5**.
- **Token Usage by Model** (stacked bars) — input vs output tokens per model.
- **Per-Model Detail** (table) — each model, its **role**, request count, input
  & output tokens, and cost:
  - **Sonnet 4.5** → *Conflict detection · Offer strategy* (the hard reasoning).
  - **Haiku 4.5** → *Signal collection · Outreach* (cheaper, high-volume content).

> **Why this saves money:** the harder a task is, the more expensive the model.
> Routing only the two reasoning-heavy agents to Sonnet, and everything else to
> Haiku, cuts cost meaningfully versus using Sonnet for all four.

---

## 8. Admin & Governance  (`/admin` — "Config, audit & model monitoring")

The trust, tuning and compliance layer.

- **AI flag** — suggests weight/connector tuning (e.g. lower the CRM engagement
  weight; fix Klaviyo's sync lag).
- **Model-monitoring KPIs (5)** — **Audit-Trail Coverage** (100%),
  **Override Rate** (how often humans overrule the AI), **Scoring Precision**
  (`TP ÷ (TP+FP)`), **Scoring Recall** (`TP ÷ (TP+FN)`), **False-Alarm Rate**
  (flagged-but-didn't-churn; target <15%).
- **Connector Health Dashboard** — the 6 systems with status dot, last sync, and
  uptime %.
- **Scoring Engine Config — Signal Weights** — the exact weights that build the
  composite score, as bars. Also shows the band **thresholds** and the **model
  version**. *(These are editable config in concept; here they're displayed.)*
- **Audit Trail Viewer** — immutable, 100%-coverage log of every event
  (recommendation / approval / escalation), with timestamp, customer, event type,
  detail, and how many sources were consulted.

---

## How the composite score is built (the maths behind every number)

Each system's raw data is converted to a **0–100 sub-score** (higher = more
likely to churn), then blended by weight:

| Signal | Weight | Source | Meaning |
|--------|-------:|--------|---------|
| Transaction recency & AOV decline | **25%** | Shopify | Buying less / longer ago |
| CRM engagement / health drop | **20%** | Salesforce | Low engagement & health |
| Support sentiment & unresolved tickets | **15%** | Zendesk | Unhappy / unresolved issues |
| Web session frequency decline | **15%** | GA | Visiting the site less |
| Loyalty redemption inactivity | **15%** | Yotpo | Not redeeming rewards |
| Email / SMS disengagement | **10%** | Klaviyo | Ignoring / unsubscribing |

- **Base score** = Σ (each sub-score × its weight). If a system is missing, the
  remaining weights re-normalise to still sum to 100%.
- **Interaction boost** = **+8** if 3 of these co-occur, **+12** if all 4: GA
  session-collapse, zero loyalty redemptions, an unresolved ticket, AOV erosion.
  Compounding early signals mean the true risk is higher than a plain average —
  this is what pushes the exemplar into CRITICAL.
- **Composite** = clamp(base + boost) into 0–100, then mapped to a risk band.
- **CRM divergence** fires when Salesforce health ≥ 70 ("healthy") *and*
  composite ≥ 71 (risky) — the CRM-blind-spot case.
- **Confidence** = blend of data completeness (how many of the 6 systems reported)
  and signal agreement (do the systems tell a consistent story).

---

## The Chatbot (blue bubble, every page)

- **Context-aware** — the panel header shows the current context (e.g.
  *"Context: Customer 360 · C026"*), so questions like *"why is this customer at
  risk?"* resolve to whoever you're viewing.
- **Grounded & cited** — answers pull from live scored state across the six
  systems and mark evidence with `[Audit]` / source tags.
- **Quick chips** — starter questions (top at-risk, why a customer scores high,
  oldest pending approval, AI cost this week).
- **Model routing** — simple questions go to Haiku, complex ones to Sonnet;
  each reply notes which engine answered.

---

## A quick note on the data

This is a **prototype with 26 mock customers**, not the full customer book.
Per-customer maths is exact, but headline tickers (Revenue at Risk, Total ARR)
are scaled by a fixed multiplier so the demo reads like the real ~$14M program
described in the case study. Campaign performance is simulated. In
**Bedrock-live** mode the agent pipeline and chatbot make real AI calls that cost
tokens; in **Degraded** mode everything still works via a deterministic fallback.
