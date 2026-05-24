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
          <div className="space-y-6">
            <VirtualAccountCard />

            <div className="rounded-3xl border border-ink-200 bg-white p-6 text-sm text-ink-600 shadow-soft sm:p-8">
              <p className="font-medium text-ink-900">
                Wallet payments & transaction history
              </p>
              <p className="mt-1">
                Coming in the next release — for now, top up via your DVA and
                use Cash on Delivery at checkout.
              </p>
            </div>
          </div>
        </RouteGuard>
      </Container>
    </section>
  );
}
