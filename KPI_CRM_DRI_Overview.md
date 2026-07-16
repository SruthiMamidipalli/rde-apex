# KPI Reference — CRM, DRI, Overview


## Worksheet: Executive Summary

| Executive Summary — by Department |  |  |  |  |  |  |
|---|---|---|---|---|---|---|
| Each department's executive summary: its 2–3 most important Analytical-View KPIs (Core) plus up to two guardrails — max 6 per department. Guardrails may sit outside the department's analytical view. |  |  |  |  |  |  |
| Role: Core = from the department's Analytical View (Yes);  Guardrail = a check on whether the win is real.   Target = case-study commitment (highlighted).   Category = solution role. |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
| Dashboard | KPI name | Role in summary | Type | Target (from deck) | Category (solution role) | Why it matters (from deck) |
| CRM Analyst — executive summary  (3 core + 2 guardrail = 5 KPIs) |  |  |  |  |  |  |
| At-Risk Queue | Composite churn score | Core | LE | Real-time | Detection | The core invention — one number no single system could produce; it drives the ranking. |
| At-Risk Queue | Total at-risk LTV | Core | B | — | Prioritisation | The 'value' half of risk x value — focuses effort on customers worth saving. |
| Retention Brief | Recommended offer + confidence | Core | LE | — | Intervention | Turns the score into an action a human can approve in one click. |
| Customer 360 | CRM-vs-composite divergence | Guardrail | G | — | Detection | This is the whole thesis — the CRM scored a churner 72/100 'healthy'. |
| Retention Brief | Every signal source-cited | Guardrail | G | 100% | Governance | Traceability is what makes the brief defensible and auditable. |
| DRI — executive summary  (3 core + 2 guardrail = 5 KPIs) |  |  |  |  |  |  |
| Impact & ROI | Annual churn rate | Core | B | < 14% | Outcome | The core outcome the business case is judged on. |
| Impact & ROI | Revenue protected / year | Core | B | > $7M | Outcome | Translates the churn win into the dollars that justify the $2.1M spend. |
| Impact & ROI | Loyalty redemption rate | Core | B | > 35% | Outcome | Proof the loyalty platform is finally changing behaviour. |
| Impact & ROI | Incrementality vs holdout | Guardrail | G | — | Governance | The honest proof that offers caused the saves, not luck — makes '$7M' real. |
| Impact & ROI | Net margin protected / year | Guardrail | G | ≥ plan | Governance | Revenue protected can rise while profit falls if saves are bought with discounts; this is the margin reality behind the top line. |


## Worksheet: CRM Analyst

| CRM Analyst — KPI dashboard  ·  Analytical View |  |  |  |  |  |  |  |  |  |
|---|---|---|---|---|---|---|---|---|---|
| Works at-risk customers day to day: the queue, the customer story, the brief.   ·   'In Analytical View? = Yes' marks this persona's focused dashboard set (8 KPIs). The rest are candidates considered. Shared Overview lives on the 'Executive Overview' sheet. |  |  |  |  |  |  |  |  |  |
| Category = the KPI's role in the Apex solution:  Detection (surface churn early) · Prioritisation (who to work) · Intervention (the offer & fast action) · Outcome (business result) · Governance (trust, audit & guardrails).   In Analytical View? — Yes = shown on this persona's dashboard (kept to single digits); No = left off. |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |
| KPI CANDIDATES  ·  CRM Analyst  —  'Yes' rows (top) are this persona's Analytical View |  |  |  |  |  |  |  |  |  |
| Dashboard | KPI name | Refresh cadence | Type | Target (from deck) | What it is | Why it matters (from deck) | Category (solution role) | In Analytical View? (Y/N) | Reason (for this persona) |
| At-Risk Queue | Composite churn score | Near-real-time | LE | Real-time | A single 0–100 risk score built from all six systems' signals. | The core invention — one number no single system could produce; it drives the ranking. | Detection | Yes | Ranks her whole queue — the one 0-100 number she works top-down every shift. |
| Customer 360 | CRM-vs-composite divergence | Near-real-time | G | — | Flag when the CRM rates a customer healthy but the composite says high-risk. | This is the whole thesis — the CRM scored a churner 72/100 'healthy'. | Detection | Yes | Her signature catch — surfaces the 'healthy 72' churners the CRM alone would miss. |
| Customer 360 | Redemption gap | Per-customer event | LE | — | How long since this customer last redeemed a loyalty reward. | Zero redemption was the single strongest churn signal in the source data. | Detection | Yes | The single strongest churn signal — first thing she checks on the customer page. |
| At-Risk Queue | Total at-risk LTV | Per-customer event | B | — | Combined lifetime value of every customer currently in the queue. | The 'value' half of risk x value — focuses effort on customers worth saving. | Prioritisation | Yes | The value half of triage — which at-risk customers are actually worth the effort. |
| At-Risk Queue | Risk-band distribution | Near-real-time | LE | — | Split of the queue across High / Medium / Low score bands. | Shows the shape of demand so triage and offers can be prioritised. | Prioritisation | Yes | Shows the shape of her queue so she batches High-band work first. |
| Retention Brief | Recommended offer + confidence | Near-real-time | LE | — | The offer the agent recommends for this customer, with a confidence level. | Turns the score into an action a human can approve in one click. | Intervention | Yes | The action she approves in one click — her core output per customer. |
| Retention Brief | Projected save probability / EV | Near-real-time | LE | $180–$420 | Expected value of the offer: save probability x LTV minus offer cost. | Ensures the recommended action is worth more than it costs. | Intervention | Yes | Her worth-it check — don't spend a $40 offer to save $20. |
| Retention Brief | Composite score breakdown | Near-real-time | LE | — | Each signal's contribution to this customer's total score. | Makes the score explainable, so the human trusts and can challenge it. | Detection | Yes | Lets her trust or challenge the score before approving; her defence when overriding. |


