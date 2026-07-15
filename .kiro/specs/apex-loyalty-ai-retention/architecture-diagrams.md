# Apex Loyalty AI Retention — Architecture & Flow Diagrams

## 1. Solution Flow Diagram (End-to-End Agentic Workflow)

```mermaid
flowchart TD
    %% Signal Detection Layer
    subgraph SIGNALS["📡 Signal Detection (Mock Data Layer)"]
        GA["Google Analytics<br/>Sessions, Page Views"]
        SHOP["Shopify<br/>AOV, Discounts, Orders"]
        YOTPO["Yotpo Loyalty<br/>Points, Redemptions"]
        KLAV["Klaviyo<br/>Email/SMS Engagement"]
        ZEN["Zendesk<br/>Tickets, Sentiment"]
        CRM["Salesforce CRM<br/>Customer Health Score"]
    end

    %% Trigger
    GA -->|"Session drop > 40%"| TRIGGER
    SHOP -->|"AOV decline"| TRIGGER
    YOTPO -->|"Zero redemptions"| TRIGGER
    KLAV -->|"Open rate < 10%"| TRIGGER
    ZEN -->|"Unresolved tickets"| TRIGGER
    CRM -->|"Engagement change"| TRIGGER

    TRIGGER{"⚡ Churn Signal<br/>Trigger Detected"}

    %% Scoring Engine
    TRIGGER --> SCORE["🧮 Composite Churn<br/>Score Engine<br/>(Weighted: 0-100)"]
    SCORE --> CLASSIFY{"Risk Level<br/>Classification"}

    CLASSIFY -->|"0-25: LOW"| LOW["✅ Monitor"]
    CLASSIFY -->|"26-50: MEDIUM"| AGENT
    CLASSIFY -->|"51-75: HIGH"| AGENT
    CLASSIFY -->|"76-100: CRITICAL"| AGENT

    %% AI Agent Layer
    subgraph AGENT_LAYER["🤖 AI Agent Layer (Claude via Bedrock)"]
        AGENT["Retention Agent<br/>Orchestrator"]
        AGENT --> ANALYZE["Analyze Churn<br/>Drivers"]
        ANALYZE --> OFFER["Generate<br/>Personalized Offer"]
        OFFER --> BRIEF["Generate<br/>Retention Brief"]
        BRIEF --> OUTREACH["Draft Multi-Channel<br/>Outreach (Email/SMS/Push)"]
    end

    %% Human-in-the-Loop
    OUTREACH --> APPROVAL{"👤 Human Approval<br/>(CRM Analyst)"}
    APPROVAL -->|"Approve"| LAUNCH["🚀 Launch Campaign<br/>(< 2 minutes)"]
    APPROVAL -->|"Override & Edit"| EDIT["✏️ Modify Offer/<br/>Content"] --> LAUNCH
    APPROVAL -->|"Escalate (CRITICAL)"| DRI["👔 DRI Review"] --> LAUNCH

    %% Audit
    LAUNCH --> AUDIT["📋 Audit Trail<br/>(Full Source Citations)"]
    AGENT --> AUDIT
    SCORE --> AUDIT

    %% Dashboard
    subgraph DASHBOARD["📊 React Dashboard"]
        DASH_RISK["Risk Overview<br/>Customer Cards"]
        DASH_BRIEF["Retention Brief<br/>Detail View"]
        DASH_COMPARE["Before vs After<br/>ROI Comparison"]
        DASH_TIMELINE["Signal Timeline"]
    end

    AUDIT --> DASHBOARD
    SCORE --> DASHBOARD
    BRIEF --> DASHBOARD

    %% Styling
    style SIGNALS fill:#1a1a2e,stroke:#16213e,color:#fff
    style AGENT_LAYER fill:#0f3460,stroke:#533483,color:#fff
    style DASHBOARD fill:#1a1a2e,stroke:#e94560,color:#fff
    style TRIGGER fill:#e94560,stroke:#fff,color:#fff
    style LAUNCH fill:#00b894,stroke:#fff,color:#fff
```

---

## 2. Technical Architecture Diagram (Azure Sandbox Deployment)

