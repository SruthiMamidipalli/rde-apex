import { FileText, Target, History, Sparkles, Quote } from "lucide-react";
import { RiskBadge } from "./ui.jsx";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="border-t border-slate-200 py-4 first:border-t-0 first:pt-0 dark:border-slate-800">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <Icon size={15} className="text-indigo-500" />
        {title}
      </div>
      {children}
    </div>
  );
}

export default function RetentionBriefPanel({ brief, analysis }) {
  if (!brief) return null;
  const offer = brief.recommended_offer;
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-indigo-500" />
          <h2 className="text-lg font-bold">Retention Brief</h2>
        </div>
        <RiskBadge level={brief.risk_classification} />
      </div>

      <Section icon={FileText} title="Customer Summary">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {brief.customer_summary}
        </p>
      </Section>

      {analysis?.drivers?.length > 0 && (
        <Section icon={Quote} title="Churn Drivers (cited)">
          <ul className="space-y-2">
            {analysis.drivers.map((d, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm dark:border-slate-800 dark:bg-slate-800/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{d.driver}</span>
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {d.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {d.evidence}{" "}
                  <span className="font-semibold text-indigo-500">[{d.source_system}]</span>
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={History} title="Historical Comparison">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {brief.historical_comparison}
        </p>
      </Section>

      <Section icon={Target} title="Recommended Offer">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-bold uppercase text-white">
              {offer.offer_type.replace("_", " ")}
            </span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
              {Math.round(offer.confidence_score)}% confidence
            </span>
          </div>
          <div className="mt-2 text-base font-bold text-slate-800 dark:text-slate-100">
            {offer.value}
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {offer.description}
          </p>
          <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
            {offer.tier_justification}
          </p>
        </div>
      </Section>

      <Section icon={Sparkles} title="Outreach Strategy">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {brief.outreach_strategy}
        </p>
      </Section>
    </div>
  );
}
