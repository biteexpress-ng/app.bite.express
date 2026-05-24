"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { changePassword, manualLogin } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type Phase = "edit" | "submitting" | "verifying-current";

/**
 * Change-password form.
 *
 * Backend's update_profile doesn't check the current password (the
 * bearer token alone is sufficient server-side authorisation). We
 * collect the current password anyway as a UX safety net — a hijacked
 * tab can't silently rotate the password without it.
 *
 * Flow:
 *   1. Validate (current != new, new ≥ 8, confirm matches)
 *   2. POST /auth/login with login_type:"manual" to confirm the
 *      current password is real (returns 401 if wrong)
 *   3. POST /customer/update-profile with button_type=change_password
 *      and the new password
 *   4. Bounce to /profile
 *
 * No new bearer token is issued by the password update — the
 * existing one stays valid, so we don't need to re-store anything.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [phase, setPhase] = useState<Phase>("edit");
  const [topError, setTopError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);

    if (!user) {
      setTopError("Sign in expired — refresh and try again.");
      return;
    }
    if (!currentPwd) {
      setTopError("Enter your current password.");
      return;
    }
    if (newPwd.length < 8) {
      setTopError("New password must be at least 8 characters.");
      return;
    }
    if (newPwd === currentPwd) {
      setTopError("New password must be different from the current one.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setTopError("New password and confirmation don't match.");
      return;
    }

    // Phase 1 — verify current password is real by attempting a
    // manual login. This trips a brief 2nd auth token on the
    // backend, which is fine — we don't need to store it.
    setPhase("verifying-current");
    const verify = await manualLogin(user.phone ?? "", currentPwd);
    if (!verify.ok) {
      setPhase("edit");
      setTopError(
        verify.message?.toLowerCase().includes("credential")
          ? "Current password is wrong."
          : verify.message || "Couldn't verify your current password.",
      );
      return;
    }

    // Phase 2 — actually change it.
    setPhase("submitting");
    const res = await changePassword({ newPassword: newPwd, currentUser: user });
    if (!res.ok) {
      setPhase("edit");
      setTopError(res.message);
      return;
    }
    toast.success("Password updated.");
    router.replace("/profile");
  }

  const busy = phase !== "edit";
  const ctaLabel =
    phase === "verifying-current"
      ? "Verifying current password…"
      : phase === "submitting"
        ? "Updating…"
        : "Update password";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8"
    >
      <PasswordField
        label="Current password"
        value={currentPwd}
        onChange={setCurrentPwd}
        autoComplete="current-password"
        show={showCurrent}
        onToggleShow={() => setShowCurrent((s) => !s)}
        autoFocus
      />
      <PasswordField
        label="New password"
        value={newPwd}
        onChange={setNewPwd}
        autoComplete="new-password"
        show={showNew}
        onToggleShow={() => setShowNew((s) => !s)}
        hint="At least 8 characters."
      />
      <PasswordField
        label="Confirm new password"
        value={confirmPwd}
        onChange={setConfirmPwd}
        autoComplete="new-password"
        show={showNew}
      />

      {topError && <p className="text-sm text-error">{topError}</p>}

      <button
        type="submit"
        disabled={busy}
        className={cn(
          "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm transition-colors",
          "hover:bg-brand-red-600 active:bg-brand-red-700",
          "disabled:cursor-wait disabled:opacity-70",
        )}
      >
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {ctaLabel}
          </>
        ) : (
          <>
            {ctaLabel}
            <ArrowRight size={16} strokeWidth={2.2} />
          </>
        )}
      </button>

      <p className="text-center text-xs text-ink-500">
        Forgot your current password? Sign out and use "Sign in with a
        one-time code" instead.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------- */

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  show,
  onToggleShow,
  autoFocus,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  show: boolean;
  onToggleShow?: () => void;
  autoFocus?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 pr-11 text-base text-ink-900 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
        {onToggleShow && (
          <button
            type="button"
            onClick={onToggleShow}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
