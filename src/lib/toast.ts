"use client";

import { create } from "zustand";

/**
 * App-wide toast notifications.
 *
 * Imperative API:
 *   toast.success("Order placed");
 *   toast.error("Wallet balance is too low");
 *   toast.info("Refreshing…");
 *   toast.warn("Phone change needs an OTP");
 *
 * Each toast auto-dismisses after `duration` ms (default 4500;
 * pass `Infinity` for sticky). Returns the id so callers can
 * dismiss programmatically.
 *
 * The <Toaster /> component reads the store and renders the live
 * list — mount it once in the root layout.
 */

export type ToastKind = "success" | "error" | "info" | "warn";

export type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
};

type ToastsState = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
};

export const useToasts = create<ToastsState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }));
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

function fire(kind: ToastKind, message: string, duration = 4500): number {
  return useToasts.getState().push({ kind, message, duration });
}

export const toast = {
  success: (message: string, duration?: number) =>
    fire("success", message, duration),
  error: (message: string, duration?: number) =>
    fire("error", message, duration ?? 6000),
  info: (message: string, duration?: number) =>
    fire("info", message, duration),
  warn: (message: string, duration?: number) =>
    fire("warn", message, duration),
  dismiss: (id: number) => useToasts.getState().dismiss(id),
};
