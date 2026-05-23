"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  requestLoginOtp,
  verifyLoginOtp,
  completeProfile,
  fetchProfile,
} from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/cn";

type Step =
  | { kind: "phone" }
  | { kind: "otp"; phone: string }
  | { kind: "profile"; phone: string };

/**
 * Three-step OTP sign-in:
 *   1. Phone   → request OTP
 *   2. OTP     → verify; either signed-in OR (new user) move to profile
 *   3. Profile → name + email, returns the token, signed-in
 *
 * On success we hydrate the auth store and bounce back to the page
 * the user came from (`?next=…` query) or `/`.
 *
 * No password / social / manual login in v0 — OTP only.
 */
export function SignInFlow() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const signIn = useAuth((s) => s.signIn);

  const [step, setStep] = useState<Step>({ kind: "phone" });

  async function finishWithToken(token: string) {
    // We don't have user data in the login response — fetch it.
    const profile = await fetchProfile();
    signIn(
      token,
      profile.ok
        ? profile.user
        : { id: 0, f_name: "Customer", phone: stepPhone(step) },
    );
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      {step.kind === "phone" && (
        <PhoneStep onSent={(phone) => setStep({ kind: "otp", phone })} />
      )}

      {step.kind === "otp" && (
        <OtpStep
          phone={step.phone}
          onBack={() => setStep({ kind: "phone" })}
          onVerified={async (result) => {
            if (result.needsProfile) {
              setStep({ kind: "profile", phone: step.phone });
            } else {
              await finishWithToken(result.token);
            }
          }}
        />
      )}

      {step.kind === "profile" && (
        <ProfileStep
          phone={step.phone}
          onComplete={async (token) => {
            await finishWithToken(token);
          }}
        />
      )}
    </div>
  );
}

function stepPhone(step: Step): string {
  return step.kind === "phone" ? "" : step.phone;
}

/* -------------------------------------------------------------------- */
/* Step 1 — phone                                                       */
/* -------------------------------------------------------------------- */

function PhoneStep({ onSent }: { onSent: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Enter a Nigerian phone number, e.g. 08012345678.");
      return;
    }
    setSubmitting(true);
    const res = await requestLoginOtp(normalized);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    onSent(normalized);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Phone number"
        type="tel"
        autoComplete="tel"
        placeholder="08012345678"
        value={phone}
        onChange={setPhone}
        autoFocus
        inputMode="tel"
      />
      {error && <p className="text-sm text-error">{error}</p>}
      <PrimaryButton submitting={submitting}>
        Send code
        {!submitting && <ArrowRight size={16} strokeWidth={2.2} />}
      </PrimaryButton>
      <p className="text-center text-xs text-ink-500">
        By continuing you agree to BiteExpress's terms and privacy policy.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------- */
/* Step 2 — OTP                                                         */
/* -------------------------------------------------------------------- */

function OtpStep({
  phone,
  onBack,
  onVerified,
}: {
  phone: string;
  onBack: () => void;
  onVerified: (
    result:
      | { needsProfile: true }
      | { needsProfile: false; token: string },
  ) => void | Promise<void>;
}) {
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (otp.length < 4) {
      setError("Enter the 6-digit code sent to your phone.");
      return;
    }
    setSubmitting(true);
    const res = await verifyLoginOtp(phone, otp);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    if (res.needsProfile) {
      await onVerified({ needsProfile: true });
    } else {
      await onVerified({ needsProfile: false, token: res.token });
    }
  }

  async function handleResend() {
    setResending(true);
    setResent(false);
    const res = await requestLoginOtp(phone);
    setResending(false);
    if (res.ok) {
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } else {
      setError(res.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-ink-600">
        Code sent to <span className="font-medium text-ink-900">{phone}</span>.{" "}
        <button
          type="button"
          onClick={onBack}
          className="text-brand-red underline-offset-2 hover:underline"
        >
          Change
        </button>
      </p>
      <Field
        label="6-digit code"
        type="text"
        autoComplete="one-time-code"
        inputMode="numeric"
        placeholder="• • • • • •"
        value={otp}
        onChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
        autoFocus
      />
      {error && <p className="text-sm text-error">{error}</p>}
      <PrimaryButton submitting={submitting}>
        Verify and continue
        {!submitting && <ArrowRight size={16} strokeWidth={2.2} />}
      </PrimaryButton>
      <p className="text-center text-xs text-ink-500">
        Didn't get it?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-brand-red underline-offset-2 hover:underline disabled:opacity-60"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
        {resent && (
          <span className="ml-2 text-success">A new code is on its way.</span>
        )}
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------- */
/* Step 3 — profile completion (new users only)                         */
/* -------------------------------------------------------------------- */

function ProfileStep({
  phone,
  onComplete,
}: {
  phone: string;
  onComplete: (token: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Both name and email are required.");
      return;
    }
    setSubmitting(true);
    const res = await completeProfile({
      name: name.trim(),
      email: email.trim(),
      phone,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    await onComplete(res.token);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-ink-600">
        Welcome — one quick step before we let you in.
      </p>
      <Field
        label="Full name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={setName}
        autoFocus
      />
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      {error && <p className="text-sm text-error">{error}</p>}
      <PrimaryButton submitting={submitting}>
        Finish sign-in
        {!submitting && <ArrowRight size={16} strokeWidth={2.2} />}
      </PrimaryButton>
    </form>
  );
}

/* -------------------------------------------------------------------- */
/* Tiny shared form atoms                                               */
/* -------------------------------------------------------------------- */

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoFocus?: boolean;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
  autoFocus,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
      />
    </label>
  );
}

function PrimaryButton({
  submitting,
  children,
}: {
  submitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm transition-colors",
        "hover:bg-brand-red-600 active:bg-brand-red-700",
        "disabled:cursor-wait disabled:opacity-70",
      )}
    >
      {submitting ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Working…
        </>
      ) : (
        children
      )}
    </button>
  );
}

/* -------------------------------------------------------------------- */
/* Phone normalization — Nigeria-specific                               */
/* -------------------------------------------------------------------- */

/**
 * Backend stores phones in international format (+234…). Accept any of:
 *   08012345678, 8012345678, 2348012345678, +2348012345678
 * Reject obvious nonsense (length, non-digits).
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("234") && digits.length === 13) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  return null;
}
