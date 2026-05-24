"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  checkPhone,
  manualLogin,
  requestLoginOtp,
  verifyLoginOtp,
  completeProfile,
  fetchProfile,
} from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-store";
import { normalizePhone } from "@/lib/phone";
import { cn } from "@/lib/cn";

type Step =
  | { kind: "phone" }
  | {
      kind: "password";
      phone: string;
      hasPassword: boolean;
    }
  | {
      kind: "not-found";
      phone: string;
    }
  | { kind: "otp"; phone: string }
  | { kind: "profile"; phone: string };

/**
 * The flow:
 *
 *   1. Phone -> Next -> checkPhone
 *        exists & hasPassword       -> password step + "forgot? OTP"
 *        exists & no password set   -> straight to OTP step
 *        doesn't exist              -> "not on BiteExpress, sign up"
 *
 *   2a. Password -> manualLogin -> done
 *       wrong password -> show error + the "sign in with OTP" link
 *
 *   2b. OTP -> verifyLoginOtp -> done
 *       (rare) needsProfile=true -> step 3 (name + email)
 */
export function SignInFlow() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const signIn = useAuth((s) => s.signIn);

  const [step, setStep] = useState<Step>({ kind: "phone" });

  async function finishWithToken(token: string, phoneForFallback: string) {
    const profile = await fetchProfile();
    signIn(
      token,
      profile.ok
        ? profile.user
        : { id: 0, f_name: "Customer", phone: phoneForFallback },
    );
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      {step.kind === "phone" && (
        <PhoneStep
          onLookup={(phone, result) => {
            if (!result.exists) {
              setStep({ kind: "not-found", phone });
            } else if (result.hasPassword) {
              setStep({ kind: "password", phone, hasPassword: true });
            } else {
              setStep({ kind: "otp", phone });
            }
          }}
        />
      )}

      {step.kind === "password" && (
        <PasswordStep
          phone={step.phone}
          onBack={() => setStep({ kind: "phone" })}
          onAuthed={(token) => finishWithToken(token, step.phone)}
          onSwitchToOtp={() => setStep({ kind: "otp", phone: step.phone })}
        />
      )}

      {step.kind === "not-found" && (
        <NotFoundStep
          phone={step.phone}
          onBack={() => setStep({ kind: "phone" })}
          next={next}
        />
      )}

      {step.kind === "otp" && (
        <OtpStep
          phone={step.phone}
          onBack={() => setStep({ kind: "phone" })}
          onVerified={async (result) => {
            if (result.needsProfile) {
              setStep({ kind: "profile", phone: step.phone });
            } else {
              await finishWithToken(result.token, step.phone);
            }
          }}
        />
      )}

      {step.kind === "profile" && (
        <ProfileStep
          phone={step.phone}
          onComplete={(token) => finishWithToken(token, step.phone)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Step 1 — phone                                                       */
/* -------------------------------------------------------------------- */

function PhoneStep({
  onLookup,
}: {
  onLookup: (
    phone: string,
    result: { exists: boolean; hasPassword: boolean },
  ) => void;
}) {
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
    const res = await checkPhone(normalized);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    onLookup(normalized, {
      exists: res.exists,
      hasPassword: res.hasPassword,
    });
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
        Next
        {!submitting && <ArrowRight size={16} strokeWidth={2.2} />}
      </PrimaryButton>
      <p className="text-center text-xs text-ink-500">
        New to BiteExpress?{" "}
        <Link
          href="/signup"
          className="font-medium text-brand-red underline-offset-2 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------- */
/* Step 2 — password                                                    */
/* -------------------------------------------------------------------- */

function PasswordStep({
  phone,
  onBack,
  onAuthed,
  onSwitchToOtp,
}: {
  phone: string;
  onBack: () => void;
  onAuthed: (token: string) => void | Promise<void>;
  onSwitchToOtp: () => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Enter your password to continue.");
      return;
    }
    setSubmitting(true);
    const res = await manualLogin(phone, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    await onAuthed(res.token);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-ink-600">
        Signing in as{" "}
        <span className="font-medium text-ink-900">{phone}</span>.{" "}
        <button
          type="button"
          onClick={onBack}
          className="text-brand-red underline-offset-2 hover:underline"
        >
          Change
        </button>
      </p>
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        autoFocus
      />
      {error && <p className="text-sm text-error">{error}</p>}
      <PrimaryButton submitting={submitting}>
        Sign in
        {!submitting && <ArrowRight size={16} strokeWidth={2.2} />}
      </PrimaryButton>
      <p className="text-center text-xs text-ink-500">
        Forgotten your password?{" "}
        <button
          type="button"
          onClick={onSwitchToOtp}
          className="font-medium text-brand-red underline-offset-2 hover:underline"
        >
          Sign in with a one-time code
        </button>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------- */
/* Step 2 / fallback — OTP                                              */
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
  const [resent, setResent] = useState(false);

  // Send the OTP as soon as this step mounts. Subsequent re-renders
  // shouldn't re-fire — useEffect with [phone] deps gives us that.
  useEffect(() => {
    let cancelled = false;
    requestLoginOtp(phone).then((res) => {
      if (cancelled) return;
      if (!res.ok) setError(res.message);
    });
    return () => {
      cancelled = true;
    };
  }, [phone]);

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
    setResent(false);
    const res = await requestLoginOtp(phone);
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
          className="text-brand-red underline-offset-2 hover:underline"
        >
          Resend code
        </button>
        {resent && (
          <span className="ml-2 text-success">A new code is on its way.</span>
        )}
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------- */
/* Phone not found                                                      */
/* -------------------------------------------------------------------- */

function NotFoundStep({
  phone,
  onBack,
  next,
}: {
  phone: string;
  onBack: () => void;
  next: string;
}) {
  return (
    <div className="space-y-5 text-center">
      <h2 className="font-serif text-xl text-ink-900">
        That phone isn't on BiteExpress yet
      </h2>
      <p className="text-sm text-ink-600">
        <span className="font-medium text-ink-900">{phone}</span> isn't
        connected to a BiteExpress account. Sign up and we'll get you ordering
        in under a minute.
      </p>
      <Link
        href={`/signup?phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm hover:bg-brand-red-600"
      >
        Create an account
        <ArrowRight size={16} strokeWidth={2.2} />
      </Link>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-ink-600 underline-offset-2 hover:underline"
      >
        Try a different number
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Profile completion (edge case for OTP-only legacy accounts)          */
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
        We just need a name and email to finish setting up your account.
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
/* Tiny shared atoms                                                    */
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
