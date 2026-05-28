import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { WishlistView } from "@/components/wishlist/wishlist-view";

export const metadata: Metadata = {
  title: "Wishlist",
};

export default function WishlistPage() {
  return (
    <section className="aurora-bg relative isolate py-12 md:py-16">
      <Container>
        <Link
          href="/profile"
          className="mb-5 inline-flex items-center gap-1.5 rounded-pill border border-ink-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-ink-700 backdrop-blur transition-colors hover:border-brand-red/30 hover:text-brand-red"
        >
          <ArrowLeft size={13} /> Back to profile
        </Link>
        <header className="fade-up mb-8">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-200 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700 backdrop-blur">
            Wishlist
          </span>
          <h1 className="mt-4 font-serif text-display-lg text-ink-900 md:text-display-xl">
            Your wishlist
          </h1>
        </header>
        <RouteGuard>
          <WishlistView />
        </RouteGuard>
      </Container>
    </section>
  );
}
