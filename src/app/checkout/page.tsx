import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export const metadata: Metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container>
        <h1 className="mb-6 font-serif text-display-md text-ink-900">
          Checkout
        </h1>
        <CheckoutFlow />
      </Container>
    </section>
  );
}
