"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "accent" | "success" | "danger" | "default";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  timeout?: number;
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastInput & { id: number; tone: ToastTone; leaving: boolean };

type ToastContextValue = { push: (t: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;
const LEAVE_MS = 240;

const TONE_BAR: Record<ToastTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
  default: "bg-[var(--ink-faint)]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, LEAVE_MS);
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current;
      const item: ToastItem = {
        ...input,
        id,
        tone: input.tone ?? "default",
        leaving: false,
      };
      setItems((prev) => {
        const next = [...prev, item];
        const overflow = next.filter((t) => !t.leaving).length - MAX_VISIBLE;
        if (overflow <= 0) return next;
        const oldest = next
          .filter((t) => !t.leaving && t.id !== id)
          .slice(0, overflow)
          .map((t) => t.id);
        return next.map((t) =>
          oldest.includes(t.id) ? { ...t, leaving: true } : t
        );
      });
      window.setTimeout(() => dismiss(id), input.timeout ?? 4500);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed top-[max(4.5rem,calc(3.5rem+env(safe-area-inset-top,0px)))] right-3 z-[10050] flex w-[min(92vw,22rem)] flex-col gap-2 sm:right-4"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`ak-panel-strong pointer-events-auto flex gap-3 overflow-hidden p-0 shadow-xl ${
              t.leaving
                ? "animate-[toastOut_0.24s_ease-in_both]"
                : "animate-[toastIn_0.35s_var(--ease-out-expo)_both]"
            }`}
          >
            <span className={`w-1 shrink-0 ${TONE_BAR[t.tone]}`} aria-hidden />
            <div className="min-w-0 flex-1 py-2.5 pr-2">
              <p className="theme-ink truncate text-sm font-semibold">
                {t.title}
              </p>
              {t.description ? (
                <p className="theme-ink-faint mt-0.5 line-clamp-2 text-xs break-all">
                  {t.description}
                </p>
              ) : null}
              {t.action ? (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-1.5 text-xs font-medium text-accent hover:underline"
                >
                  {t.action.label} ›
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="theme-ink-faint shrink-0 pr-2 text-xs transition-colors hover:text-accent"
              aria-label="关闭通知"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
