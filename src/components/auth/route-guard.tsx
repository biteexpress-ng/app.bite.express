"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";

/**
 * Client-side route guard for authenticated pages.
 *
 * - Waits for auth hydration to settle (avoids redirect on first
 *   paint when localStorage hasn't been read yet).
 * - If still no token after hydration, redirects to /signin with
 *   `?next=<current path>` so we bounce back after sign-in.
 *
 * Server-side guarding would need a cookie-based session. We chose
 * localStorage for token storage (see lib/auth.ts), so the only
 * place we can read it is the browser.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/signin?next=${next}`);
    }
  }, [hydrated, token, pathname, router]);

  if (!hydrated || !token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-ink-500">
        <Loader2 size={20} className="mr-2 animate-spin" />
        Checking your session…
      </div>
    );
  }

  return <>{children}</>;
}
