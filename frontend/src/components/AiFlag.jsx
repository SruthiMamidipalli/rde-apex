import { useState } from "react";
import { cn } from "../lib/utils";

// AI Recommendation Flag — the §12 pattern present on every area.
// Orange badge, cited evidence, confidence, accept/modify/dismiss.
export default function AiFlag({
  area,
  text,
  evidence = [],
  confidence = 88,
  severity = "orange", // orange | red | yellow
  onAccept,
  acceptLabel = "✓ Accept",
  onToast,
}) {
  const [dismissed, setDismissed] = useState(false);
  const [state, setState] = useState(null); // accepted | modified

  if (dismissed) return null;

  const badge = { red: "🔴", orange: "🟠", yellow: "🟡" }[severity] || "🟠";

  return (
    <div className="flex animate-fade-in items-start gap-3 rounded-[10px] border border-apex-orange/30 bg-gradient-to-br from-apex-orange/[0.06] to-apex-accent/[0.06] px-4 py-3">
      <div className="mt-0.5 shrink-0 text-[15px]">{badge}</div>
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-apex-orange">
            AI Recommendation · {area}
          </span>
          <span className="rounded-full border border-apex-border bg-apex-surface2 px-1.5 py-0.5 text-[10px] text-apex-muted">
            Confidence {Math.round(confidence)}
          </span>
          {state && (
            <span className="rounded-full bg-apex-green/12 px-1.5 py-0.5 text-[10px] font-semibold text-apex-green">
              {state === "accepted" ? "Accepted" : "Modified"} · logged to audit
            </span>
          )}
        </div>
        <div className="text-[12.5px] leading-relaxed text-apex-text">{text}</div>
        {evidence.length > 0 && (
          <div className="mt-1.5 text-[11px] text-apex-muted">
            Evidence:{" "}
            {evidence.map((e, i) => (
              <span key={i}>
                {e}
                {i < evidence.length - 1 ? " · " : ""}
              </span>
            ))}
          </div>
        )}
        {!state && (
          <div className="mt-2.5 flex gap-1.5">
            <button
              className="rounded border border-apex-green/60 bg-transparent px-3 py-1 text-[11px] font-semibold text-apex-green transition hover:bg-apex-green/10"
              onClick={() => {
                setState("accepted");
                onAccept?.();
              }}
            >
              {acceptLabel}
            </button>
            <button
              className="rounded border border-apex-border bg-apex-surface2 px-3 py-1 text-[11px] font-semibold text-apex-text transition hover:bg-apex-surface3"
              onClick={() => {
                setState("modified");
                onToast?.("Recommendation modified — feedback logged to model monitoring.");
              }}
            >
              ✏️ Modify
            </button>
            <button
              className="rounded border border-apex-border bg-apex-surface2 px-3 py-1 text-[11px] font-semibold text-apex-muted transition hover:bg-apex-surface3"
              onClick={() => setDismissed(true)}
            >
              ✕ Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
