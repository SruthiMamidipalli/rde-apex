# Apex Retention Intelligence Platform — Technical Architecture

## 1. Full System Architecture

```mermaid
flowchart TB
    %% Users
    subgraph USERS["👥 Users"]
        ANALYST["CRM Analyst"]
        DRI["DRI (Approver)"]
        EXEC["Executive"]
        ADMIN["Platform Admin"]
    end

    %% Frontend Application
    subgraph FRONTEND["🖥️ React Application (7 Areas + AI Layer)"]
        direction TB
        subgraph NAV["Navigation"]
            A1["1. Command Center"]
            A2["2. At-Risk Queue"]
            A3["3. Customer 360"]
            A4["4. Retention Brief"]
            A5["5. Campaign & Outreach"]
            A6["6. Impact & ROI"]
            A7["7. Admin & Governance"]
        end
        subgraph AI_UI["AI Layer (on every screen)"]
            REC_FLAG["🏷️ Recommendation Flags<br/>(Badge + Rec + Why + Confidence + Actions)"]
            CHATBOT["💬 AI Chatbot Assistant<br/>(docked, context-aware, action-capable)"]
        end
    end

    %% Backend API
    subgraph BACKEND["⚙️ FastAPI Backend"]
        direction TB
        API["REST API Layer"]
        
        subgraph ENGINES["Cross-Cutting Engines"]
            SCORE_ENG["Composite Score Engine<br/>(normalize → weight → blend → classify)"]
            AGENT_ORCH["Agent Orchestration<br/>(4 specialized agents)"]
            IDENTITY["Identity Resolution Service<br/>(deterministic + probabilistic matching)"]
            FEEDBACK["Feedback Orchestrator<br/>(write-back, conflict resolution, rollback)"]
            AUDIT_ENG["Audit Trail Engine<br/>(immutable, 100% coverage)"]
        end

        subgraph SERVICES["Application Services"]
            APPROVAL_SVC["Approval Service<br/>(routing, SLA, escalation, auto-approve)"]
            CAMPAIGN_SVC["Campaign Service<br/>(compose, send, track)"]
            CONSENT_SVC["Consent & Compliance<br/>(GDPR, opt-out, channel consent)"]
            FREQ_CAP["Frequency Capping<br/>(max messages, cooldown, suppression)"]
            COST_SVC["Cost Optimization Service<br/>(model routing, token tracking)"]
        end

        subgraph MCP_SVR["MCP Server (5+ tools)"]
            MCP_TOOLS["calculate_churn_score<br/>generate_retention_offer<br/>get_customer_signals<br/>generate_outreach<br/>get_at_risk_customers<br/>run_full_workflow"]
        end
    end

    %% Agent Layer
    subgraph AGENTS["🤖 Multi-Agent System (Amazon Bedrock)"]
        direction TB
        subgraph MODEL_ROUTER["🔀 Model Router (Cost Optimizer)"]
            ROUTE_DECISION["Task → Model Mapping<br/>Complex → Sonnet ($3/$15 per M)<br/>Simple → Haiku ($0.25/$1.25 per M)<br/>Scoring → No LLM (free)"]
        end

        SIGNAL_AGT["🔍 Signal Collector Agent<br/>(Haiku) — Gathers + orders queries"]
        CONFLICT_AGT["🔬 Conflict Detector Agent<br/>(Sonnet) — Finds gaps, can REJECT"]
        OFFER_AGT["💡 Offer Strategist Agent<br/>(Sonnet) — Designs intervention, can ESCALATE"]
        ENGAGE_AGT["✍️ Engagement Crafter Agent<br/>(Haiku) — Produces outreach"]
        CHATBOT_AGT["💬 Chatbot Agent<br/>(Sonnet/Haiku) — Answers, navigates, acts"]
    end

    %% Data Layer
    subgraph DATA["💾 Data Layer"]
        subgraph MOCK_SYSTEMS["6 Source Systems (Mock JSON)"]
            SYS1["Salesforce CRM"]
            SYS2["Shopify"]
            SYS3["Yotpo Loyalty"]
            SYS4["Klaviyo"]
            SYS5["Zendesk"]
            SYS6["Google Analytics"]
        end
        IDENTITY_GRAPH["Identity Graph<br/>(apex_customer_id spine)"]
        AUDIT_STORE["Audit Log"]
        COST_STORE["Cost Tracking Store"]
        OFFER_CATALOG["Offer Catalog"]
    end

    %% External
    subgraph EXTERNAL["🔌 External Consumers"]
        CLAUDE_DESKTOP["Claude Desktop (MCP)"]
        KIRO_EXT["Kiro IDE (MCP)"]
        OTHER_AGENTS["Other AI Agents (MCP)"]
    end

    %% Connections
    USERS --> FRONTEND
    FRONTEND <-->|"REST API"| BACKEND
    AGENT_ORCH --> MODEL_ROUTER
    MODEL_ROUTER --> SIGNAL_AGT & CONFLICT_AGT & OFFER_AGT & ENGAGE_AGT
    CHATBOT --> CHATBOT_AGT
    BACKEND <--> DATA
    AGENTS <-->|"Bedrock API"| BEDROCK["Amazon Bedrock<br/>(Claude Sonnet + Haiku)"]
    EXTERNAL <-->|"MCP Protocol"| MCP_SVR

    style FRONTEND fill:#1a1a2e,stroke:#4a90d9,color:#fff
    style BACKEND fill:#1a2744,stroke:#5ba3e6,color:#fff
    style AGENTS fill:#2d1b4e,stroke:#9b59b6,color:#fff
    style DATA fill:#1a3a2a,stroke:#27ae60,color:#fff
    style EXTERNAL fill:#3a1a1a,stroke:#e74c3c,color:#fff
```

