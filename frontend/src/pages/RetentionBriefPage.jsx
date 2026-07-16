import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Play, Check, Edit3, X, Clock } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useStore } from "../lib/store";
import { Panel, RiskBadge, Spinner, Cite, ProgressBar } from "../components/ui.jsx";
import { fmtNum, SOURCE_LABEL, cn } from "../lib/utils";
import { PERSONAS } from "../lib/personas";

export default function RetentionBriefPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setContext, showToast } = useStore();
  const list = useApi(() => api.rankedQueue(0), []);
  const selected = id;

  const selectedName =
    (list.data?.customers || []).find((c) => c.customer_id === selected)?.name || null;

  useEffect(() => {
    setContext({
      page: "Retention Brief",
      customer_id: selected || null,
      customer_name: selectedName,
    });
  }, [selected, selectedName, setContext]);

  useEffect(() => {
    if (!selected && list.data?.customers?.length) {
      navigate(`/brief/${list.data.customers[0].customer_id}`, { replace: true });
    }
  }, [selected, list.data, navigate]);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Panel title="Select Customer" bodyClass="max-h-[calc(100vh-160px)] overflow-y-auto">
        {(list.data?.customers || []).map((c) => (
          <button
            key={c.customer_id}
            onClick={() => navigate(`/brief/${c.customer_id}`)}
            className={cn(
              "flex w-full items-center gap-2 border-b border-apex-border px-3 py-2 text-left transition hover:bg-apex-surface2",
              c.customer_id === selected && "bg-apex-surface2"
            )}
          >
            <span className="flex-1 text-[12px] font-semibold">{c.name}</span>
            <RiskBadge level={c.risk_level} showDot={false} />
          </button>
        ))}
      </Panel>
      {selected ? (
        <Brief
          id={selected}
          name={
            (list.data?.customers || []).find((c) => c.customer_id === selected)?.name ||
            "this customer"
          }
          showToast={showToast}
        />
      ) : (
        <div />
      )}
    </div>
  );
}

