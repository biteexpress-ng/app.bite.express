"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-store";
import { usePush } from "@/lib/push";

/** Reads push state once a customer is signed in. Renders nothing. */
export function PushBootstrap() {
  const token = useAuth((s) => s.token);
  const refresh = usePush((s) => s.refresh);

  useEffect(() => {
    if (token) void refresh();
  }, [token, refresh]);

  return null;
}
