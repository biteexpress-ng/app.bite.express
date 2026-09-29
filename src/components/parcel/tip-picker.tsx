"use client";

/** The same amounts and look as the tip control on /checkout. */
export const TIP_AMOUNTS: readonly number[] = [0, 200, 500, 1000];

type Props = {
  value: number;
  onChange: (amount: number) => void;
};

export function TipPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {TIP_AMOUNTS.map((amt) => {
        const active = value === amt;
        return (
          <button
            key={amt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(amt)}
            className={
              "inline-flex h-11 items-center justify-center rounded-pill border px-5 text-sm font-medium transition-all duration-200 " +
              (active
                ? "border-transparent bg-ink-900 text-white shadow-[0_8px_22px_-8px_rgba(13,13,15,0.55)]"
                : "border-ink-200 bg-white text-ink-900 hover:-translate-y-px hover:border-brand-red/30 hover:text-brand-red hover:shadow-soft")
            }
          >
            {amt === 0 ? "No tip" : `₦${amt.toLocaleString()}`}
          </button>
        );
      })}
    </div>
  );
}
