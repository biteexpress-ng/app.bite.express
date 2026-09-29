"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, MapPin, Loader2, Settings2 } from "lucide-react";
import { fetchAddresses, type SavedAddress } from "@/lib/api/addresses";
import type { DeliveryLocation } from "@/lib/location-store";
import { cn } from "@/lib/cn";

export type CheckoutAddress = {
  /** Where we sourced this from — used in copy + analytics later. */
  source: "saved" | "picked";
  /** Free-form text the rider sees. */
  text: string;
  lat: number;
  lng: number;
  /** Optional — present when source==="saved". */
  savedId?: number;
  addressType?: string;
  contactPersonName?: string;
  contactPersonNumber?: string;
  contactPersonEmail?: string | null;
};

type Props = {
  picked: DeliveryLocation;
  value: CheckoutAddress | null;
  onChange: (a: CheckoutAddress) => void;
};

/**
 * Address picker on /checkout. Combines:
 *   - The location the customer chose on /welcome
 *     (always available, the obvious default for first-time orders)
 *   - Any saved addresses from /api/v1/customer/address/list
 *     (only fetched for signed-in users; the api-client returns
 *     skipped/401 → we silently hide the section).
 *
 * v0 doesn't let users SAVE the picked address as a new saved one
 * yet — that's a follow-up (POST /address/add). Customers can still
 * place an order using the picked address.
 */
export function AddressPickerCheckout({ picked, value, onChange }: Props) {
  const [saved, setSaved] = useState<SavedAddress[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAddresses().then((res) => {
      if (cancelled) return;
      setSaved(res.ok ? res.addresses : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Default-select: first saved address if any, otherwise the picked one.
  useEffect(() => {
    if (value) return;
    if (saved && saved.length > 0) {
      onChange(toCheckoutFromSaved(saved[0]));
    } else if (saved !== null) {
      onChange(toCheckoutFromPicked(picked));
    }
  }, [saved, value, picked, onChange]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Loader2 size={14} className="animate-spin" />
        Loading addresses…
      </div>
    );
  }

  const selectedKey =
    value?.source === "saved" ? `s-${value.savedId}` : "picked";

  return (
    <div className="space-y-3">
      {saved && saved.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wider text-ink-500">
            Saved
          </p>
          {saved.map((a) => {
            const id = `s-${a.id}`;
            const checked = selectedKey === id;
            return (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                  checked
                    ? "border-brand-red bg-brand-red/5"
                    : "border-ink-200 bg-white hover:border-ink-300",
                )}
              >
                <RadioDot checked={checked} />
                <Home size={16} className="mt-0.5 shrink-0 text-ink-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">
                    {a.address_type}
                    {a.is_default ? (
                      <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-600">
                        Default
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-600">{a.address}</p>
                  {a.contact_person_number && (
                    <p className="mt-1 text-xs text-ink-500">
                      {a.contact_person_name} · {a.contact_person_number}
                    </p>
                  )}
                </div>
                <input
                  type="radio"
                  name="checkout-address"
                  checked={checked}
                  onChange={() => onChange(toCheckoutFromSaved(a))}
                  className="sr-only"
                />
              </label>
            );
          })}
        </>
      )}

      <p className="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-ink-500">
        <span>{saved && saved.length > 0 ? "Or use" : "This delivery"}</span>
        <Link
          href="/addresses"
          className="inline-flex items-center gap-1 normal-case tracking-normal text-brand-red hover:underline"
        >
          <Settings2 size={11} />
          Manage saved addresses
        </Link>
      </p>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
          selectedKey === "picked"
            ? "border-brand-red bg-brand-red/5"
            : "border-ink-200 bg-white hover:border-ink-300",
        )}
      >
        <RadioDot checked={selectedKey === "picked"} />
        <MapPin size={16} className="mt-0.5 shrink-0 text-ink-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">
            Address you picked on the home page
          </p>
          <p className="mt-0.5 text-sm text-ink-600">
            {picked.formattedAddress}
          </p>
        </div>
        <input
          type="radio"
          name="checkout-address"
          checked={selectedKey === "picked"}
          onChange={() => onChange(toCheckoutFromPicked(picked))}
          className="sr-only"
        />
      </label>
    </div>
  );
}

function toCheckoutFromSaved(a: SavedAddress): CheckoutAddress {
  return {
    source: "saved",
    text: a.address,
    lat: Number(a.latitude),
    lng: Number(a.longitude),
    savedId: a.id,
    addressType: a.address_type,
    contactPersonName: a.contact_person_name,
    contactPersonNumber: a.contact_person_number,
    contactPersonEmail: a.contact_person_email ?? null,
  };
}

/** Exported for /send, whose pickup defaults to the home-page location. */
export function toCheckoutFromPicked(p: DeliveryLocation): CheckoutAddress {
  return {
    source: "picked",
    text: p.formattedAddress,
    lat: p.lat,
    lng: p.lng,
    addressType: "Delivery",
  };
}

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
        checked
          ? "border-brand-red bg-brand-red text-white"
          : "border-ink-300 bg-white",
      )}
      aria-hidden="true"
    >
      {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </span>
  );
}
