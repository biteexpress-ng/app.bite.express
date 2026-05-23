"use client";

import { create } from "zustand";

/**
 * Chosen delivery location.
 *
 * Persisted to localStorage so a returning visitor doesn't have to
 * re-pick on every refresh. Hydrated lazily on first access from the
 * browser; on the server (SSR) the store starts empty.
 *
 * Zone detection (does BiteExpress actually deliver here?) is NOT in
 * this store — that's a separate concern that calls the backend's
 * `/api/v1/config/zone-list` once an address is chosen.
 */

export type DeliveryLocation = {
  /** Human-readable address as shown to the user. */
  formattedAddress: string;
  lat: number;
  lng: number;
  /** Google Place ID, useful for re-geocoding and analytics. */
  placeId?: string;
};

const STORAGE_KEY = "biteexpress.location";

type LocationState = {
  location: DeliveryLocation | null;
  hydrated: boolean;
  hydrate: () => void;
  set: (loc: DeliveryLocation) => void;
  clear: () => void;
};

function readPersisted(): DeliveryLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeliveryLocation;
  } catch {
    return null;
  }
}

function writePersisted(loc: DeliveryLocation | null) {
  if (typeof window === "undefined") return;
  try {
    if (loc) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota / disabled storage — ignore */
  }
}

export const useLocation = create<LocationState>((set, get) => ({
  location: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ location: readPersisted(), hydrated: true });
  },

  set: (loc) => {
    writePersisted(loc);
    set({ location: loc, hydrated: true });
  },

  clear: () => {
    writePersisted(null);
    set({ location: null, hydrated: true });
  },
}));
