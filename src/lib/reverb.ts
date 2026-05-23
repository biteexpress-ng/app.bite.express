"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { getAuthToken } from "./auth";

/**
 * Laravel Reverb (Pusher-protocol) client.
 *
 * Reverb is already wired in the dashboard.bite.express backend's
 * EventServiceProvider — this client subscribes to the channels it
 * broadcasts on. Common subscriptions:
 *   - private-orders.{id}     order status + rider location updates
 *   - private-chat.{room}     in-app chat
 *
 * Env vars needed (Vercel):
 *   NEXT_PUBLIC_REVERB_APP_KEY    Pusher-style app key from REVERB_APP_KEY in Laravel .env
 *   NEXT_PUBLIC_REVERB_HOST       e.g. reverb.bite.express (or the srv02 hostname)
 *   NEXT_PUBLIC_REVERB_PORT       443 in prod, 8080 locally
 *   NEXT_PUBLIC_REVERB_SCHEME     "https" in prod, "http" locally
 *
 * Returns a singleton — Echo holds a single WebSocket connection
 * across the whole app to keep things efficient.
 */

declare global {
  // eslint-disable-next-line no-var
  var __biteExpressEcho: Echo<"pusher"> | undefined;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_REVERB_APP_KEY &&
      process.env.NEXT_PUBLIC_REVERB_HOST,
  );
}

export function getEcho(): Echo<"pusher"> | null {
  if (typeof window === "undefined") return null;
  if (!isConfigured()) return null;
  if (globalThis.__biteExpressEcho) return globalThis.__biteExpressEcho;

  // Pusher must be on window for Echo to find it
  (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

  globalThis.__biteExpressEcho = new Echo({
    broadcaster: "pusher",
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY!,
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST!,
    wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 443),
    wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 443),
    forceTLS: (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "https") === "https",
    enabledTransports: ["ws", "wss"],
    cluster: "",
    // Reverb auth: hits Laravel's /broadcasting/auth with our bearer token
    authEndpoint: apiBase ? `${apiBase}/broadcasting/auth` : undefined,
    auth: {
      headers: {
        Authorization: `Bearer ${getAuthToken() ?? ""}`,
        Accept: "application/json",
      },
    },
  });

  return globalThis.__biteExpressEcho;
}

/** Cleanly tear down the singleton — call from sign-out flows. */
export function disconnectEcho(): void {
  globalThis.__biteExpressEcho?.disconnect();
  globalThis.__biteExpressEcho = undefined;
}
