import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../lib/store";

const QUICK_CHIPS = [
  "Top 10 at-risk today",
  "Why is #C026 high?",
  "Oldest pending approval?",
  "AI cost this week?",
  "Flag every area needing attention",
];

export default function Chatbot() {
  const { pageContext } = useStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text:
        "Hi Sarah 👋 I'm the Apex AI assistant. I can see live state across all six systems — ask me anything. Everything I surface is cited and audited.",
    },
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, busy]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await api.chatbot(q, pageContext);
      setMessages((m) => [
        ...m,
        { role: "bot", text: res.reply, model: res.model },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "bot", text: `⚠ ${e.message}`, model: "error" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="AI Assistant"
        className="fixed bottom-6 right-6 z-[100] flex h-13 w-13 items-center justify-center rounded-full bg-apex-accent text-white shadow-[0_4px_20px_rgba(79,110,247,0.4)] transition hover:scale-110"
        style={{ width: 52, height: 52 }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-[90px] right-6 z-[99] flex flex-col overflow-hidden rounded-2xl border border-apex-border bg-apex-surface shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
          style={{ width: 380, height: 520 }}
        >
          <div className="flex items-center gap-2.5 border-b border-apex-border px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-apex-accent to-apex-accent2 text-sm">
              ⬡
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-bold">Apex AI Assistant</div>
              <div className="text-[10px] text-apex-muted">
                Context: {pageContext.page}
                {pageContext.customer_id ? ` · ${pageContext.customer_id}` : ""}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-apex-muted hover:text-apex-text"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-[10px] bg-apex-accent px-3 py-2 text-[12px] text-white"
                      : "max-w-[85%] whitespace-pre-wrap rounded-[10px] border border-apex-border bg-apex-surface2 px-3 py-2 text-[12px] text-apex-text"
                  }
                >
                  {m.text}
                  {m.role === "bot" && m.model && m.model !== "error" && (
                    <div className="mt-1 text-[9px] text-apex-muted">
                      via {m.model === "deterministic" ? "grounded engine" : m.model}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-[10px] border border-apex-border bg-apex-surface2 px-3 py-2 text-[12px] text-apex-muted">
                  <span className="animate-pulse2">Checking six systems…</span>
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
              {QUICK_CHIPS.map((c) => (
                <button key={c} className="chip" onClick={() => send(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 border-t border-apex-border p-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask anything about retention…"
              className="flex-1 rounded-lg border border-apex-border bg-apex-surface2 px-3 py-2 text-[12px] text-apex-text outline-none focus:border-apex-accent"
            />
            <button
              onClick={() => send()}
              disabled={busy}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-apex-accent text-white transition hover:opacity-85 disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
