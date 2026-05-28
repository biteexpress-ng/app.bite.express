import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { OrdersView } from "@/components/orders/orders-view";

export const metadata: Metadata = {
  title: "Your orders",
};

export default function OrdersPage() {
  return (
    <section className="aurora-bg relative isolate py-12 md:py-16">
      <Container>
        <header className="fade-up mb-8">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-200 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700 backdrop-blur">
            Orders
          </span>
          <h1 className="mt-4 font-serif text-display-lg text-ink-900 md:text-display-xl">
            Your orders
          </h1>
        </header>
        <RouteGuard>
          <Suspense fallback={null}>
            <OrdersView />
          </Suspense>
        </RouteGuard>
      </Container>
    </section>
  );
}
