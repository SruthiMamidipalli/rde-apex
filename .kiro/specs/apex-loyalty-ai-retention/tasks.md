# Implementation Plan: Apex Loyalty AI Retention

## Overview

This plan implements an AI-powered agentic retention system prototype. The build proceeds bottom-up: data models → mock data → scoring engine → model router → AI agent → API layer → MCP server → React dashboard. Each step produces runnable, testable code that integrates with prior steps. Python 3.11+ / FastAPI for backend, React 18 + TailwindCSS + shadcn/ui for frontend, Amazon Bedrock (Claude Sonnet + Haiku) for AI.

## Tasks

- [ ] 1. Set up project structure and core data models
  - [ ] 1.1 Create backend project skeleton with FastAPI
    - Create `backend/` directory structure per design (main.py, config.py, api/, services/, models/, mcp_server/, data/, prompts/)
    - Set up `requirements.txt` with dependencies: fastapi, uvicorn, pydantic, anthropic[bedrock], mcp, hypothesis, pytest
    - Create `backend/config.py` with settings (Bedrock region, model IDs, threshold defaults, data paths)
    - Create `backend/main.py` FastAPI app entry point with CORS middleware
    - _Requirements: 13.1, 13.2, 13.4_

  - [ ] 1.2 Implement core domain models
    - Create `backend/models/domain.py` with all Pydantic models: RiskLevel, CustomerTier, all 6 source system data models (SalesforceData, ShopifyData, YotpoData, KlaviyoData, ZendeskData, GoogleAnalyticsData), CustomerSignals, ChurnScoreResult, SignalContribution, CustomerProfile, ChurnAnalysis, ChurnDriver, RetentionOffer, OutreachContent, RetentionBrief, RetentionWorkflowResult, ApprovalStatus, PendingApproval, ApprovalDecision, AuditEntry
    - Create `backend/models/api_models.py` with request/response schemas for API endpoints
    - _Requirements: 2.1, 2.3, 2.4, 4.6, 5.1, 7.4, 11.1_

  - [ ] 1.3 Create mock data and seed script
    - Create `backend/data/mock/` directory with 6 JSON files: salesforce.json, shopify.json, yotpo.json, klaviyo.json, zendesk.json, google_analytics.json
    - Create `backend/data/seed.py` script that generates 20+ customer profiles with varied risk levels across all four Risk_Level categories
    - Ensure data includes edge cases: customers missing some signals, customers at score boundaries, all four tiers represented
    - Create empty `backend/data/audit/audit_log.json`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 13.6_

- [ ] 2. Implement scoring engine and data loader
  - [ ] 2.1 Implement Data Loader Service
    - Create `backend/services/data_loader.py` with DataLoaderService class
    - Implement `get_customer()` to consolidate all 6 system records into a single CustomerProfile
    - Implement `get_all_customers()` to return all customer profiles
    - Implement `get_customer_signals()` to return raw CustomerSignals for a customer
    - Handle missing data gracefully (some customers may lack records in some systems)
    - _Requirements: 1.8, 2.6_

  - [ ] 2.2 Implement Churn Score Engine
    - Create `backend/services/scoring_engine.py` with ChurnScoreEngine class
    - Implement DEFAULT_WEIGHTS dictionary with 6 signal weights summing to 1.0
    - Implement `calculate_score()` that computes composite score 0-100 from CustomerSignals with signal attributions
    - Implement `classify_risk()` mapping score ranges to RiskLevel enum (LOW 0-25, MEDIUM 26-50, HIGH 51-75, CRITICAL 76-100)
    - Implement `normalize_weights()` to re-normalize when signals are missing
    - Ensure composite score always stays in [0, 100] range
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.3 Write property tests for scoring engine (Properties 1, 2, 3)
    - **Property 1: Composite Score Bounded Invariant** — score always in [0, 100], weights normalize to 1.0 for any subset of signals
    - **Property 2: Signal Contributions Sum to Composite Score** — sum of weighted_contributions equals composite score within tolerance
    - **Property 3: Risk Level Classification Boundaries** — correct classification for all score values
    - Create `backend/tests/properties/test_scoring_properties.py` using Hypothesis
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

