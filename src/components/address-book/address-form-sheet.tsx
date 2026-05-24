"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  createAddress,
  updateAddress,
  type AddressInput,
  type SavedAddress,
} from "@/lib/api/addresses";
import { useAuth } from "@/lib/auth-store";
import { AddressPicker } from "@/components/address/address-picker";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  existing: SavedAddress | null;
  onClose: () => void;
  onSaved: () => void;
};

const TYPES = ["Home", "Office", "Other"] as const;

/**
 * Modal / bottom sheet form for adding or editing a saved address.
 *
 * Same component handles both "create" and "edit" — when `existing`
 * is null we POST /address/add, otherwise PUT /address/update/{id}.
 *
 * Address text + lat/lng come from <AddressPicker persistToStore={false} />
 * so the welcome flow's stored delivery location isn't overwritten
 * just because the customer edited their saved Office address.
 */
export function AddressFormSheet({ open, existing, onClose, onSaved }: Props) {
  const user = useAuth((s) => s.user);

  const [type, setType] = useState<string>("Home");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [floor, setFloor] = useState("");
  const [road, setRoad] = useState("");
  const [house, setHouse] = useState("");
  const [picked, setPicked] = useState<{
    formattedAddress: string;
    lat: number;
    lng: number;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  // Reset / seed when sheet opens.
  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setTopError(null);
    if (existing) {
      setType(existing.address_type || "Home");
      setContactName(existing.contact_person_name || "");
      setContactPhone(existing.contact_person_number || "");
      setFloor(existing.floor || "");
      setRoad(existing.road || "");
      setHouse(existing.house || "");
      setPicked({
        formattedAddress: existing.address,
        lat: Number(existing.latitude),
        lng: Number(existing.longitude),
      });
    } else {
      setType("Home");
      setContactName(
        user
          ? [user.f_name, user.l_name].filter(Boolean).join(" ").trim()
          : "",
      );
      setContactPhone(user?.phone ?? "");
      setFloor("");
      setRoad("");
      setHouse("");
      setPicked(null);
    }
  }, [open, existing, user]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    if (!picked) {
      setTopError("Pick an address from the suggestions to set its location.");
      return;
    }
    if (!contactName.trim() || !contactPhone.trim() || !type.trim()) {
      setTopError("Name, phone and type are all required.");
      return;
    }

    const input: AddressInput = {
      contactPersonName: contactName.trim(),
      contactPersonNumber: contactPhone.trim(),
      addressType: type.trim(),
      address: picked.formattedAddress,
      latitude: picked.lat,
      longitude: picked.lng,
      floor: floor.trim() || undefined,
      road: road.trim() || undefined,
      house: house.trim() || undefined,
    };

    setSubmitting(true);
    const res = existing
      ? await updateAddress(existing.id, input)
      : await createAddress(input);
    setSubmitting(false);

    if (!res.ok) {
      if (res.reason === "out-of-zone") {
        setTopError(
          "We don't deliver to this address yet. Pick another and try again.",
        );
      } else {
        setTopError(res.message);
      }
      return;
    }
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={existing ? "Edit address" : "Add address"}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-elevated sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 justify-center pt-2 sm:hidden"
          aria-hidden="true"
        >
          <span className="h-1 w-10 rounded-full bg-ink-200" />
        </div>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 sm:px-6">
          <h2 className="font-serif text-xl text-ink-900">
            {existing ? "Edit address" : "Add a new address"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100"
          >
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="space-y-5 p-5 sm:p-6">
            <Field label="Address type">
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => {
                  const active = t === type;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors",
                        active
                          ? "border-brand-red bg-brand-red text-white"
                          : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Delivery address">
              <AddressPicker
                variant="light"
                persistToStore={false}
                initialValue={picked?.formattedAddress}
                onPick={(loc) =>
                  setPicked({
                    formattedAddress: loc.formattedAddress,
                    lat: loc.lat,
                    lng: loc.lng,
                  })
                }
              />
              {picked && (
                <p className="mt-2 text-xs text-ink-500">
                  Pinned at {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}.
                </p>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="House / Apt">
                <Input value={house} onChange={setHouse} placeholder="6B" />
              </Field>
              <Field label="Road / Street">
                <Input
                  value={road}
                  onChange={setRoad}
                  placeholder="Adeola Odeku"
                />
              </Field>
              <Field label="Floor">
                <Input value={floor} onChange={setFloor} placeholder="3rd" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name">
                <Input
                  value={contactName}
                  onChange={setContactName}
                  autoComplete="name"
                />
              </Field>
              <Field label="Contact phone">
                <Input
                  value={contactPhone}
                  onChange={setContactPhone}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </Field>
            </div>

            {topError && (
              <p className="rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
                {topError}
              </p>
            )}
          </div>

          <footer className="shrink-0 border-t border-ink-200 bg-white p-5 sm:p-6">
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
              ) : existing ? (
                "Save changes"
              ) : (
                "Save address"
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
    />
  );
}