## Worksheet: DRI

| DRI — KPI dashboard  ·  Analytical View |  |  |  |  |  |  |  |  |  |
|---|---|---|---|---|---|---|---|---|---|
| Owns the outcome. Approves high-value briefs and watches whether churn, redemption and revenue actually move.   ·   'In Analytical View? = Yes' marks this persona's focused dashboard set (9 KPIs). The rest are candidates considered. Shared Overview lives on the 'Executive Overview' sheet. |  |  |  |  |  |  |  |  |  |
| Category = the KPI's role in the Apex solution:  Detection (surface churn early) · Prioritisation (who to work) · Intervention (the offer & fast action) · Outcome (business result) · Governance (trust, audit & guardrails).   In Analytical View? — Yes = shown on this persona's dashboard (kept to single digits); No = left off. |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |
| KPI CANDIDATES  ·  DRI  —  'Yes' rows (top) are this persona's Analytical View |  |  |  |  |  |  |  |  |  |
| Dashboard | KPI name | Refresh cadence | Type | Target (from deck) | What it is | Why it matters (from deck) | Category (solution role) | In Analytical View? (Y/N) | Reason (for this persona) |
| Impact & ROI | Annual churn rate | Monthly | B | < 14% | Share of customers lost over a year. | The core outcome the business case is judged on. | Outcome | Yes | The outcome she is personally accountable for — the whole business case rests here. |
| Impact & ROI | Revenue protected / year | Monthly | B | > $7M | Annual revenue kept by reducing churn. | Translates the churn win into the dollars that justify the $2.1M spend. | Outcome | Yes | Her ROI headline — the dollars that justify the $2.1M platform to leadership. |
| Impact & ROI | Loyalty redemption rate | Quarterly (90-day) | B | > 35% | Share of members redeeming a reward within 90 days. | Proof the loyalty platform is finally changing behaviour. | Outcome | Yes | Proof the loyalty platform she owns is finally changing behaviour. |
| Impact & ROI | Retention save rate | Quarterly (90-day) | B | — | Share of contacted at-risk customers still retained 90 days later. | The bottom-line proof the intervention actually works, not just fires fast. | Outcome | Yes | Proof the interventions she approves actually retain customers, not just fire fast. |
| Retention Brief | Recommended offer + confidence | Near-real-time | LE | — | The offer the agent recommends for this customer, with a confidence level. | Turns the score into an action a human can approve in one click. | Intervention | Yes | The high-value briefs she personally approves before any outreach fires. |
| Retention Brief | Projected save probability / EV | Near-real-time | LE | $180–$420 | Expected value of the offer: save probability x LTV minus offer cost. | Ensures the recommended action is worth more than it costs. | Intervention | Yes | Her approve/decline lens — is this save worth more than the offer costs? |
| Impact & ROI | Early-warning lead time | Quarterly (90-day) | LE | 14 days | Days of warning between first signal and confirmed churn. | The differentiator — 14 days of runway is what makes cross-system worth it. | Detection | Yes | The differentiator she defends — 14 days of runway is why cross-system was worth building. |
| Impact & ROI | Incrementality vs holdout | Quarterly (90-day) | G | — | Retention lift of a helped group vs an untreated control group. | The honest proof that offers caused the saves, not luck — makes '$7M' real. | Governance | Yes | The honest proof offers caused the saves — makes her '$7M' credible. |
| Impact & ROI | Net margin protected / year | Monthly | G | ≥ plan | Annual gross margin retained by saves, after offer, discount and servicing cost — the profit behind 'revenue protected'. | Revenue protected can rise while profit falls if saves are bought with discounts; this is the margin reality behind the top line. | Governance | Yes | Guards her revenue-protected win — is it real profit, or discounts handed out below margin? |
