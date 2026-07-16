# Apex Retention Platform — End-to-End Flow (Developer Guide)

How a click in the React UI travels to the FastAPI backend and back. Every
mapping below is taken from the actual source (`frontend/src/lib/api.js`,
`backend/api/routes.py`, `backend/services/*`), not idealised.

---

## 1. The big picture (layers)

```mermaid
flowchart TB
    subgraph Browser["🖥️  Browser — React 18 (Vite :5173)"]
        Pages["Pages<br/>(CommandCenter, AtRiskQueue, Customer360,<br/>RetentionBrief, Campaigns, ImpactRoi,<br/>CostAnalytics, AdminGovernance)"]
        Comps["Shared components<br/>(AiFlag, Chatbot, KpiCard, HealthStrip…)"]
        Hook["useApi() hook<br/>(loading / error / refetch)"]
        Client["api.js<br/>fetch wrapper → /api/*"]
        Pages --> Hook --> Client
        Comps --> Client
    end

    Proxy["Vite dev proxy<br/>/api → http://localhost:8000"]

    subgraph Backend["⚙️  FastAPI (uvicorn :8000)"]
        Routes["api/routes.py<br/>APIRouter(prefix='/api')<br/>29 endpoints"]
        Orch["services/orchestrator.py<br/>Orchestrator (singleton)<br/>= composition root + in-memory state"]
        subgraph Services["services/"]
            DL["DataLoader"]
            Score["ChurnScoreEngine"]
            Agent["RetentionAgentService<br/>(4-agent pipeline)"]
            Router["ModelRouter<br/>(Sonnet/Haiku + cost log)"]
            Appr["ApprovalService"]
            Audit["AuditService"]
            Kpi["KpiService"]
            Chat["ChatbotService"]
        end
        Routes --> Orch --> Services
    end

    Bedrock["☁️  Amazon Bedrock<br/>Claude Sonnet 4.5 + Haiku 4.5"]
    Mock[("📄 Mock JSON<br/>6 systems, 26 customers<br/>backend/data/mock/*")]
    AuditLog[("📄 audit_log.json")]

    Client -->|HTTP JSON| Proxy --> Routes
    DL --> Mock
    Router -.->|full mode only| Bedrock
    Audit --> AuditLog

    style Browser fill:#1c2030,stroke:#4f6ef7,color:#e8eaf0
    style Backend fill:#151824,stroke:#6ee7b7,color:#e8eaf0
    style Bedrock fill:#2a2030,stroke:#fb923c,color:#e8eaf0
```

**Key facts**
- The frontend never talks to Bedrock or the mock data directly — only to `/api/*`.
- In production build there's no Vite proxy; set `VITE_API_BASE` to the backend origin. In dev, `vite.config.js` proxies `/api → :8000`.
- The **Orchestrator is a singleton** (`get_orchestrator()`). All state — scores, workflows, approvals, audit, model-usage — lives in memory inside it, shared by both the REST API and the MCP server.

---

## 2. How one request flows (generic lifecycle)

```mermaid
sequenceDiagram
    participant C as Component (.jsx)
    participant H as useApi() hook
    participant A as api.js (fetch)
    participant R as routes.py
    participant O as Orchestrator
    participant S as Service(s)

    C->>H: useApi(() => api.something(), [])
    H->>A: api.something()
    A->>R: fetch GET/POST /api/...
    R->>O: get_orchestrator()
    O->>S: delegate (score / run / approve …)
    S-->>O: domain object (Pydantic)
    O-->>R: result
    R-->>A: JSON (auto-serialised)
    A-->>H: parsed object (throws Error on !ok)
    H-->>C: { data, loading, error, refetch }
```

