"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  updateProfile,
  fetchProfile,
  type UpdateProfileResult,
} from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-store";
import { normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type Step =
  | { kind: "edit" }
  | {
      kind: "otp";
      target: "phone" | "email";
      medium: "SMS" | "email" | "firebase";
      message: string;
    };

/**
 * /profile/edit form.
 *
 * Name + email + phone editable. Avatar upload + password change
 * deliberately out of scope for v0 (each is its own UX surface).
 *
 * Phone or email changes can trip the backend's OTP gate (depends
 * on phone_verification_status / email_verification_status business
 * settings). When that happens we swap the form for an OTP entry
 * step and re-submit with the entered code on confirm.
 *
 * After a clean save we re-fetch /customer/info so the cached
 * AuthUser (and any header / profile UI driven by it) reflects the
 * new values.
 */
export function ProfileEditForm() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [step, setStep] = useState<Step>({ kind: "edit" });
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Seed inputs from the cached user on first mount.
  useEffect(() => {
    if (!user) return;
    setName(
      [user.f_name, user.l_name].filter(Boolean).join(" ").trim() || "",
    );
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
  }, [user]);

  async function refreshProfile() {
    const res = await fetchProfile();
    if (res.ok) setUser(res.user);
  }

  async function submit(useOtp?: string) {
    setTopError(null);
    setFieldErrors({});

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setFieldErrors({
        phone: ["Enter a Nigerian phone number, e.g. 08012345678."],
      });
      return;
    }
    if (!name.trim() || !email.trim()) {
      setTopError("Name and email are both required.");
      return;
    }

    setSubmitting(true);
    const res: UpdateProfileResult = await updateProfile({
      name: name.trim(),
      email: email.trim(),
      phone: normalizedPhone,
      otp: useOtp,
      verificationOn: step.kind === "otp" ? step.target : undefined,
      verificationMedium: step.kind === "otp" ? step.medium : undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      else setTopError(res.message);
      return;
    }

    if (res.kind === "needs-otp") {
      if (res.medium === "firebase") {
        // We don't support Firebase OTP on the web app yet. The
        // mobile app handles this — surface the gap clearly.
        setTopError(
          "Changing this requires phone verification via Firebase, which the web app doesn't support yet. Use the mobile app or skip this change for now.",
        );
        return;
      }
      setOtp("");
      setStep({
        kind: "otp",
        target: res.target,
        medium: res.medium,
        message: res.message,
      });
      return;
    }

    // Done!
    await refreshProfile();
    toast.success("Profile updated.");
    router.replace("/profile");
  }

  if (step.kind === "edit") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4 rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8"
      >
        <Field
          label="Full name"
          value={name}
          onChange={setName}
          autoComplete="name"
          autoFocus
          errors={fieldErrors.name}
        />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          errors={fieldErrors.email}
        />
        <Field
          label="Phone number"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          errors={fieldErrors.phone}
          hint="Changing your phone needs a code we'll send to the new number."
        />

        {topError && <p className="text-sm text-error">{topError}</p>}

        <PrimaryButton submitting={submitting}>
          Save changes
          {!submitting && <ArrowRight size={16} strokeWidth={2.2} />}
        </PrimaryButton>
      </form>
    );
  }

  // OTP step
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (otp.length < 4) {
          setTopError("Enter the code we sent.");
          return;
        }
        submit(otp);
      }}
      className="space-y-4 rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8"
    >
      <p className="text-sm text-ink-600">
        {step.message ||
          (step.target === "phone"
            ? `Enter the SMS code we sent to ${phone}.`
            : `Enter the code we emailed to ${email}.`)}
      </p>
      <Field
        label={step.target === "phone" ? "SMS code" : "Email code"}
        value={otp}
        onChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="• • • • • •"
      />
      {topError && <p className="text-sm text-error">{topError}</p>}
      <PrimaryButton submitting={submitting}>
        Confirm and save
        {!submitting && <ArrowRight size={16} strokeWidth={2.2} />}
      </PrimaryButton>
      <button
        type="button"
        onClick={() => {
          setStep({ kind: "edit" });
          setOtp("");
          setTopError(null);
        }}
        disabled={submitting}
        className="block w-full text-center text-xs text-ink-500 underline-offset-2 hover:underline"
      >
        Back to edit
      </button>
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
  errors?: string[];
  hint?: string;
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
  errors,
  hint,
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
          Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}
