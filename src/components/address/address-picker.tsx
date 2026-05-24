"use client";

import { useEffect, useRef, useState } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { MapPin, Search } from "lucide-react";
import { useGoogleMaps } from "@/lib/maps";
import { useLocation, type DeliveryLocation } from "@/lib/location-store";
import { cn } from "@/lib/cn";

type Variant = "dark" | "light";

type AddressPickerProps = {
  variant?: Variant;
  className?: string;
  /** Called with the chosen location after the user picks a Place. */
  onPick?: (loc: DeliveryLocation) => void;
  /** Persist picked location into useLocation store + localStorage.
   *  True for the welcome flow (returning visitors see their last
   *  pick), false for forms (address-book add/edit) that don't want
   *  to overwrite the global delivery target. Default true. */
  persistToStore?: boolean;
  /** Initial text shown in the input. Used by the address-book edit
   *  form to seed with the existing saved address. When set, also
   *  suppresses the welcome-style re-hydrate-from-store behaviour. */
  initialValue?: string;
};

/**
 * Address picker for the welcome / checkout flow.
 *
 * Wraps Google Places Autocomplete (restricted to Nigeria). When the
 * user picks a suggestion, we resolve it to {formattedAddress, lat,
 * lng, placeId} and stash it in the location store + localStorage.
 *
 * Degrades gracefully:
 *   - No API key set → plain text input with a "Maps not configured"
 *     hint. We still persist the typed string so dev work can
 *     continue without a key.
 *   - Load error → plain input + retry hint.
 *   - Script still loading → disabled input with a skeleton.
 */
export function AddressPicker({
  variant = "dark",
  className,
  onPick,
  persistToStore = true,
  initialValue,
}: AddressPickerProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const hasKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const setLocation = useLocation((s) => s.set);
  const hydrate = useLocation((s) => s.hydrate);
  const stored = useLocation((s) => s.location);

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(initialValue ?? "");

  useEffect(() => {
    if (persistToStore) hydrate();
  }, [hydrate, persistToStore]);

  // Pre-fill with the previously chosen address — only on the
  // welcome flow. The address-book form passes initialValue and
  // doesn't want the global pick overriding it.
  useEffect(() => {
    if (initialValue !== undefined) return;
    if (!persistToStore) return;
    if (stored && !value) setValue(stored.formattedAddress);
    // We only want to seed once on first hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored?.formattedAddress, persistToStore, initialValue]);

  function handlePlaceChanged() {
    const ac = autocompleteRef.current;
    if (!ac) return;
    const place = ac.getPlace();
    if (!place?.geometry?.location) return;

    const loc: DeliveryLocation = {
      formattedAddress:
        place.formatted_address ?? place.name ?? inputRef.current?.value ?? "",
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      placeId: place.place_id,
    };

    setValue(loc.formattedAddress);
    if (persistToStore) setLocation(loc);
    onPick?.(loc);
  }

  // No key → degrade to a styled non-functional input + helpful note.
  if (!hasKey) {
    return (
      <FallbackInput
        variant={variant}
        className={className}
        value={value}
        onChange={setValue}
        note="Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable address suggestions."
      />
    );
  }

  if (loadError) {
    return (
      <FallbackInput
        variant={variant}
        className={className}
        value={value}
        onChange={setValue}
        note="Couldn't load Google Maps — type your address and we'll resolve it later."
      />
    );
  }

  if (!isLoaded) {
    return (
      <FallbackInput
        variant={variant}
        className={className}
        value=""
        onChange={() => {}}
        disabled
        note="Loading address suggestions…"
      />
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <Autocomplete
        onLoad={(ac) => {
          autocompleteRef.current = ac;
          // Restrict to Nigeria + address-type results only.
          ac.setComponentRestrictions({ country: ["ng"] });
          ac.setFields([
            "formatted_address",
            "geometry.location",
            "place_id",
            "name",
          ]);
        }}
        onPlaceChanged={handlePlaceChanged}
      >
        <PickerInput
          ref={inputRef}
          variant={variant}
          value={value}
          onChange={setValue}
        />
      </Autocomplete>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type InputCommonProps = {
  variant: Variant;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

const wrapperBase =
  "flex items-center gap-3 rounded-full border px-5 py-3 transition-colors focus-within:ring-2 focus-within:ring-brand-red focus-within:ring-offset-2";

const wrapperVariants: Record<Variant, string> = {
  dark:
    "border-white/20 bg-white/10 text-white backdrop-blur focus-within:bg-white/15 focus-within:ring-offset-black/60",
  light:
    "border-ink-200 bg-white text-ink-900 shadow-soft focus-within:ring-offset-white",
};

const inputBase =
  "w-full bg-transparent text-base outline-none placeholder:text-ink-400 disabled:cursor-wait";

const inputVariants: Record<Variant, string> = {
  dark: "text-white placeholder:text-white/55",
  light: "text-ink-900 placeholder:text-ink-400",
};

function PickerInput({
  ref,
  variant,
  value,
  onChange,
  disabled,
}: InputCommonProps & {
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className={cn(wrapperBase, wrapperVariants[variant])}>
      <MapPin
        size={18}
        strokeWidth={1.8}
        className={variant === "dark" ? "text-white/70" : "text-ink-500"}
      />
      <input
        ref={ref}
        type="text"
        inputMode="search"
        autoComplete="street-address"
        placeholder="Enter your delivery address"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(inputBase, inputVariants[variant])}
        aria-label="Delivery address"
      />
      <Search
        size={18}
        strokeWidth={1.8}
        className={variant === "dark" ? "text-white/60" : "text-ink-400"}
      />
    </div>
  );
}

function FallbackInput({
  variant,
  className,
  value,
  onChange,
  disabled,
  note,
}: InputCommonProps & { className?: string; note?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <PickerInput
        variant={variant}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      {note && (
        <p
          className={cn(
            "mt-2 px-3 text-xs",
            variant === "dark" ? "text-white/55" : "text-ink-500",
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}
