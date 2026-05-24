import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { ModulePicker } from "@/components/browse/module-picker";
import { CrossModuleSearch } from "@/components/browse/cross-module-search";

export const metadata: Metadata = {
  title: "Browse",
};

export default function BrowsePage() {
  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container>
        <header className="mb-6">
          <h1 className="font-serif text-display-md text-ink-900">
            What are you in the mood for?
          </h1>
          <p className="mt-2 max-w-2xl text-ink-600">
            Pick a category to see the shops delivering to you right now — or
            search across everything in your area.
          </p>
        </header>

        <CrossModuleSearch className="mb-8" />

        <ModulePicker />
      </Container>
    </section>
  );
}