---

## 2. Agent Orchestration Detail

```mermaid
flowchart TD
    %% Trigger
    TRIGGER["⚡ Signal Threshold Crossed"]
    
    %% Scoring (No LLM)
    TRIGGER --> SCORE["🧮 Composite Score Engine<br/>(Algorithmic — FREE)<br/>Normalize → Weight → Blend → Classify"]

    %% Decision Gate
    SCORE --> GATE{"Risk Level?"}
    GATE -->|"LOW (0-25)"| MONITOR["📋 Monitor Only<br/>No agents. No cost."]
    GATE -->|"MEDIUM (26-50)"| PARTIAL["Partial Pipeline<br/>(Signal + Conflict only)"]
    GATE -->|"HIGH (51-75)"| FULL["Full Pipeline"]
    GATE -->|"CRITICAL (76-100)"| FULL_ESCALATE["Full Pipeline + DRI Escalation"]

    %% Full Pipeline
    subgraph PIPELINE["Agent Pipeline (with autonomy)"]
        direction TB
        
        %% Parallel Phase 1
        PAR1["▶ PARALLEL PHASE 1"]
        PAR1 --> SC["🔍 Signal Collector (Haiku $)<br/>• Queries 6 systems<br/>• Decides query order<br/>• Flags stale data"]
        PAR1 --> PRELOAD["⏩ Pre-load: tier, history, prefs"]

        %% Phase 2
        SC --> CD["🔬 Conflict Detector (Sonnet $$$)<br/>• Cross-references signals<br/>• Identifies 3 gap types<br/>• Adjusts score if CRM misleading<br/>• CAN REJECT: 'not real churn'"]

        %% Decision after Conflict
        CD --> CD_DECISION{"Agent Decision"}
        CD_DECISION -->|"REJECT"| STOP["⛔ Stop Pipeline<br/>Log reason. No intervention."]
        CD_DECISION -->|"CONFIRM"| OS

        %% Phase 3
        OS["💡 Offer Strategist (Sonnet $$$)<br/>• Matches offer to signal type<br/>• Scales by tier<br/>• Checks margin guardrails<br/>• CAN ESCALATE: 'needs DRI call'"]
        PRELOAD --> OS

        OS --> OS_DECISION{"Agent Decision"}
        OS_DECISION -->|"ESCALATE"| ESCALATE["👔 Route to DRI<br/>(personal intervention)"]
        OS_DECISION -->|"STANDARD"| EC

        %% Phase 4
        EC["✍️ Engagement Crafter (Haiku $)<br/>• Picks channel priority<br/>• Adapts tone to risk<br/>• Drafts email + SMS + push<br/>• Can negotiate with Offer Agent"]

        %% Feedback
        EC -.->|"'Simplify for SMS?'"| OS
    end

    FULL --> PIPELINE
    FULL_ESCALATE --> PIPELINE

    %% Output
    EC --> PACKAGE["📦 Package Output:<br/>Brief + Offer + Outreach + Audit"]
    PACKAGE --> APPROVAL["👤 Human Approval Gate"]

    %% Cost annotation
    MONITOR -.- COST_FREE["Cost: $0"]
    SC -.- COST_HAIKU["Cost: ~$0.008"]
    CD -.- COST_SONNET1["Cost: ~$0.14"]
    OS -.- COST_SONNET2["Cost: ~$0.14"]
    EC -.- COST_HAIKU2["Cost: ~$0.008"]

    style PIPELINE fill:#1a1a2e,stroke:#9b59b6,color:#fff
    style STOP fill:#3a1a1a,stroke:#e74c3c,color:#fff
    style ESCALATE fill:#3a2a1a,stroke:#f39c12,color:#fff
```

