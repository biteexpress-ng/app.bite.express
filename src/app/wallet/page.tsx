import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { VirtualAccountCard } from "@/components/wallet/virtual-account-card";

export const metadata: Metadata = {
  title: "Wallet",
};

export default function WalletPage() {
  return (
    <section className="aurora-bg relative isolate py-12 md:py-16">
      <Container size="narrow">
        <header className="fade-up mb-8">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-200 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700 backdrop-blur">
            Wallet
          </span>
          <h1 className="mt-4 font-serif text-display-lg text-ink-900 md:text-display-xl">
            Your wallet
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-600 md:text-lg">
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
