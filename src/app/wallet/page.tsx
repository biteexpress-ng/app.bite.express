import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { VirtualAccountCard } from "@/components/wallet/virtual-account-card";

export const metadata: Metadata = {
  title: "Wallet",
};

export default function WalletPage() {
  return (
    <section className="bg-ink-50 py-12 md:py-16">
      <Container size="narrow">
        <header className="mb-6">
          <h1 className="font-serif text-display-md text-ink-900">
            Your wallet
          </h1>
          <p className="mt-2 text-ink-600">
            Top up by transferring to your dedicated account, then pay for
            orders straight from your wallet balance.
          </p>
        </header>

        <RouteGuard>
          <VirtualAccountCard />
        </RouteGuard>
      </Container>
    </section>
  );
}
