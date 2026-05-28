import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { ModulePicker } from "@/components/browse/module-picker";
import { CrossModuleSearch } from "@/components/browse/cross-module-search";

export const metadata: Metadata = {
  title: "Browse",
};

export default function BrowsePage() {
  return (
    <section className="aurora-bg relative isolate py-12 md:py-16">
      <Container>
        <header className="fade-up mb-8 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-200 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700 backdrop-blur">
            For you
          </span>
          <h1 className="mt-4 font-serif text-display-lg text-ink-900 md:text-display-xl">
            What are you in the mood for?
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600 md:text-lg">
            Pick a category to see the shops delivering to you right now — or
            search across everything in your area.
          </p>
        </header>

        <CrossModuleSearch className="mb-10" />

        <ModulePicker />
      </Container>
    </section>
  );
}