---

## 3. Cost Optimization Architecture

```mermaid
flowchart LR
    subgraph SCORING_LAYER["Layer 1: Scoring (FREE — No LLM)"]
        ALL_CUST["All 2.1M Customers"]
        ALGO["Weighted Linear Algorithm<br/>6 signals × weights = score"]
        ALL_CUST --> ALGO
        ALGO --> LOW["LOW (60%): $0"]
        ALGO --> MEDIUM["MEDIUM (20%): $0"]
        ALGO --> HIGH_CRIT["HIGH + CRITICAL (20%): → Agents"]
    end

    subgraph AGENT_LAYER["Layer 2: Agents (Cost-Optimized)"]
        direction TB
        HIGH_CRIT --> ROUTER["Model Router"]
        
        subgraph SONNET_TASKS["Sonnet Tasks ($3/$15 per M tokens)"]
            T1["Conflict Detection<br/>(cross-system reasoning)"]
            T2["Offer Strategy<br/>(judgment + matching)"]
        end

        subgraph HAIKU_TASKS["Haiku Tasks ($0.25/$1.25 per M tokens)"]
            T3["Signal Collection<br/>(data retrieval + ordering)"]
            T4["Outreach Drafting<br/>(content generation)"]
            T5["Chatbot Responses<br/>(simple queries)"]
        end

        ROUTER --> SONNET_TASKS
        ROUTER --> HAIKU_TASKS
    end

    subgraph COST_SUMMARY["💰 Cost Per Customer Intervention"]
        direction TB
        C1["Signal Collector (Haiku): $0.008"]
        C2["Conflict Detector (Sonnet): $0.14"]
        C3["Offer Strategist (Sonnet): $0.14"]
        C4["Engagement Crafter (Haiku): $0.008"]
        C5["─────────────────────────"]
        C6["Total: ~$0.30 per customer"]
        C7["All-Sonnet baseline: ~$1.05"]
        C8["Savings: 71%"]
    end

    subgraph SCALE_ECONOMICS["📊 At Scale (20 segments/week)"]
        S1["~400 interventions/week"]
        S2["Agent cost: ~$120/week"]
        S3["vs. Analyst cost: 80-160 hrs/week"]
        S4["vs. All-Sonnet: ~$420/week"]
    end

    style SCORING_LAYER fill:#1a3a2a,stroke:#27ae60,color:#fff
    style AGENT_LAYER fill:#2d1b4e,stroke:#9b59b6,color:#fff
    style COST_SUMMARY fill:#3a1a1a,stroke:#e74c3c,color:#fff
    style SCALE_ECONOMICS fill:#1a2744,stroke:#4a90d9,color:#fff
```

---

## 4. UI Information Architecture

