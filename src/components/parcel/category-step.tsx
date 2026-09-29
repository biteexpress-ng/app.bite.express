"use client";

import Image from "next/image";
import { Loader2, Package } from "lucide-react";
import type { ParcelCategory } from "@/lib/api/parcel";
import { cn } from "@/lib/cn";

export type CategoryList =
  | { kind: "loading" }
  | { kind: "ready"; categories: ParcelCategory[] }
  | { kind: "error"; message: string };

type Props = {
  list: CategoryList;
  selectedId: number | null;
  onSelect: (category: ParcelCategory) => void;
};

export function CategoryStep({ list, selectedId, onSelect }: Props) {
  if (list.kind === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <Loader2 size={14} className="animate-spin" />
        Loading parcel types…
      </p>
    );
  }
  if (list.kind === "error") {
    return <p role="alert" className="text-sm text-error">{list.message}</p>;
  }
  if (list.categories.length === 0) {
    return (
      <p className="text-sm text-ink-500">No parcel types are set up for your area yet.</p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.categories.map((c) => {
        const checked = c.id === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            aria-pressed={checked}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
              checked
                ? "border-transparent bg-white shadow-[0_0_0_2px_rgba(222,22,0,0.5),0_18px_42px_-18px_rgba(222,22,0,0.35)]"
                : "border-ink-200 bg-white hover:-translate-y-px hover:border-brand-red/30 hover:shadow-soft",
            )}
          >
            <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas-sunken text-ink-500">
              {c.image_full_url ? (
                <Image src={c.image_full_url} alt="" fill sizes="48px" className="object-cover" />
              ) : (
                <Package size={20} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink-900">{c.name}</span>
              {c.description && (
                <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">
                  {c.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