```mermaid
flowchart TB
    subgraph CLIENT["🖥️ Frontend (React.js)"]
        direction TB
        UI["React Dashboard<br/>TailwindCSS + shadcn/ui"]
        UI --> CARDS["Customer Risk Cards"]
        UI --> CHARTS["Signal Radar Charts"]
        UI --> APPROVAL_UI["Approval Workflow UI"]
        UI --> COMPARE["Before/After Panel"]
    end

    subgraph AZURE["☁️ Azure Sandbox"]
        direction TB

        subgraph API["⚙️ Backend API (Python FastAPI)"]
            direction LR
            REST["REST Endpoints<br/>/api/customers<br/>/api/score<br/>/api/brief<br/>/api/approve"]
            AGENT_SVC["Agent Service<br/>(LangChain / Semantic Kernel)"]
            SCORE_SVC["Scoring Service<br/>(Weighted Algorithm)"]
        end

        subgraph AI["🧠 Amazon Bedrock"]
            GPT4["Claude 3.5 Sonnet<br/>Reasoning & Generation"]
        end

        subgraph DATA["💾 Data Layer"]
            direction LR
            MOCK["Mock Data Store<br/>(JSON / Cosmos DB)"]
            AUDIT_DB["Audit Log<br/>(JSON / Cosmos DB)"]
        end

        subgraph MCP["🔌 MCP Server (Python)"]
            direction TB
            MCP_SCORE["calculate_churn_score"]
            MCP_OFFER["generate_retention_offer"]
            MCP_SIGNALS["get_customer_signals"]
            MCP_OUTREACH["generate_outreach_content"]
            MCP_RISK["get_at_risk_customers"]
        end

        subgraph DEPLOY["🚀 Deployment"]
            APP_SVC["Azure App Service<br/>or Local Dev"]
        end
    end

    %% Connections
    CLIENT <-->|"REST API / WebSocket"| API
    AGENT_SVC <-->|"API Calls"| AI
    API <-->|"Read/Write"| DATA
    MCP <-->|"Internal Calls"| API
    API --> DEPLOY

    %% External MCP consumers
    EXT["🤖 External AI Agents<br/>(Claude, Kiro, etc.)"] <-->|"MCP Protocol"| MCP

    style CLIENT fill:#1e3a5f,stroke:#4a90d9,color:#fff
    style AZURE fill:#0a1628,stroke:#4a90d9,color:#fff
    style API fill:#1a2744,stroke:#5ba3e6,color:#fff
    style AI fill:#2d1b4e,stroke:#9b59b6,color:#fff
    style DATA fill:#1a3a2a,stroke:#27ae60,color:#fff
    style MCP fill:#3a1a1a,stroke:#e74c3c,color:#fff
    style DEPLOY fill:#1a3a3a,stroke:#1abc9c,color:#fff
```

---

## 3. Agentic Workflow Detail (Multi-Tool Agent Pattern)

```mermaid
sequenceDiagram
    participant T as Trigger (Signal Detection)
    participant O as Orchestrator Agent
    participant S as Scoring Tool
    participant A as Analysis Tool (GPT-4)
    participant G as Offer Generator (GPT-4)
    participant B as Brief Writer (GPT-4)
    participant C as Content Drafter (GPT-4)
    participant D as Dashboard
    participant H as Human (CRM Analyst)

    T->>O: Session drop detected (Customer #1042)
    O->>S: calculate_churn_score(customer_id=1042)
    S-->>O: Score: 91/100 (CRITICAL)
    
    O->>A: analyze_churn_drivers(customer_data, all_signals)
    A-->>O: Drivers: GA -60%, Zero redemptions, Unresolved ticket

    O->>G: generate_offer(drivers, tier=Gold, risk=CRITICAL)
    G-->>O: Offer: Double-points weekend + Free returns + Personal outreach

    O->>B: generate_brief(customer, score, drivers, offer)
    B-->>O: Retention Brief (cited, structured)

    O->>C: draft_outreach(brief, offer, channels=[email,sms,push])
    C-->>O: 3-channel content drafts

    O->>D: deliver(brief, offer, outreach, audit_entry)
    D->>H: Display for approval (time elapsed: 45 seconds)

    alt Approve
        H->>D: Click "Approve"
        D->>O: approved(recommendation_id)
        O-->>D: Campaign queued ✅
    else Override
        H->>D: Modify offer, then approve
        D->>O: approved(recommendation_id, modifications)
        O-->>D: Campaign queued with edits ✅
    end

    Note over T,H: Total time: Signal → Campaign Ready < 2 minutes
```

---

## 4. Team Delegation (1-Day Sprint)

```mermaid
gantt
    title 1-Day Build Plan — Apex Loyalty AI Retention Prototype
    dateFormat HH:mm
    axisFormat %H:%M

    section Setup (All)
    Azure Sandbox Setup & Repo Init          :setup, 09:00, 30m
    Mock Data Seeding                        :data, after setup, 30m

    section Backend (Sruthi + Saim + Kiro)
    FastAPI Scaffold + Scoring Engine        :backend1, after setup, 1h
    Agent Orchestration (Claude via Bedrock)   :backend2, after backend1, 2h
    MCP Server Implementation               :mcp, after backend2, 1h

    section Frontend (Sunny + Aanya)
    React Dashboard Scaffold                 :fe1, after setup, 1h
    Customer Risk Cards + Radar Chart        :fe2, after fe1, 2h
    Approval Workflow UI                     :fe3, after fe2, 1h
    Before/After Comparison Panel            :fe4, after fe3, 1h

    section Data & Integration (Vishal)
    Cosmos DB Setup (optional)               :db, after data, 1h
    API Integration Testing                  :test, after backend2, 1h

    section Demo Prep (All)
    End-to-End Testing                       :e2e, 16:00, 1h
    Demo Script & Presentation               :demo, after e2e, 1h
```

