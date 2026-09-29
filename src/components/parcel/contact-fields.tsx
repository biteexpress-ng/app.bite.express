"use client";

import type { ContactErrors, ParcelContact } from "@/lib/parcel/parcel-form";
import { cn } from "@/lib/cn";

type Props = {
  idPrefix: string;
  value: ParcelContact;
  onChange: (next: ParcelContact) => void;
  errors: ContactErrors;
  showEmail: boolean;
};

export function ContactFields({ idPrefix, value, onChange, errors, showEmail }: Props) {
  const set =
    (field: keyof ParcelContact) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [field]: e.target.value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        id={`${idPrefix}-name`}
        label="Contact name"
        value={value.name}
        onChange={set("name")}
        error={errors.name}
        autoComplete="name"
      />
      <Field
        id={`${idPrefix}-phone`}
        label="Phone"
        value={value.phone}
        onChange={set("phone")}
        error={errors.phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0801 234 5678"
      />
      {showEmail && (
        <Field
          id={`${idPrefix}-email`}
          label="Email (optional)"
          value={value.email}
          onChange={set("email")}
          error={errors.email}
          type="email"
          autoComplete="email"
        />
      )}
      <Field id={`${idPrefix}-house`} label="House (optional)" value={value.house} onChange={set("house")} />
      <Field id={`${idPrefix}-floor`} label="Floor (optional)" value={value.floor} onChange={set("floor")} />
      <Field id={`${idPrefix}-road`} label="Road (optional)" value={value.road} onChange={set("road")} />
    </div>
  );
}

function Field({
  id,
  label,
  error,
  ...input
}: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "h-11 w-full rounded-xl border bg-white px-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/20",
          error ? "border-error" : "border-ink-200",
        )}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