- [ ] 3. Implement Model Router and AI Agent
  - [ ] 3.1 Implement Model Router
    - Create `backend/services/model_router.py` with ModelRouter class
    - Define TaskComplexity enum (HIGH, MEDIUM, LOW) and ModelTier enum (SONNET, HAIKU)
    - Implement TASK_MODEL_MAP with task-to-model assignments (analyze_churn_drivers → Sonnet, generate_outreach_email → Haiku, etc.)
    - Implement `get_model()` to return optimal model ID for a task
    - Implement `invoke()` to route requests to appropriate Bedrock model and track usage (tokens, cost)
    - Implement `_estimate_cost()` for per-request cost calculation
    - Implement `get_cost_summary()` returning total cost, by-model breakdown, all-Sonnet baseline, and savings percentage
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.6_

  - [ ] 3.2 Create AI prompt templates
    - Create `backend/prompts/analyze_drivers.txt` — system prompt for churn driver analysis (requires citations from source systems)
    - Create `backend/prompts/generate_offer.txt` — system prompt for tier-matched, signal-appropriate offer generation
    - Create `backend/prompts/generate_brief.txt` — system prompt for structured retention brief with citations and historical comparison
    - Create `backend/prompts/generate_outreach.txt` — system prompt for multi-channel outreach (email/SMS/push) with character limits and tone matching
    - _Requirements: 3.2, 3.3, 4.1, 5.1, 5.2, 6.5_

  - [ ] 3.3 Implement Retention Agent Service
    - Create `backend/services/retention_agent.py` with RetentionAgentService class
    - Implement `run_retention_workflow()` — full pipeline: score → analyze → offer → brief → outreach
    - Implement `analyze_churn_drivers()` — uses Model Router (Sonnet) to identify primary churn drivers with citations
    - Implement `generate_offer()` — uses Model Router (Sonnet) to generate tier-matched, signal-appropriate offers with confidence score
    - Implement `generate_brief()` — uses Model Router (Sonnet) to produce structured Retention Brief with all required sections
    - Implement `generate_outreach()` — uses Model Router (Haiku) to produce email, SMS, and push notification drafts
    - Implement retry logic: retry once on Bedrock errors, log failures
    - Enforce 30-second timeout on full workflow, 20-second timeout on brief generation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 14.7_

  - [ ]* 3.4 Write property tests for offer and outreach (Properties 4, 5, 6, 8, 9, 10, 11)
    - **Property 4: Signal-to-Offer Type Mapping** — dominant signal maps to correct offer type
    - **Property 5: Offer Value Monotonic with Customer Tier** — higher tier ≥ lower tier offer value
    - **Property 6: Confidence Score Bounded** — confidence always in [0, 100]
    - **Property 8: Outreach Channel Structure Validity** — exactly 3 channels (email, SMS, push), email has subject/body/CTA
    - **Property 9: SMS Character Limit** — body ≤ 160 chars
    - **Property 10: Push Notification Character Limits** — title ≤ 50 chars, body ≤ 100 chars
    - **Property 11: Outreach Content Personalization** — body contains customer name and offer details
    - Create `backend/tests/properties/test_offer_properties.py` and `backend/tests/properties/test_outreach_properties.py` using Hypothesis
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3, 6.4, 6.6**