---

## 5. MCP Tool Exposure Architecture

```mermaid
flowchart LR
    subgraph MCP_SERVER["MCP Server (Python/FastAPI)"]
        direction TB
        T1["🔧 calculate_churn_score<br/>Input: customer_id<br/>Output: score, signals, risk_level"]
        T2["🔧 generate_retention_offer<br/>Input: customer_profile, signals<br/>Output: offer, confidence"]
        T3["🔧 get_customer_signals<br/>Input: customer_id<br/>Output: all 6-system signals"]
        T4["🔧 generate_outreach_content<br/>Input: profile, offer, channel<br/>Output: formatted content"]
        T5["🔧 get_at_risk_customers<br/>Input: threshold<br/>Output: customer list"]
    end

    subgraph CONSUMERS["MCP Consumers"]
        CLAUDE["Claude Desktop"]
        KIRO["Kiro IDE"]
        CUSTOM["Custom AI Agents"]
        CHAT["Chatbot Interfaces"]
    end

    CONSUMERS <-->|"stdio / SSE"| MCP_SERVER

    style MCP_SERVER fill:#2c1810,stroke:#e74c3c,color:#fff
    style CONSUMERS fill:#1a2744,stroke:#4a90d9,color:#fff
```

---

## 6. Component Interaction (Data Flow)

```mermaid
flowchart LR
    subgraph MOCK["Mock Systems (JSON)"]
        M1["salesforce.json"]
        M2["shopify.json"]
        M3["yotpo.json"]
        M4["klaviyo.json"]
        M5["zendesk.json"]
        M6["analytics.json"]
    end

    MOCK --> LOADER["Data Loader<br/>Service"]
    LOADER --> SCORE["Scoring<br/>Engine"]
    SCORE --> AGENT["Retention<br/>Agent"]
    AGENT --> AOAI["Claude via<br/>Bedrock"]
    AOAI --> AGENT
    AGENT --> OUTPUT["Output Layer"]

    subgraph OUTPUT_DETAIL["Outputs"]
        BRIEF_OUT["Retention Brief"]
        OFFER_OUT["Personalized Offer"]
        OUTREACH_OUT["3-Channel Drafts"]
        AUDIT_OUT["Audit Entry"]
    end

    OUTPUT --> OUTPUT_DETAIL
    OUTPUT_DETAIL --> DASH["React Dashboard"]
    OUTPUT_DETAIL --> MCP_OUT["MCP Tools"]

    style MOCK fill:#1a3a2a,stroke:#27ae60,color:#fff
    style OUTPUT_DETAIL fill:#3a1a1a,stroke:#e74c3c,color:#fff
```

---

## Key Design Decisions for 1-Day Build

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend Language | Python (FastAPI) | Fastest for AI/LLM integration, team familiarity |
| Frontend | React + TailwindCSS + shadcn/ui | Sunny's strength, rapid component assembly |
| AI Engine | Claude 3.5 Sonnet via Bedrock | Available via bootcamp Bedrock access, excellent structured reasoning |
| Data Store | JSON files (upgrade to Cosmos DB if time) | Zero setup time, easy to seed |
| Agent Framework | anthropic-bedrock SDK or boto3 | Native tool-calling, clean structured output |
| MCP Implementation | Python (mcp SDK) | Same language as backend, simpler deployment |
| Deployment | Azure App Service or local | Demo flexibility |
| Charts | Recharts or Chart.js | Lightweight, React-native |

## Team Allocation (Optimized for 1 Day)

| Person | Role | Focus Area |
|--------|------|------------|
| **Sruthi** | Lead + Agentic AI | Agent orchestration, MCP server, overall architecture |
| **Sunny** | Full-Stack | React dashboard, API endpoints, integration |
| **Saim** | Architect | Backend design, scoring engine, Bedrock setup |
| **Vishal** | Data | Mock data design, Cosmos DB (stretch), data seeding |
| **Aanya** | UI/UX | Dashboard design, component styling, demo visual polish |
| **Mahesh** | Support | Node.js MCP server alternative, data transformation |
| **Priyanka** | Support | Integration testing, demo script preparation |

> **Primary builders**: Sruthi (Agentic + MCP) + Sunny (Dashboard + API) + Saim (Backend Architecture)
> **Kiro/Claude**: Code generation, rapid scaffolding, debugging assistance
