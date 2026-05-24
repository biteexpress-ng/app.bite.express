"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Phone,
  Mail,
  User2,
  Wallet,
  MapPin,
  ArrowRight,
  Pencil,
  Lock,
  Heart,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { fetchProfile } from "@/lib/api/auth";
import { useWishlist } from "@/lib/wishlist-store";
import { Button } from "@/components/ui/button";

/**
 * Profile read-only card + sign-out.
 *
 * Re-fetches /api/v1/customer/info on mount so we display the freshest
 * data (the locally-cached AuthUser may be stale if the user edited
 * their profile from the mobile app since their last visit).
 *
 * Mutating profile fields lives in the next slice.
 */
export function ProfileCard() {
  const router = useRouter();
  const cachedUser = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);
  const resetWishlist = useWishlist((s) => s.reset);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    fetchProfile().then((res) => {
      if (cancelled) return;
      if (res.ok) setUser(res.user);
      setRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const user = cachedUser;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-100 text-ink-700">
            {user?.image_full_url ? (
              <Image
                src={user.image_full_url}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <User2 size={22} strokeWidth={1.8} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-medium text-ink-900">
              {user?.f_name
                ? `${user.f_name}${user.l_name ? ` ${user.l_name}` : ""}`
                : "Customer"}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {refreshing ? "Refreshing…" : "Signed in"}
            </p>
          </div>
          <Link
            href="/profile/edit"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 px-3 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            <Pencil size={12} />
            Edit
          </Link>
        </div>

        <dl className="mt-6 divide-y divide-ink-200/70 border-t border-ink-200/70 text-sm">
          <Row icon={<Phone size={16} />} label="Phone" value={user?.phone} />
          <Row icon={<Mail size={16} />} label="Email" value={user?.email} />
        </dl>
      </div>

      <Link
        href="/wallet"
        className="flex items-center justify-between gap-3 rounded-3xl border border-ink-200 bg-white p-5 shadow-soft transition-shadow hover:shadow-elevated"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
            <Wallet size={18} />
          </span>
          <span>
            <span className="block text-base font-medium text-ink-900">
              Wallet
            </span>
            <span className="block text-xs text-ink-500">
              See your dedicated account & balance
            </span>
          </span>
        </span>
        <ArrowRight size={16} className="text-ink-400" />
      </Link>

      <Link
        href="/addresses"
        className="flex items-center justify-between gap-3 rounded-3xl border border-ink-200 bg-white p-5 shadow-soft transition-shadow hover:shadow-elevated"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
            <MapPin size={18} />
          </span>
          <span>
            <span className="block text-base font-medium text-ink-900">
              Saved addresses
            </span>
            <span className="block text-xs text-ink-500">
              Add or edit the places you order to
            </span>
          </span>
        </span>
        <ArrowRight size={16} className="text-ink-400" />
      </Link>

      <Link
        href="/wishlist"
        className="flex items-center justify-between gap-3 rounded-3xl border border-ink-200 bg-white p-5 shadow-soft transition-shadow hover:shadow-elevated"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
            <Heart size={18} />
          </span>
          <span>
            <span className="block text-base font-medium text-ink-900">
              Wishlist
            </span>
            <span className="block text-xs text-ink-500">
              Favourited shops & items
            </span>
          </span>
        </span>
        <ArrowRight size={16} className="text-ink-400" />
      </Link>

      <Link
        href="/profile/password"
        className="flex items-center justify-between gap-3 rounded-3xl border border-ink-200 bg-white p-5 shadow-soft transition-shadow hover:shadow-elevated"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
            <Lock size={18} />
          </span>
          <span>
            <span className="block text-base font-medium text-ink-900">
              Change password
            </span>
            <span className="block text-xs text-ink-500">
              Pick a new password for sign-in
            </span>
          </span>
        </span>
        <ArrowRight size={16} className="text-ink-400" />
      </Link>

      <Button
        variant="outline"
        size="md"
        onClick={() => {
          // Clear the per-user wishlist cache so the next signed-in
          // user doesn't briefly see the previous customer's hearts
          // flashed in before their own list hydrates.
          resetWishlist();
          signOut();
          router.replace("/");
        }}
      >
        <LogOut size={16} />
        Sign out
      </Button>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-ink-500">{icon}</span>
      <dt className="w-20 text-ink-500">{label}</dt>
      <dd className="flex-1 text-ink-900">{value || "—"}</dd>
    </div>
  );
}
