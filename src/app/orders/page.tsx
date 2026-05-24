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
    <section className="bg-ink-50 py-10 md:py-14">
      <Container>
        <h1 className="mb-6 font-serif text-display-md text-ink-900">
          Your orders
        </h1>
        <RouteGuard>
          <Suspense fallback={null}>
            <OrdersView />
          </Suspense>
        </RouteGuard>
      </Container>
    </section>
  );
}
