import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { SendParcelFlow } from "@/components/parcel/send-parcel-flow";

export const metadata: Metadata = {
  title: "Send a parcel",
};

export default function SendPage() {
  return (
    <section className="aurora-bg relative isolate py-12 md:py-16">
      <Container>
        <header className="fade-up mb-8">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-200 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700 backdrop-blur">
            Parcel
          </span>
          <h1 className="mt-4 font-serif text-display-lg text-ink-900 md:text-display-xl">
            Send a parcel
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600 md:text-lg">
            A rider collects it and drops it across town. You see the full price before you pay.
          </p>
        </header>
        <RouteGuard>
          <SendParcelFlow />
        </RouteGuard>
      </Container>
    </section>
  );
}
