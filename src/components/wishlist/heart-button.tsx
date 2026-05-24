"use client";

import { useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useLocation } from "@/lib/location-store";
import { useWishlist } from "@/lib/wishlist-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type Props = {
  kind: "item" | "store";
  id: number;
  /** Visual size of the button. Default "sm" (32px). */
  size?: "sm" | "md";
  className?: string;
  /** Accessible label fragment ("Pounded Yam", "Rity's Restaurant"). */
  label?: string;
};

/**
 * Heart toggle for wishlist-ing an item or a store.
 *
 * - Guest visitors: button is hidden entirely (wishlist requires
 *   bearer auth on the backend; no point showing it).
 * - On first mount with a known zone we hydrate the wishlist store
 *   once per session so every heart elsewhere on the page reflects
 *   the right filled / outline state without each owning local
 *   state.
 * - Toggle is optimistic; on backend failure the store rolls the
 *   set back and we surface a toast.
 */
export function HeartButton({
  kind,
  id,
  size = "sm",
  className,
  label,
}: Props) {
  const token = useAuth((s) => s.token);
  const stored = useLocation((s) => s.location);
  const hydrate = useWishlist((s) => s.hydrate);
  const contains = useWishlist((s) =>
    kind === "item" ? !!s.items[id] : !!s.stores[id],
  );
  const pending = useWishlist((s) => !!s.pending[`${kind}-${id}`]);
  const toggleItem = useWishlist((s) => s.toggleItem);
  const toggleStore = useWishlist((s) => s.toggleStore);

  // Hydrate once when we have both a token + a zone in the URL we
  // can scope the fetch to. The store's own hydrated flag prevents
  // re-fires.
  useEffect(() => {
    if (!token) return;
    const zoneIds =
      stored?.zoneCheck && stored.zoneCheck.status === "in-zone"
        ? stored.zoneCheck.zoneIds
        : [];
    if (zoneIds.length === 0) return;
    hydrate(zoneIds);
  }, [token, stored, hydrate]);

  if (!token) return null;

  const subject = label ?? (kind === "item" ? "this item" : "this shop");

  async function handleClick(e: React.MouseEvent) {
    // Heart buttons often sit inside Links — stop the navigation.
    e.preventDefault();
    e.stopPropagation();
    const res =
      kind === "item" ? await toggleItem(id) : await toggleStore(id);
    if (!res.ok) {
      toast.error(res.message || "Couldn't update your wishlist.");
      return;
    }
    // No success toast — the heart fill flip is enough feedback.
  }

  const dim = size === "md" ? "h-11 w-11" : "h-8 w-8";
  const iconSize = size === "md" ? 18 : 14;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={
        contains
          ? `Remove ${subject} from your wishlist`
          : `Add ${subject} to your wishlist`
      }
      aria-pressed={contains}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white shadow-sm transition-colors",
        "hover:border-brand-red",
        contains ? "text-brand-red" : "text-ink-400",
        dim,
        className,
      )}
    >
      {pending ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        <Heart
          size={iconSize}
          strokeWidth={1.8}
          fill={contains ? "currentColor" : "none"}
        />
      )}
    </button>
  );
}
