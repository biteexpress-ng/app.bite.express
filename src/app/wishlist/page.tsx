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
    <section className="bg-ink-50 py-10 md:py-14">
      <Container>
        <Link
          href="/profile"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={14} /> Back to profile
        </Link>
        <h1 className="mb-6 font-serif text-display-md text-ink-900">
          Wishlist
        </h1>
        <RouteGuard>
          <WishlistView />
        </RouteGuard>
      </Container>
    </section>
  );
}
