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

  const dot = { red: "bg-apex-red", orange: "bg-apex-amber", yellow: "bg-apex-yellow" }[severity] || "bg-apex-amber";

  return (
    <div className="flex animate-fade-in items-start gap-3 rounded-2xl border border-apex-border bg-apex-surface p-5 shadow-card">
      <div className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
      <div className="flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-apex-accent">
            AI Recommendation · {area}
          </span>
          <span className="rounded-full bg-apex-surface2 px-2 py-0.5 text-[10px] font-medium text-apex-muted">
            {Math.round(confidence)}% confidence
          </span>
          {state && (
            <span className="rounded-full bg-apex-green/10 px-2 py-0.5 text-[10px] font-semibold text-apex-green">
              {state === "accepted" ? "Accepted" : "Modified"} · logged to audit
            </span>
          )}
        </div>
        <div className="text-[13.5px] leading-relaxed text-apex-text">{text}</div>
        {evidence.length > 0 && (
          <div className="mt-2 text-[11.5px] text-apex-muted">
            Based on:{" "}
            {evidence.map((e, i) => (
              <span key={i}>
                {e}
                {i < evidence.length - 1 ? " · " : ""}
              </span>
            ))}
          </div>
        )}
        {!state && (
          <div className="mt-3 flex gap-2">
            <button
              className="rounded-full bg-apex-ink px-4 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
              onClick={() => {
                setState("accepted");
                onAccept?.();
              }}
            >
              {acceptLabel}
            </button>
            <button
              className="rounded-full border border-apex-border px-4 py-1.5 text-[12px] font-semibold text-apex-text transition hover:bg-apex-surface2"
              onClick={() => {
                setState("modified");
                onToast?.("Recommendation modified — feedback logged to model monitoring.");
              }}
            >
              Modify
            </button>
            <button
              className="rounded-full border border-apex-border px-4 py-1.5 text-[12px] font-semibold text-apex-muted transition hover:bg-apex-surface2"
              onClick={() => setDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
