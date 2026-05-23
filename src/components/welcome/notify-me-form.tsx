"use client";

import { useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";
import { subscribeNewsletter } from "@/lib/api/newsletter";
import { cn } from "@/lib/cn";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done"; alreadySubscribed?: boolean }
  | { kind: "error"; message: string };

type NotifyMeFormProps = {
  /** Headline + body change based on the zone result the form sits next to. */
  context: "out-of-zone" | "temp-unavailable";
};

/**
 * Email capture for visitors whose address isn't covered by any
 * active zone. Posts to /api/v1/newsletter/subscribe so ops sees
 * the lead in the same place as marketing-site signups.
 *
 * Future enhancement: include the picked lat/lng/address alongside
 * the email so we can rank cities by demand. Backend schema change
 * required — out of scope for this slice.
 */
export function NotifyMeForm({ context }: NotifyMeFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });
    const res = await subscribeNewsletter(email);
    if (res.ok) {
      setState({ kind: "done", alreadySubscribed: res.alreadySubscribed });
    } else {
      setState({ kind: "error", message: res.message });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-4 text-sm text-white/85">
        <Check size={18} className="shrink-0 text-brand-orange" />
        <div>
          <p className="font-medium">
            {state.alreadySubscribed
              ? "You're already on the list."
              : "Got it — we'll let you know."}
          </p>
          <p className="mt-0.5 text-xs text-white/55">
            {context === "out-of-zone"
              ? "We'll email the moment ordering opens in your area."
              : "We'll email the moment service resumes here."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div
        className={cn(
          "flex items-center gap-3 rounded-full border px-5 py-3 transition-colors focus-within:ring-2 focus-within:ring-brand-red focus-within:ring-offset-2 focus-within:ring-offset-black/60",
          "border-white/20 bg-white/10 text-white backdrop-blur",
        )}
      >
        <Mail size={18} strokeWidth={1.8} className="text-white/70" />
        <input
          type="email"
          required
          placeholder="you@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state.kind === "submitting"}
          className="w-full bg-transparent text-base text-white outline-none placeholder:text-white/55 disabled:cursor-wait"
          aria-label="Email"
        />
        <button
          type="submit"
          disabled={state.kind === "submitting"}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-brand-red px-4 text-sm font-medium text-white transition-colors",
            "hover:bg-brand-red-600 active:bg-brand-red-700",
            "disabled:cursor-wait disabled:opacity-70",
          )}
        >
          {state.kind === "submitting" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving
            </>
          ) : (
            "Notify me"
          )}
        </button>
      </div>
      {state.kind === "error" && (
        <p className="px-3 text-xs text-white/70">{state.message}</p>
      )}
    </form>
  );
}