- [ ] 4. Implement approval and audit services
  - [ ] 4.1 Implement Audit Service
    - Create `backend/services/audit_service.py` with AuditService class
    - Implement `log_recommendation()` — log agent recommendation with customer_id, timestamp, score, risk_level, sources consulted
    - Implement `log_decision()` — log human approval/override with approver, decision, modifications
    - Implement `query()` — filter audit entries by customer_id, date_range, risk_level, approver
    - Store entries in `data/audit/audit_log.json`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 4.2 Implement Approval Service
    - Create `backend/services/approval_service.py` with ApprovalService class
    - Implement `submit_for_approval()` — queue recommendation for CRM analyst review
    - Implement `approve()` — mark as approved, log decision in audit trail
    - Implement `escalate()` — auto-escalate CRITICAL risk above configurable value threshold to DRI
    - Implement `get_pending()` — return pending approvals sorted by risk level (CRITICAL first)
    - Include time-since-signal tracking on each pending item
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 4.3 Write property tests for approval and audit (Properties 12, 13, 17)
    - **Property 12: Approval Audit Entry Completeness** — approved decisions log approver, timestamp, decision type, modifications flag
    - **Property 13: CRITICAL Risk Escalation Rule** — CRITICAL + high-value → escalate; otherwise no escalation
    - **Property 17: Audit Query Filter Correctness** — returned entries match all filters, no matching entry excluded
    - Create `backend/tests/properties/test_approval_properties.py` and `backend/tests/properties/test_audit_properties.py` using Hypothesis
    - **Validates: Requirements 7.4, 7.5, 11.4**

- [ ] 5. Checkpoint - Core backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement API layer and MCP server
  - [ ] 6.1 Implement REST API endpoints
    - Create `backend/api/routes.py` with all endpoints:
      - Customer: GET /api/customers, GET /api/customers/{id}, GET /api/customers/{id}/signals, GET /api/customers/{id}/audit
      - Scoring: POST /api/score/{customer_id}, GET /api/score/at-risk?threshold=50
      - Agent: POST /api/agent/run/{customer_id}, GET /api/agent/brief/{customer_id}
      - Approval: GET /api/approvals/pending, POST /api/approvals/{id}/approve, POST /api/approvals/{id}/override, POST /api/approvals/{id}/escalate
      - Dashboard: GET /api/dashboard/metrics, GET /api/dashboard/comparison, GET /api/dashboard/cost-optimization
    - Create `backend/api/dependencies.py` with dependency injection for services
    - Ensure customers list is sorted by churn score descending
    - _Requirements: 8.1, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 12.1, 12.4, 14.5_

  - [ ] 6.2 Implement MCP Server
    - Create `backend/mcp_server/server.py` with 5 MCP tools using Python `mcp` SDK
    - Implement `calculate_churn_score` tool — accepts customer_id, returns composite score with signal breakdown
    - Implement `generate_retention_offer` tool — accepts customer_id and optional signals, returns offer with confidence
    - Implement `get_customer_signals` tool — accepts customer_id, returns all signals from 6 systems
    - Implement `generate_outreach_content` tool — accepts customer_id, offer, channel, returns formatted content
    - Implement `get_at_risk_customers` tool — accepts threshold, returns list of at-risk customers
    - Implement input validation with structured error responses for invalid parameters
    - Include input schema definitions per MCP specification
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 6.3 Write property tests for MCP and dashboard (Properties 14, 15, 16, 18)
    - **Property 14: Customer List Sorted by Churn Score** — descending order verified
    - **Property 15: Aggregate Metrics Correctness** — total_at_risk, average_score, pending_count, launched_count computed correctly
    - **Property 16: MCP Invalid Input Error Handling** — invalid params return structured error, no unhandled exceptions
    - **Property 18: Workflow Priority Ordering** — CRITICAL before HIGH before MEDIUM before LOW
    - Create `backend/tests/properties/test_dashboard_properties.py`, `backend/tests/properties/test_mcp_properties.py`, `backend/tests/properties/test_workflow_properties.py` using Hypothesis
    - **Validates: Requirements 8.1, 8.7, 10.6, 12.3**

