import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Cart",
};

export default function CartPage() {
  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container size="narrow">
        <h1 className="mb-6 font-serif text-display-md text-ink-900">
          Your cart
        </h1>
        <CartView />
      </Container>
    </section>
  );
}
