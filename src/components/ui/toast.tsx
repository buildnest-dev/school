"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info" | "error";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}
interface ToastApi {
  toast: (t: { title: string; description?: string; tone?: ToastTone }) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback<ToastApi["toast"]>((t) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [
      ...cur.slice(-2),
      { id, title: t.title, description: t.description, tone: t.tone ?? "success" },
    ]);
    setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), 7000);
  }, []);
  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? XCircle : Info;
          return (
            <div
              key={t.id}
              className={cn(
                "bg-ink pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg px-4 py-3 text-white shadow-xl",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-5 flex-none",
                  t.tone === "error" ? "text-[#ff9d9d]" : "text-accent-light",
                )}
                aria-hidden="true"
              />
              <div className="text-sm">
                <p className="font-semibold">{t.title}</p>
                {t.description ? <p className="text-on-dark mt-0.5">{t.description}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used inside <ToastProvider>");
  return c;
}
