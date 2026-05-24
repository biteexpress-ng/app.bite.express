import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { OrderSuccess } from "@/components/checkout/order-success";

export const metadata: Metadata = {
  title: "Order placed",
};

export default function CheckoutSuccessPage() {
  return (
    <section className="bg-ink-50 py-12 md:py-20">
      <Container size="prose">
        <Suspense fallback={null}>
          <OrderSuccess />
        </Suspense>
      </Container>
    </section>
  );
}
