import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export const metadata: Metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
  return (
    <section className="aurora-bg relative isolate py-12 md:py-16">
      <Container>
        <header className="fade-up mb-8">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-200 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700 backdrop-blur">
            Checkout
          </span>
          <h1 className="mt-4 font-serif text-display-lg text-ink-900 md:text-display-xl">
            Finalize your order
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600 md:text-lg">
            Confirm your delivery address and payment to place your order.
          </p>
        </header>
        <CheckoutFlow />
      </Container>
    </section>
  );
}
