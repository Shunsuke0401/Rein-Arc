"use client";

import * as React from "react";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
};

type ToastContextValue = {
  toast: (t: Omit<ToastItem, "id">) => void;
};

const ToastCtx = React.createContext<ToastContextValue | null>(null);

export function ToastRoot({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, duration: 5000, ...t }]);
  }, []);

  const remove = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ toast: push }}>
      <ToastProvider swipeDirection="right">
        {children}
        {items.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            duration={t.duration}
            onOpenChange={(open) => !open && remove(t.id)}
          >
            <div className="grid gap-1">
              {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
              {t.description ? (
                <ToastDescription>{t.description}</ToastDescription>
              ) : null}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) {
    // Graceful no-op when used outside provider (e.g. before hydration).
    return {
      toast: (..._args: unknown[]) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("useToast called outside ToastRoot");
        }
      },
    };
  }
  return ctx;
}
