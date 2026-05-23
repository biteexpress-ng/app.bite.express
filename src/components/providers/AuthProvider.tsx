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
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuth((s) => s.hydrate);
  const signOut = useAuth((s) => s.signOut);

  useEffect(() => {
    hydrate();

    const onExpired = () => signOut();
    const onStorage = (e: StorageEvent) => {
      // Another tab signed in / out — re-hydrate to stay in sync.
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

  return <>{children}</>;
}
