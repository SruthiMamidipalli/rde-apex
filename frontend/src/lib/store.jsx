import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_PERSONA } from "./personas";

// Lightweight global store: toast notifications, current page/customer context
// (so the chatbot can be context-aware), and the selected persona (CRM / DRI).
const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [toast, setToastState] = useState(null);
  const [pageContext, setPageContext] = useState({
    page: "Overview",
    customer_id: null,
  });

  // Persona persists for the session (mock login — no real auth).
  const [persona, setPersonaState] = useState(() => {
    try {
      return sessionStorage.getItem("apex_persona") || null;
    } catch {
      return null;
    }
  });

  const setPersona = useCallback((id) => {
    setPersonaState(id);
    try {
      if (id) sessionStorage.setItem("apex_persona", id);
      else sessionStorage.removeItem("apex_persona");
    } catch {
      /* ignore */
    }
  }, []);

  const showToast = useCallback((message, kind = "success") => {
    setToastState({ message, kind, id: Math.random() });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToastState(null), 3200);
  }, []);

  const setContext = useCallback((ctx) => {
    setPageContext((prev) => ({ ...prev, ...ctx }));
  }, []);

  return (
    <StoreContext.Provider
      value={{
        toast,
        showToast,
        pageContext,
        setContext,
        persona,
        setPersona,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// Toast renderer.
export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  const color =
    toast.kind === "error"
      ? "border-apex-red/30 text-apex-red"
      : "border-apex-green/30 text-apex-green";
  return (
    <div
      className={`fixed right-6 top-5 z-[999] animate-slide-in rounded-xl border bg-apex-surface px-4 py-2.5 text-xs font-semibold shadow-pop ${color}`}
    >
      {toast.message}
    </div>
  );
}
