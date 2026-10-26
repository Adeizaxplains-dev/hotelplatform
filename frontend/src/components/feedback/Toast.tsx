import { CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

interface ToastItem { id: number; message: string }
const ToastContext = createContext<(message: string) => void>(() => undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

/** Short confirmation messages. Announced politely to screen readers; each disappears on its own. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((message: string) => {
    const id = next.current++;
    setItems((l) => [...l, { id, message }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex items-center gap-3 rounded-lg bg-ink px-4 py-3 text-white shadow-lg">
            <CheckCircle2 className="size-5 text-brass-500" aria-hidden="true" /><span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="ml-2 text-white/70 hover:text-white"><X className="size-4" aria-hidden="true" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