```mermaid
flowchart TB
    subgraph APP["Apex Retention Intelligence Platform"]
        direction TB
        
        subgraph TOPNAV["Top Navigation Bar"]
            NAV_HOME["Command Center"]
            NAV_QUEUE["At-Risk Queue"]
            NAV_360["Customer 360"]
            NAV_BRIEF["Retention Brief"]
            NAV_CAMPAIGN["Campaign"]
            NAV_ROI["Impact & ROI"]
            NAV_ADMIN["Admin"]
        end

        subgraph PAGE_LAYOUT["Page Layout (every page)"]
            HEADER["📊 KPI Header Strip (5 key metrics)"]
            
            subgraph MAIN_CONTENT["Main Content Area"]
                LEFT_PANEL["Left: List/Queue/Navigation"]
                CENTER["Center: Primary Content"]
                RIGHT_PANEL["Right: Detail/Preview Panel"]
            end

            subgraph AI_OVERLAY["AI Layer (always present)"]
                FLAG["🏷️ Recommendation Flags<br/>(inline, per-section)"]
                CHAT["💬 Chatbot (docked bottom-right)<br/>Context-aware, cross-section flagging"]
            end
        end
    end

    %% Flow between areas
    NAV_QUEUE -->|"Click customer"| NAV_360
    NAV_360 -->|"Generate brief"| NAV_BRIEF
    NAV_BRIEF -->|"Approve"| NAV_CAMPAIGN
    NAV_CAMPAIGN -->|"Track outcome"| NAV_ROI

    style APP fill:#0a1628,stroke:#4a90d9,color:#fff
    style TOPNAV fill:#1a2744,stroke:#5ba3e6,color:#fff
    style PAGE_LAYOUT fill:#1a1a2e,stroke:#4a90d9,color:#fff
    style AI_OVERLAY fill:#2d1b4e,stroke:#9b59b6,color:#fff
```

---

## 5. Data Model & Identity Resolution

```mermaid
flowchart LR
    subgraph SYSTEMS["6 Systems — Different IDs"]
        SF_ID["Salesforce: SF_001"]
        SHOP_ID["Shopify: shop_cust_442"]
        YOTPO_ID["Yotpo: yotpo_m_7891"]
        KLAV_ID["Klaviyo: klav_profile_xyz"]
        ZEN_ID["Zendesk: zen_req_5501"]
        GA_ID["GA: ga_client_abc123"]
    end

    subgraph IDENTITY["🔗 Identity Resolution Service"]
        DET["Deterministic Match<br/>(email, phone, customer_id)"]
        PROB["Probabilistic Match<br/>(GA cookie → login events → order confirms)"]
        GOLDEN["Golden Record:<br/>apex_customer_id = APEX_1042"]
    end

    SF_ID & SHOP_ID & YOTPO_ID & KLAV_ID & ZEN_ID --> DET
    GA_ID --> PROB
    DET & PROB --> GOLDEN

    subgraph PROFILE["Unified Customer Profile"]
        P1["Demographics + Tier"]
        P2["All 6 System Signals"]
        P3["Composite Score + History"]
        P4["Intervention History"]
        P5["Consent + Channel Prefs"]
    end

    GOLDEN --> PROFILE

    style SYSTEMS fill:#1a1a2e,stroke:#e94560,color:#fff
    style IDENTITY fill:#2d1b4e,stroke:#9b59b6,color:#fff
    style PROFILE fill:#1a3a2a,stroke:#27ae60,color:#fff
```

---

## 6. Approval & Campaign Flow

```mermaid
sequenceDiagram
    participant A as Agent Pipeline
    participant AS as Approval Service
    participant AN as CRM Analyst
    participant DR as DRI
    participant CS as Campaign Service
    participant FB as Feedback Orchestrator
    participant SYS as Source Systems

    A->>AS: Submit recommendation (brief + offer + outreach)
    
    AS->>AS: Check value threshold
    
    alt Below threshold (auto-approve eligible)
        AS->>AS: Auto-approve per policy
        AS->>CS: Fire campaign
    else Standard value
        AS->>AN: Route to CRM Analyst
        AN->>AS: Approve / Override / Reject
        alt Approved
            AS->>CS: Fire campaign
        else Override
            AN->>AS: Modified offer + reason (logged)
            AS->>CS: Fire modified campaign
        else Reject
            AN->>AS: Reason logged, customer suppressed
        end
    else High value / CRITICAL
        AS->>DR: Escalate to DRI
        DR->>AS: Approve / Override
        AS->>CS: Fire campaign
    end

    Note over AS: SLA Timer running. If exceeded → escalate or auto-approve

    CS->>CS: Check consent + frequency cap
    CS->>CS: Compose: Email + SMS + Push

    par Write-back (parallel)
        CS->>FB: Push offer to Yotpo
        CS->>FB: Suppress conflicting Klaviyo campaign
        CS->>FB: Update CRM status
    end

    FB->>SYS: Idempotent writes (keyed by intervention_id)
    
    Note over CS,SYS: Track: delivery → open → redemption → retention outcome
    
    CS->>A: Outcome data (feeds model learning)
```

---

## 7. Chatbot Architecture

