import { useState } from "react";
import { Mail, MessageSquare, Bell } from "lucide-react";
import { cn } from "../lib/utils";

const TABS = [
  { key: "email", label: "Email", icon: Mail, limit: null },
  { key: "sms", label: "SMS", icon: MessageSquare, limit: 160 },
  { key: "push", label: "Push", icon: Bell, limit: 100 },
];

function CharCount({ value, limit }) {
  if (!limit) return null;
  const ok = value <= limit;
  return (
    <span
      className={cn(
        "text-xs font-semibold",
        ok ? "text-emerald-500" : "text-red-500"
      )}
    >
      {value}/{limit}
    </span>
  );
}

export default function OutreachPreview({ outreach }) {
  const [tab, setTab] = useState("email");
  if (!outreach) return null;
  const content = outreach[tab] || {};
  const active = TABS.find((t) => t.key === tab);

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-lg font-bold">Multi-Channel Outreach</h2>
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                tab === t.key
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "email" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="border-b border-slate-200 px-4 py-2 dark:border-slate-800">
            <div className="text-[11px] uppercase text-slate-400">Subject</div>
            <div className="font-semibold">{content.subject}</div>
          </div>
          <div className="whitespace-pre-wrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
            {content.body}
          </div>
          {content.call_to_action && (
            <div className="px-4 pb-4">
              <span className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
                {content.call_to_action}
              </span>
            </div>
          )}
        </div>
      )}

      {tab === "sms" && (
        <div className="mx-auto max-w-sm">
          <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
            <div className="rounded-2xl rounded-bl-sm bg-emerald-500 px-4 py-3 text-sm text-white shadow">
              {content.body}
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <CharCount value={(content.body || "").length} limit={active.limit} />
          </div>
        </div>
      )}

      {tab === "push" && (
        <div className="mx-auto max-w-sm">
          <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-md dark:border-slate-700 dark:bg-slate-800">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Bell size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold">{content.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {content.body}
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-between">
            <CharCount value={(content.title || "").length} limit={50} />
            <CharCount value={(content.body || "").length} limit={active.limit} />
          </div>
        </div>
      )}
    </div>
  );
}
