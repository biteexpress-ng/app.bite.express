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
 * Premium profile card + sign-out + quick links.
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
    <div className="fade-up space-y-5">
      {/* Identity hero card */}
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-ink-900/95 bg-canvas-darker p-7 text-white shadow-luxe sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-90"
          style={{
            background:
              "radial-gradient(36rem 22rem at 88% -10%, rgba(255,42,20,0.30), transparent 60%), radial-gradient(30rem 22rem at -10% 110%, rgba(255,107,74,0.20), transparent 60%)",
          }}
        />
        <div className="flex items-start gap-5">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-2 border-white/15 bg-white/5 text-white/90">
            {user?.image_full_url ? (
              <Image
                src={user.image_full_url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <User2 size={28} strokeWidth={1.6} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/55">
              {refreshing ? "Refreshing…" : "Signed in"}
            </p>
            <h2 className="mt-1 truncate font-serif text-2xl tracking-[-0.012em] sm:text-3xl">
              {user?.f_name
                ? `${user.f_name}${user.l_name ? ` ${user.l_name}` : ""}`
                : "Customer"}
            </h2>
          </div>
          <Link
            href="/profile/edit"
            className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-white/15 bg-white/10 px-3.5 text-xs font-medium text-white backdrop-blur transition-all hover:border-white/30 hover:bg-white/15"
          >
            <Pencil size={12} />
            Edit
          </Link>
        </div>

        <dl className="mt-7 grid gap-3 sm:grid-cols-2">
          <ContactRow icon={<Phone size={14} />} label="Phone" value={user?.phone} />
          <ContactRow icon={<Mail size={14} />} label="Email" value={user?.email} />
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Tile
          href="/wallet"
          icon={<Wallet size={18} />}
          title="Wallet"
          subtitle="Dedicated account & balance"
        />
        <Tile
          href="/addresses"
          icon={<MapPin size={18} />}
          title="Saved addresses"
          subtitle="Places you order to"
        />
        <Tile
          href="/wishlist"
          icon={<Heart size={18} />}
          title="Wishlist"
          subtitle="Favourited shops & items"
        />
        <Tile
          href="/profile/password"
          icon={<Lock size={18} />}
          title="Change password"
          subtitle="Pick a new sign-in password"
        />
      </div>

      <Button
        variant="outline"
        size="md"
        onClick={() => {
          resetWishlist();
          signOut();
          router.replace("/");
        }}
        className="w-full"
      >
        <LogOut size={16} />
        Sign out
      </Button>
    </div>
  );
}

function Tile({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="card-luxe group flex items-center justify-between gap-3 rounded-2xl p-5"
    >
      <span className="flex items-center gap-3">
        <span
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-brand-red"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,107,74,0.18), rgba(222,22,0,0.06))",
          }}
        >
          {icon}
        </span>
        <span>
          <span className="block text-base font-semibold tracking-[-0.005em] text-ink-900">
            {title}
          </span>
          <span className="mt-0.5 block text-xs text-ink-500">{subtitle}</span>
        </span>
      </span>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 transition-all group-hover:border-brand-red/40 group-hover:bg-brand-red group-hover:text-white">
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}

function ContactRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 backdrop-blur">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/55">
          {label}
        </p>
        <p className="truncate text-sm text-white">{value || "—"}</p>
      </div>
    </div>
  );
}