- **`api.js`** builds every URL as `` `${BASE}/api${path}` ``, sets JSON headers, and on a non-2xx response throws `Error("<status>: <detail>")` (it reads FastAPI's `detail`).
- **`useApi(fn, deps)`** wraps that in `{ data, loading, error, refetch }`. Read-only pages call it at mount; action buttons call `api.*` imperatively and then `refetch()`.
- **`routes.py`** functions are thin — they call `get_orchestrator()` and delegate. Business logic lives in services.

---

## 3. Full endpoint map (what calls what)

Every `api.js` method → route → orchestrator/service. `[POST]` marked; rest are GET.

| `api.js` method | HTTP route | Orchestrator / service call |
|---|---|---|
| `health()` | `/api/health` | `orch.degraded` |
| `listCustomers()` | `/api/customers` | `score_all()` → `data_loader.get_all_customers()` → `_summary()` |
| `getCustomer(id)` | `/api/customers/{id}` | `data_loader.get_customer()` + `get_score()` |
| `getSignals(id)` | `/api/customers/{id}/signals` | `data_loader.get_customer_signals()` |
| `getAudit(id)` | `/api/customers/{id}/audit` | `audit.get_customer_history()` |
| `score(id)` `[POST]` | `/api/score/{id}` | `scoring.calculate_score()` via `orch.score_customer()` |
| `atRisk(t)` | `/api/score/at-risk?threshold=` | `score_all()` + filter |
| `rankedQueue(t)` | `/api/queue/ranked?threshold=` | `score_all()` + sort by `value_rank` (risk×value) |
| `runAgent(id)` `[POST]` | `/api/agent/run/{id}` | `run_workflow()` → `agent.run_retention_workflow()` → `approvals.submit_for_approval()` |
| `runAll(t)` `[POST]` | `/api/agent/run-all?threshold=` | `run_triggered_workflows()` (priority order) |
| `getBrief(id)` | `/api/agent/brief/{id}` | `get_workflow()` (returns `available:false` if none) |
| `pendingApprovals()` | `/api/approvals/pending` | `approvals.get_pending()` |
| `approve(aid)` `[POST]` | `/api/approvals/{aid}/approve` | `approvals.approve()` → `audit` |
| `override(aid,mods)` `[POST]` | `/api/approvals/{aid}/override` | `approvals.override()` → `audit` |
| `escalate(aid,reason)` `[POST]` | `/api/approvals/{aid}/escalate` | `approvals.escalate()` → `audit` |
| `metrics()` | `/api/dashboard/metrics` | `orch.metrics()` |
| `comparison()` | `/api/dashboard/comparison` | static manual-vs-agentic list |
| `costOptimization()` | `/api/dashboard/cost-optimization` | `router.get_cost_summary()` |
| `signalsFeed()` | `/api/dashboard/signals-feed` | `orch.signals_feed()` |
| `systemHealth()` | `/api/dashboard/system-health` | `orch.system_health()` |
| `kpiCommandCenter()` | `/api/kpi/command-center` | `kpi.command_center()` |
| `kpiAtRiskQueue()` | `/api/kpi/at-risk-queue` | `kpi.at_risk_queue()` |
| `kpiImpactRoi()` | `/api/kpi/impact-roi` | `kpi.impact_roi()` |
| `kpiAdmin()` | `/api/kpi/admin` | `kpi.admin()` |
| `costPerCustomer()` | `/api/kpi/cost-per-customer` | `kpi.cost_per_customer()` |
| `campaigns()` | `/api/campaigns` | derived from `approvals.all()` + simulated perf |
| `adminConfig()` | `/api/admin/config` | `scoring.weights / SIGNAL_SOURCE / SIGNAL_LABEL` |
| `adminAudit(limit)` | `/api/admin/audit?limit=` | `audit.all_entries()` (sorted desc) |
| `chatbot(msg,ctx)` `[POST]` | `/api/chatbot` | `chatbot.answer(message, context)` |

---

## 4. Per-page wiring (what each screen fetches)

Each page sets its chatbot context via `setContext({page, customer_id})` on mount,
then fires these calls:

| Page | On load it calls | On user action |
|---|---|---|
| **CommandCenter** | `kpiCommandCenter()`, `signalsFeed()`, `pendingApprovals()` | click signal → nav to Customer360; click approval → nav to Brief |
| **AtRiskQueue** | `rankedQueue(0)`, `kpiAtRiskQueue()` | "Run agents" → `runAll(50)` then refetch; row → Customer360; "Brief →" → Brief |
| **Customer360** | `rankedQueue(0)` (list), then per-customer `getCustomer(id)` + `score(id)` | select customer → re-fetch; "Generate Brief" → nav to Brief |
| **RetentionBrief** | `rankedQueue(0)` (list), `getBrief(id)` | "Generate brief" → `runAgent(id)`; Approve/Override/Reject → `approve`/`override`/`escalate` |
| **Campaigns** | `campaigns()` | — (read-only tracking) |
| **ImpactRoi** | `kpiImpactRoi()`, `comparison()` | — |
| **CostAnalytics** | `costOptimization()`, `costPerCustomer()` | — |
| **AdminGovernance** | `kpiAdmin()`, `adminConfig()`, `adminAudit(60)`, `systemHealth()` | — |
| **Layout** (always) | `metrics()` (at-risk badge), `health()` (Bedrock chip) | — |
| **HealthStrip** (always) | `systemHealth()` | — |
| **Chatbot** (always) | — | send → `chatbot(msg, pageContext)` |

---

## 5. The two "deep" flows worth understanding

### 5a. Generate a Retention Brief (the 4-agent pipeline)

Triggered by **RetentionBrief → "Generate brief"** (`runAgent(id)`) or
**AtRiskQueue → "Run agents"** (`runAll` loops this per customer).

```mermaid
sequenceDiagram
    participant UI as RetentionBrief.jsx
    participant API as POST /api/agent/run/{id}
    participant O as Orchestrator.run_workflow
    participant AG as RetentionAgentService
    participant MR as ModelRouter
    participant BR as Bedrock
    participant AP as ApprovalService
    participant AU as AuditService

    UI->>API: runAgent(id)
    API->>O: run_workflow(id, submit=true)
    O->>O: get_score(id)  (ChurnScoreEngine)
    O->>AG: run_retention_workflow(profile, score)

    Note over AG,MR: 4 sequential agent steps
    AG->>MR: 1. analyze_churn_drivers  → SONNET
    MR->>BR: messages.create(Sonnet 4.5)
    AG->>MR: 2. generate_offer         → SONNET
    AG->>MR: 3. generate_brief         → SONNET
    AG->>MR: 4. generate_outreach      → HAIKU
    MR-->>AG: text + token usage (logged for cost panel)
    Note over AG: each step: on failure/no creds → deterministic fallback

    AG-->>O: RetentionWorkflowResult (analysis, offer, brief, outreach)
    O->>AP: submit_for_approval(result)
    AP->>AU: log recommendation (100% audit)
    O-->>API: workflow result
    API-->>UI: brief + offer + 3-channel outreach
    UI->>UI: then fetch pendingApprovals() to get approval_id
```

Key details from the code:
- **Model routing** (`ModelRouter.TASK_MODEL_MAP`): `analyze_churn_drivers`,
  `generate_offer`, `generate_brief` → **Sonnet 4.5**; `generate_outreach` → **Haiku 4.5**.
- **Resilience**: every step goes through `_invoke_with_retry` (1 retry). On no
  creds → `record_simulated_usage()` (so the cost panel still populates) and
  returns `None`; caller then uses a **deterministic fallback** that satisfies the
  same correctness properties (tier-monotonic offers, SMS ≤160 chars, personalised).
- **Cost tracking**: every real or simulated call appends to `router.usage_log`;
  `get_cost_summary()` computes total vs an all-Sonnet baseline → the Cost page.

### 5b. Approve / Override / Escalate (human-in-the-loop)

Triggered by **RetentionBrief → Human Approval** buttons.

```mermaid
sequenceDiagram
    participant UI as RetentionBrief.jsx
    participant API as POST /api/approvals/{aid}/*
    participant AP as ApprovalService
    participant AU as AuditService

    UI->>API: approve / override(reason) / escalate(reason)
    API->>AP: approvals.approve|override|escalate(...)
    AP->>AU: append immutable audit entry
    AP-->>API: updated approval
    API-->>UI: 200 → toast "logged to audit trail"
    Note over UI: Campaigns page later derives a campaign<br/>from any approved/overridden approval
```

The `approval_id` is not returned by `runAgent`; the UI fetches
`pendingApprovals()` and matches on `customer_id` to find it (see
`RetentionBrief.jsx` `load()`).

---

## 6. Backend composition root (who owns whom)

```mermaid
flowchart LR
    O["Orchestrator (singleton)"]
    O --> DL["DataLoader<br/>reads mock JSON"]
    O --> SC["ChurnScoreEngine<br/>weighted composite + boost"]
    O --> MR["ModelRouter<br/>+ Bedrock client (or None)"]
    O --> AG["RetentionAgentService"]
    O --> AP["ApprovalService"]
    O --> AU["AuditService"]
    O --> KP["KpiService"]
    O --> CH["ChatbotService"]

    AG --> MR
    AG --> SC
    AP --> AU
    KP --> O
    CH --> O
    CH --> KP
    MR -.->|full mode| B["Bedrock"]

    O -. also used by .-> MCP["mcp_server/server.py<br/>(5 tools, same state)"]
```

- `Orchestrator.__init__` builds the Bedrock client once (`_build_bedrock_client`);
  if creds are absent it's `None` → `orch.degraded == True` → the `● Degraded mode` chip.
- `KpiService` and `ChatbotService` hold a back-reference to the orchestrator to
  read live scored state (that's why they're constructed lazily — to avoid an import cycle).
- The **MCP server** imports the same `get_orchestrator()`, so tools and the REST
  API share one in-memory world.

---

## 7. Mental model in one paragraph

The browser renders pages; each page (via the `useApi` hook or an action handler)
calls a method on the `api` object; that method `fetch`es `/api/...`; Vite proxies
it to FastAPI; the route grabs the **singleton Orchestrator** and delegates to a
service; scoring is pure math over mock JSON, the agent pipeline optionally calls
**Bedrock** (Sonnet for reasoning, Haiku for content, with deterministic
fallback), approvals and every recommendation write to an **immutable audit log**,
and KPI/cost/chatbot services read back the live in-memory state. JSON returns up
the same chain and React re-renders. No database — all state lives in the
Orchestrator for the life of the process.