```mermaid
flowchart TB
    subgraph CHATBOT_SYS["💬 AI Chatbot System"]
        LAUNCHER["Always-On Launcher<br/>(bottom-right, all screens)"]
        
        subgraph CONTEXT["Context Engine"]
            SCREEN["Current Screen Detection"]
            CUSTOMER["Current Customer/Segment"]
            ROLE["User Role + Permissions"]
        end

        subgraph CAPABILITIES["What It Can Do"]
            READ["READ (broad):<br/>Query any data within role"]
            EXPLAIN["EXPLAIN:<br/>Why is score X? What does flag mean?"]
            NAVIGATE["NAVIGATE:<br/>'Take me to...' + highlight"]
            FLAG["FLAG SECTIONS:<br/>Cross-app attention scan"]
            ACT["ACT (narrow):<br/>Generate brief, draft outreach<br/>Queue approval (through gate)"]
        end

        subgraph GUARDRAILS["Guardrails"]
            G1["RBAC enforced (can't exceed role)"]
            G2["No fabrication (grounded in data)"]
            G3["Consent + margin aware"]
            G4["Every action audited"]
            G5["All fires pass human gate"]
        end
    end

    LAUNCHER --> CONTEXT --> CAPABILITIES
    CAPABILITIES --> GUARDRAILS

    subgraph MODELS["Model Selection"]
        SIMPLE_Q["Simple questions → Haiku ($)"]
        COMPLEX_Q["Analysis/reasoning → Sonnet ($$$)"]
        ACTION_Q["Actions → Sonnet + confirmation"]
    end

    CAPABILITIES --> MODELS

    style CHATBOT_SYS fill:#1a1a2e,stroke:#4a90d9,color:#fff
    style GUARDRAILS fill:#3a1a1a,stroke:#e74c3c,color:#fff
    style MODELS fill:#2d1b4e,stroke:#9b59b6,color:#fff
```

---

## 8. Deployment Architecture (Prototype)

```mermaid
flowchart TB
    subgraph DEV["Development"]
        VM["Azure VM (Windows)<br/>via Bastion"]
        CLAUDE_CLI["Claude Code CLI<br/>(builds the app)"]
        GIT["GitHub Repo<br/>SruthiMamidipalli/rde-apex"]
    end

    subgraph RUNTIME["Runtime (on VM)"]
        subgraph BE["Backend :8000"]
            FASTAPI["FastAPI"]
            UVICORN["Uvicorn"]
        end
        subgraph FE["Frontend :5173"]
            VITE["Vite Dev Server"]
            REACT["React App"]
        end
        subgraph MCP_RT["MCP Server :stdio"]
            MCP_PY["Python MCP SDK"]
        end
    end

    subgraph CLOUD["Cloud Services"]
        BEDROCK["Amazon Bedrock<br/>us-east-1<br/>Claude Sonnet + Haiku"]
    end

    subgraph DATA_RT["Local Data"]
        JSON_FILES["6 Mock JSON files<br/>(25 customers)"]
        AUDIT_FILE["audit_log.json"]
        COST_FILE["cost_tracking.json"]
    end

    DEV --> GIT --> RUNTIME
    BE <-->|"boto3/anthropic"| CLOUD
    BE <--> DATA_RT
    FE <-->|"localhost:8000"| BE

    style DEV fill:#1a2744,stroke:#4a90d9,color:#fff
    style RUNTIME fill:#1a3a2a,stroke:#27ae60,color:#fff
    style CLOUD fill:#2d1b4e,stroke:#9b59b6,color:#fff
    style DATA_RT fill:#3a2a1a,stroke:#f39c12,color:#fff
```

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent pattern | Multi-agent with autonomy (reject/escalate/negotiate) | Truly agentic, not just a pipeline |
| Model routing | Sonnet for reasoning, Haiku for content/retrieval | 71% cost savings, demo differentiator |
| Scoring | Weighted linear, no LLM | Free for all customers, only agents for HIGH+ |
| Identity | Mock golden record (deterministic) | Production would add probabilistic GA matching |
| Write-back | Simulated in prototype | Production: idempotent, conflict-aware |
| Approval | Value-threshold routing + SLA | Prevents DRI bottleneck |
| Chatbot | Sonnet-backed, context-aware, action-capable | Unifies platform access via natural language |
| Audit | 100% coverage, immutable JSON log | Trust mechanism + compliance |
| Cost tracking | Per-request token + model logging | Enables cost dashboard panel |