function Brief({ id, name, showToast }) {
  const { persona } = useStore();
  const p = PERSONAS[persona];
  const approverLabel = `${p?.name} (${p?.title})`;
  const [wf, setWf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [decision, setDecision] = useState(null);
  const [approval, setApproval] = useState(null);

  const approvalId = approval?.approval_id || null;
  // Who may approve THIS brief: escalated → DRI, else CRM.
  const requiredRole = approval?.escalated ? "dri" : "crm";
  const canApprove = approval && persona === requiredRole;

  async function load() {
    setLoading(true);
    setDecision(null);
    try {
      const res = await api.getBrief(id);
      setWf(res.available ? res : null);
      if (res.available) {
        const pend = await api.pendingApprovals();
        const match = pend.find((p) => p.workflow_result.customer_id === id);
        setApproval(match || null);
      } else {
        setApproval(null);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run() {
    setRunning(true);
    try {
      await api.runAgent(id, persona);
      showToast("Agent pipeline complete — brief generated.");
      await load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setRunning(false);
    }
  }

  async function act(kind) {
    if (!approvalId) return showToast("No pending approval for this brief.", "error");
    try {
      if (kind === "approve") {
        await api.approve(approvalId, approverLabel, persona);
        setDecision("Approved — ready to send from Campaigns.");
      } else if (kind === "override") {
        const reason = window.prompt("Override reason (required):");
        if (!reason) return;
        await api.override(approvalId, { reason, adjusted: true }, approverLabel, persona);
        setDecision(`Overridden — "${reason}". Logged to audit.`);
      } else {
        const reason = window.prompt("Reject reason (required):");
        if (!reason) return;
        await api.escalate(approvalId, reason);
        setDecision(`Escalated to DRI — "${reason}".`);
      }
      showToast("Decision logged to audit trail.");
      await load();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  if (loading) return <Spinner label="Loading brief…" />;

  if (!wf) {
    // Only the CRM Analyst generates briefs; the DRI reviews escalations.
    if (persona === "dri") {
      return (
        <div className="panel flex flex-col items-center justify-center gap-2 p-10 text-center">
          <div className="text-[13px] font-semibold">No brief awaiting your approval for {name}.</div>
          <div className="text-[12px] text-apex-muted">
            The CRM Analyst generates retention briefs. High-value ones are
            escalated here for your sign-off.
          </div>
        </div>
      );
    }
    return (
      <div className="panel flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="text-[13px] text-apex-muted">
          No brief generated for {name} yet. Run the 4-agent pipeline to produce one.
        </div>
        <button className="btn btn-primary" onClick={run} disabled={running}>
          <Play size={13} className={running ? "animate-pulse" : ""} />
          {running ? "Running agents…" : "Generate brief"}
        </button>
      </div>
    );
  }

  const b = wf.brief;
  const w = wf.workflow;
  const offer = b.recommended_offer;
  const outreach = w?.outreach || {};

  return (
    <div className="space-y-4">
      {/* Header / classification */}
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <RiskBadge level={b.risk_classification} />
            <span className="text-lg font-bold">
              {b.risk_classification} — {Math.round(b.churn_score)}/100
            </span>
          </div>
          <div className="mt-1 text-[12px] text-apex-muted">{b.customer_summary}</div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-apex-border bg-apex-surface2 px-3 py-2">
          <Clock size={13} className="text-apex-green" />
          <span className="text-[11px] text-apex-muted">Pipeline</span>
          <span className="text-[13px] font-bold text-apex-green">
            {fmtNum(w?.elapsed_seconds, 2)}s
          </span>
        </div>
      </div>

      {decision && (
        <div className="rounded-[10px] border border-apex-green/40 bg-apex-green/[0.08] px-4 py-2.5 text-[12px] font-semibold text-apex-green">
          ✓ {decision}
        </div>
      )}

      {/* Cited evidence + offer */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel title="Cited Evidence — Signal Breakdown">
          <div className="divide-y divide-apex-border/60">
            {b.signal_breakdown
              .slice()
              .sort((a, c) => c.weighted_contribution - a.weighted_contribution)
              .map((sig, i) => (
                <div key={i} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">
                      {sig.signal_name} <Cite>{SOURCE_LABEL[sig.source] || sig.source}</Cite>
                    </span>
                    <span className="text-[12px] font-bold">
                      {fmtNum(sig.weighted_contribution, 1)} pts
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar
                      value={sig.normalized_score}
                      color={sig.normalized_score > 66 ? "bg-apex-red" : sig.normalized_score > 33 ? "bg-apex-amber" : "bg-apex-green"}
                    />
                    <span className="w-24 text-right text-[10px] text-apex-muted">
                      risk {fmtNum(sig.normalized_score, 0)} · w {fmtNum(sig.weight * 100, 0)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
          <div className="border-t border-apex-border px-4 py-2.5 text-[11px] text-apex-muted">
            Historical: {b.historical_comparison}
          </div>
        </Panel>

        {/* Recommended offer */}
        <div className="space-y-4">
          <Panel title="Recommended Action">
            <div className="space-y-3 p-4">
              <div>
                <div className="label-caps">Offer</div>
                <div className="mt-0.5 text-[15px] font-bold text-apex-green">
                  {offer.value}
                </div>
                <div className="mt-1 text-[11px] text-apex-muted">{offer.description}</div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-apex-surface2 px-3 py-2">
                <span className="text-[11px] text-apex-muted">Confidence</span>
                <span className="text-[14px] font-bold text-apex-green">
                  {Math.round(offer.confidence_score)}/100
                </span>
              </div>
              <div className="text-[11px] text-apex-muted">
                <span className="tag mr-1">{offer.offer_type.replace("_", " ")}</span>
                matched to <strong>{offer.matched_signal}</strong>
              </div>
              <div className="text-[10px] text-apex-muted">{offer.tier_justification}</div>
            </div>
          </Panel>

          {/* Approve / Override / Reject — gated by role */}
          <Panel title="Human Approval">
            {approval?.escalated && (
              <div className="mx-3 mt-3 rounded-lg bg-apex-amber/10 px-3 py-2 text-[11px] font-semibold text-apex-amber">
                ⬆ High-value / CRITICAL — requires DRI sign-off.
              </div>
            )}
            {canApprove ? (
              <div className="flex flex-col gap-2 p-3">
                <button className="btn border-apex-green/60 !text-apex-green hover:bg-apex-green/10" onClick={() => act("approve")}>
                  <Check size={14} /> Approve — stage for send
                </button>
                <button className="btn border-apex-amber/60 !text-apex-amber hover:bg-apex-amber/10" onClick={() => act("override")}>
                  <Edit3 size={14} /> Override (reason required)
                </button>
                {!approval?.escalated && (
                  <button className="btn border-apex-red/60 !text-apex-red hover:bg-apex-red/10" onClick={() => act("reject")}>
                    <X size={14} /> Reject / escalate to DRI
                  </button>
                )}
                <div className="mt-1 text-[10px] text-apex-muted">
                  Approving as <strong>{approverLabel}</strong> · logged to audit.
                </div>
              </div>
            ) : (
              <div className="p-4 text-[12px] text-apex-muted">
                {approval
                  ? `This brief is awaiting ${requiredRole === "dri" ? "DRI" : "CRM Analyst"} sign-off — you can review it but not approve it from your role.`
                  : "No open approval for this brief."}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* 3-channel outreach */}
      <Panel title="3-Channel Outreach Drafts">
        <div className="grid gap-3 p-3 md:grid-cols-3">
          <Channel label="✉ Email" content={outreach.email} extra={outreach.email?.subject} extraLabel="Subject" />
          <Channel label="💬 SMS" content={outreach.sms} count={outreach.sms?.character_count} />
          <Channel label="🔔 Push" content={outreach.push} extra={outreach.push?.title} extraLabel="Title" />
        </div>
      </Panel>

      {/* Provenance footer */}
      <div className="rounded-lg border border-apex-border bg-apex-surface2 px-4 py-2.5 text-[10px] text-apex-muted">
        Provenance: generated by 4-agent pipeline (Signal Collector · Conflict Detector · Offer
        Strategist · Engagement Crafter) · workflow {w?.workflow_id} · brief {b.brief_id} ·{" "}
        {new Date(b.generated_at).toLocaleString()} ·{" "}
        {w?.degraded ? "deterministic fallback" : "Amazon Bedrock (Sonnet + Haiku)"} · logged to
        audit trail.
      </div>
    </div>
  );
}

function Channel({ label, content, count, extra, extraLabel }) {
  if (!content) return <div className="panel p-3 text-[11px] text-apex-muted">{label}: —</div>;
  return (
    <div className="panel flex flex-col gap-2 p-3">
      <div className="text-[11px] font-bold">{label}</div>
      {extra && (
        <div className="text-[11px]">
          <span className="text-apex-muted">{extraLabel}: </span>
          <span className="font-semibold">{extra}</span>
        </div>
      )}
      <div className="whitespace-pre-wrap rounded bg-apex-surface2 px-2.5 py-2 text-[11px] leading-relaxed">
        {content.body}
      </div>
      <div className="flex items-center justify-between text-[10px] text-apex-muted">
        {content.call_to_action && <span>CTA: {content.call_to_action}</span>}
        {count != null && <span>{count} chars</span>}
      </div>
    </div>
  );
}