- [ ] 7. Checkpoint - Backend fully functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement React frontend
  - [ ] 8.1 Set up React project with TailwindCSS and shadcn/ui
    - Initialize React 18 project in `frontend/` directory
    - Configure TailwindCSS and install shadcn/ui components
    - Install Recharts for charting
    - Create `frontend/src/lib/api.ts` API client wrapper pointing to FastAPI backend
    - Set up dark/light theme toggle infrastructure
    - _Requirements: 13.1, 8.6_

  - [ ] 8.2 Implement dashboard page and customer cards
    - Create `frontend/src/pages/DashboardPage.tsx` — main risk overview page
    - Create `frontend/src/components/CustomerCard.tsx` — risk-colored card (green=LOW, amber=MEDIUM, red=HIGH, dark red=CRITICAL)
    - Create `frontend/src/components/MetricsBar.tsx` — aggregate stats header (total at-risk, avg score, pending, launched)
    - Create `frontend/src/hooks/useCustomers.ts` — fetch and manage customer list
    - Create `frontend/src/hooks/useMetrics.ts` — fetch aggregate dashboard data
    - Render customers sorted by churn score descending
    - _Requirements: 8.1, 8.2, 8.7_

  - [ ] 8.3 Implement customer detail page with signal visualization
    - Create `frontend/src/pages/CustomerDetailPage.tsx` — individual customer deep-dive
    - Create `frontend/src/components/SignalRadarChart.tsx` — 6-axis radar chart showing each source system's contribution (Recharts)
    - Create `frontend/src/components/RetentionBriefPanel.tsx` — full brief display with structured sections
    - Create `frontend/src/components/OutreachPreview.tsx` — tabbed view for email/SMS/push drafts
    - Create `frontend/src/components/TimelineView.tsx` — signal → action timeline showing detection, agent action, status
    - _Requirements: 8.3, 8.4, 8.5, 12.5_

  - [ ] 8.4 Implement approval workflow and comparison panel
    - Create `frontend/src/components/ApprovalWorkflow.tsx` — approve/override/escalate buttons with single-click actions
    - Create `frontend/src/hooks/useApprovals.ts` — approval state management
    - Create `frontend/src/components/ComparisonPanel.tsx` — before vs after metrics (manual: 4-7 days vs agentic: <2min, 28% churn vs <14% target, etc.)
    - Create `frontend/src/components/CostOptimizationPanel.tsx` — model routing cost breakdown showing Sonnet vs Haiku usage, total cost, savings percentage
    - Create `frontend/src/components/ThemeToggle.tsx` — dark/light mode switch
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 14.5_

- [ ] 9. Integration wiring and workflow triggers
  - [ ] 9.1 Implement agentic workflow trigger logic
    - Add trigger logic in backend that detects churn score > threshold and auto-initiates retention workflow
    - Add trigger for Google Analytics session frequency drop > 40% over 14-day window
    - Implement priority queue processing: CRITICAL → HIGH → MEDIUM → LOW
    - Track elapsed time from signal detection to recommendation delivery
    - Wire trigger output into approval service
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 9.2 Wire all services together and test end-to-end flow
    - Connect DataLoader → ScoringEngine → RetentionAgent → ApprovalService → AuditService in `backend/api/dependencies.py`
    - Verify full workflow: trigger → score → analyze → offer → brief → outreach → approval queue
    - Ensure audit trail captures complete flow
    - Test API endpoints return correct response shapes
    - Verify cost optimization panel data flows from Model Router to dashboard endpoint
    - _Requirements: 3.4, 12.4, 14.4, 14.5_

- [ ] 10. Final checkpoint - Full system integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout the build
- Property tests validate universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- The 1-day constraint means prioritizing: scoring engine → agent → API → basic dashboard → polish
- Mock data seeding runs at startup (Requirement 13.6), no manual data entry needed
- All AI calls use Amazon Bedrock (not Azure OpenAI) with multi-model routing for cost optimization

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "4.1"] },
    { "id": 5, "tasks": ["3.4", "4.2"] },
    { "id": 6, "tasks": ["4.3", "6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "8.1"] },
    { "id": 8, "tasks": ["8.2", "8.3"] },
    { "id": 9, "tasks": ["8.4", "9.1"] },
    { "id": 10, "tasks": ["9.2"] }
  ]
}
```
