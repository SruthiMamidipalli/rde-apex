import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import SignalRadarChart from "../components/SignalRadarChart.jsx";
import RetentionBriefPanel from "../components/RetentionBriefPanel.jsx";
import OutreachPreview from "../components/OutreachPreview.jsx";
import ApprovalWorkflow from "../components/ApprovalWorkflow.jsx";
import TimelineView from "../components/TimelineView.jsx";
import { Spinner, ErrorBanner, RiskBadge, TierBadge, ScoreRing } from "../components/ui.jsx";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const customer = useApi(() => api.getCustomer(id), [id]);
  const briefData = useApi(() => api.getBrief(id), [id]);
  const audit = useApi(() => api.getAudit(id), [id]);
  const [running, setRunning] = useState(false);

  const workflow = briefData.data?.workflow || null;
  const brief = briefData.data?.brief || null;

  async function runAgent() {
    setRunning(true);
    try {
      await api.runAgent(id);
      await Promise.all([briefData.refetch(), audit.refetch(), customer.refetch()]);
    } finally {
      setRunning(false);
    }
  }

  async function refreshApproval() {
    // Pull the current pending/decided approval for this customer.
    await Promise.all([briefData.refetch(), audit.refetch()]);
    const pending = await api.pendingApprovals();
    setApproval(pending.find((p) => p.workflow_result.customer_id === id) || approval);
  }

  const [approval, setApproval] = useState(null);
  // Load approval on first brief load.
  const approvalLoad = useApi(async () => {
    const pending = await api.pendingApprovals();
    const found = pending.find((p) => p.workflow_result.customer_id === id);
    setApproval(found || null);
    return found || null;
  }, [id, briefData.data]);

  if (customer.loading) {
    return (
      <div className="p-8">
        <Spinner label="Loading customer…" />
      </div>
    );
  }
  if (customer.error) {
    return (
      <div className="p-8">
        <ErrorBanner message={customer.error} onRetry={customer.refetch} />
      </div>
    );
  }

  const c = customer.data;
  const score = c.churn_score;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <button
        onClick={() => navigate("/")}
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-indigo-500"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </button>

      {/* Header */}
      <div className="card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {score && <ScoreRing score={score.composite_score} level={score.risk_level} size={80} />}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{c.name}</h1>
              <TierBadge tier={c.tier} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{c.email}</p>
            <div className="mt-2 flex items-center gap-2">
              {score && <RiskBadge level={score.risk_level} />}
              <span className="text-xs text-slate-400">
                Customer since {new Date(c.join_date).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <button className="btn-primary" onClick={runAgent} disabled={running}>
          {running ? (
            <>
              <Sparkles size={16} className="animate-pulse" /> Generating…
            </>
          ) : (
            <>
              <Play size={16} /> {workflow ? "Re-run AI workflow" : "Run AI workflow"}
            </>
          )}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: signals + timeline */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-2 text-lg font-bold">Signal Breakdown</h2>
            <p className="mb-2 text-xs text-slate-400">
              6-axis churn-risk contribution across source systems
            </p>
            <SignalRadarChart contributions={score?.signal_contributions} />
          </div>
          <TimelineView audit={audit.data} workflow={workflow} />
        </div>

        {/* Middle: brief */}
        <div className="space-y-5">
          {briefData.loading ? (
            <div className="card p-5">
              <Spinner label="Loading brief…" />
            </div>
          ) : brief ? (
            <RetentionBriefPanel brief={brief} analysis={workflow?.analysis} />
          ) : (
            <div className="card p-8 text-center">
              <Sparkles size={28} className="mx-auto mb-2 text-indigo-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No AI brief yet. Run the workflow to generate a retention brief,
                offer, and outreach.
              </p>
            </div>
          )}
        </div>

        {/* Right: outreach + approval */}
        <div className="space-y-5">
          {workflow?.outreach && <OutreachPreview outreach={workflow.outreach} />}
          {approval && <ApprovalWorkflow approval={approval} onChange={refreshApproval} />}
        </div>
      </div>
    </div>
  );
}
