import { createContext, useCallback, useContext, useState } from "react";

// Lightweight global store: toast notifications + current page/customer context
// so the chatbot can be context-aware.
const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [toast, setToastState] = useState(null);
  const [pageContext, setPageContext] = useState({
    page: "Command Center",
    customer_id: null,
  });

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
      value={{ toast, showToast, pageContext, setContext }}
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
      ? "border-apex-red text-apex-red"
      : "border-apex-green text-apex-green";
  return (
    <div
      className={`fixed right-6 top-5 z-[999] animate-slide-in rounded-lg border bg-apex-surface2 px-4 py-2.5 text-xs font-semibold shadow-2xl ${color}`}
    >
      {toast.message}
    </div>
  );
}
