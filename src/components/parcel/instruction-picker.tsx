"use client";

import type { ParcelInstruction } from "@/lib/api/parcel";
import { cn } from "@/lib/cn";

type Props = {
  instructions: ParcelInstruction[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  note: string;
  onNoteChange: (note: string) => void;
};

/**
 * Preset rider instructions plus a free note, sent together as one
 * delivery instruction. Tapping the selected preset clears it.
 */
export function InstructionPicker({ instructions, selectedId, onSelect, note, onNoteChange }: Props) {
  return (
    <div className="space-y-3">
      {instructions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {instructions.map((i) => {
            const active = i.id === selectedId;
            return (
              <button
                key={i.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : i.id)}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-pill border px-4 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "border-transparent bg-ink-900 text-white"
                    : "border-ink-200 bg-white text-ink-900 hover:border-brand-red/30 hover:text-brand-red",
                )}
              >
                {i.instruction}
              </button>
            );
          })}
        </div>
      )}
      <div>
        <label htmlFor="parcel-note" className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
          Note for the rider (optional)
        </label>
        <textarea
          id="parcel-note"
          rows={2}
          maxLength={200}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="For example: call when you arrive"
          className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/20"
        />
      </div>
    </div>
  );
}
