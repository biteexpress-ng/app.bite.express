"use client";

import { create } from "zustand";
import { clearAuth, readAuth, writeAuth, type AuthUser } from "./auth";
import { dropPushOnSignOut } from "./push";

/**
 * Auth store — single source of truth for the React tree.
 *
 * - Hydrates from localStorage on first read (SSR-safe: initial state
 *   is empty until hydrate() is called from the AuthProvider effect).
 * - Persists every change back through lib/auth helpers so other
 *   tabs / hooks see the same snapshot.
 * - Listens for the `biteexpress:auth-expired` window event the
 *   api-client dispatches on 401 — clears the session automatically.
 */

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;

  hydrate: () => void;
  signIn: (token: string, user: AuthUser) => void;
  signOut: (opts?: { expired?: boolean }) => void;
  setUser: (user: AuthUser) => void;
};

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const snapshot = readAuth();
    set({ ...snapshot, hydrated: true });
  },

  signIn: (token, user) => {
    writeAuth({ token, user });
    set({ token, user, hydrated: true });
  },

  signOut: (opts) => {
    // Capture the token before clearing it: the server unsubscribe needs it.
    // An expired token would only 401, so skip the server call then.
    const token = opts?.expired ? null : get().token;
    void dropPushOnSignOut(token);
    clearAuth();
    set({ token: null, user: null, hydrated: true });
  },

  setUser: (user) => {
    writeAuth({ token: get().token, user });
    set({ user });
  },
}));

/** Convenience selector — true if a token is present. */
export const useIsAuthenticated = () => useAuth((s) => !!s.token);
