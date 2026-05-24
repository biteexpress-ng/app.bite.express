"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { register, fetchProfile } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-store";
import { normalizePhone } from "@/lib/phone";
import { cn } from "@/lib/cn";

/**
 * One-shot sign-up form. POSTs to /auth/sign-up which returns a
 * session token directly (the backend doesn't gate this on OTP for
 * the customer module), so we hydrate the auth store and bounce
 * back to the page the user came from on success.
 *
 * Field-level errors from the backend (unique:phone, unique:email,
 * password complexity) are surfaced under the offending input.
 */
export function SignUpFlow() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const signIn = useAuth((s) => s.signIn);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState(search.get("phone") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setFieldErrors({ phone: ["Enter a Nigerian phone number, e.g. 08012345678."] });
      return;
    }
    if (password.length < 8) {
      setFieldErrors({ password: ["Password must be at least 8 characters."] });
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setTopError("First name, last name and email are all required.");
      return;
    }

    setSubmitting(true);
    const res = await register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: normalizedPhone,
      email: email.trim(),
      password,
      refCode: refCode.trim() || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      else setTopError(res.message);
      return;
    }

    const profile = await fetchProfile();
    signIn(
      res.token,
      profile.ok
        ? profile.user
        : {
            id: 0,
            f_name: firstName.trim(),
            l_name: lastName.trim(),
            email: email.trim(),
            phone: normalizedPhone,
          },
    );
    router.replace(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="First name"
          autoComplete="given-name"
          value={firstName}
          onChange={setFirstName}
          autoFocus
          errors={fieldErrors.f_name}
        />
        <Field
          label="Last name"
          autoComplete="family-name"
          value={lastName}
          onChange={setLastName}
          errors={fieldErrors.l_name}
        />
      </div>
      <Field
        label="Phone number"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="08012345678"
        value={phone}
        onChange={setPhone}
        errors={fieldErrors.phone}
      />
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@email.com"
        value={email}
        onChange={setEmail}
        errors={fieldErrors.email}
      />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        errors={fieldErrors.password}
        hint="At least 8 characters."
      />
      <Field
        label="Referral code"
        value={refCode}
        onChange={setRefCode}
        hint="Optional — paste a friend's code if you have one."
        errors={fieldErrors.ref_code}
      />

      {topError && <p className="text-sm text-error">{topError}</p>}

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
            Creating your account…
          </>
        ) : (
          <>
            Create account
            <ArrowRight size={16} strokeWidth={2.2} />
          </>
        )}
      </button>

      <p className="text-center text-xs text-ink-500">
        Already have an account?{" "}
        <Link
          href={`/signin?next=${encodeURIComponent(next)}`}
          className="font-medium text-brand-red underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-ink-500">
        By creating an account you agree to BiteExpress's terms and privacy
        policy.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------- */

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoFocus?: boolean;
  hint?: string;
  errors?: string[];
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
  hint,
  errors,
}: FieldProps) {
  const hasError = errors && errors.length > 0;
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
        className={cn(
          "w-full rounded-xl border bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2",
          hasError
            ? "border-error focus:border-error focus:ring-error/20"
            : "border-ink-200 focus:border-brand-red focus:ring-brand-red/20",
        )}
      />
      {hasError && (
        <span className="mt-1 block text-xs text-error">{errors[0]}</span>
      )}
      {!hasError && hint && (
        <span className="mt-1 block text-xs text-ink-500">{hint}</span>
      )}
    </label>
  );
}
