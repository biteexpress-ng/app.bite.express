import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { OrderSuccess } from "@/components/checkout/order-success";

export const metadata: Metadata = {
  title: "Order placed",
};

export default function CheckoutSuccessPage() {
  return (
    <section className="aurora-bg relative isolate py-16 md:py-24">
      <Container size="narrow">
        <Suspense fallback={null}>
          <OrderSuccess />
        </Suspense>
      </Container>
    </section>
  );
}
