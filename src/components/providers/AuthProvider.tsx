"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-store";

/**
 * Hydrates the auth store from localStorage on mount, and wires the
 * `biteexpress:auth-expired` listener so the API client can force
 * a sign-out from anywhere (e.g. on 401).
 *
 * Mount once at the top of the layout tree. Renders no markup.
 */
export function AuthProvider() {
  const hydrate = useAuth((s) => s.hydrate);
  const signOut = useAuth((s) => s.signOut);

  useEffect(() => {
    hydrate();

    const onExpired = () => signOut({ expired: true });
    const onStorage = (e: StorageEvent) => {
      if (e.key === "biteexpress.auth") hydrate();
    };

    window.addEventListener("biteexpress:auth-expired", onExpired);
    window.addEventListener("biteexpress:auth", hydrate);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("biteexpress:auth-expired", onExpired);
      window.removeEventListener("biteexpress:auth", hydrate);
      window.removeEventListener("storage", onStorage);
    };
  }, [hydrate, signOut]);

  return null;
}
