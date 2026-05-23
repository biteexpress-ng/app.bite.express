import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { ModulePicker } from "@/components/browse/module-picker";

export const metadata: Metadata = {
  title: "Browse",
};

export default function BrowsePage() {
  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container>
        <header className="mb-8">
          <h1 className="font-serif text-display-md text-ink-900">
            What are you in the mood for?
          </h1>
          <p className="mt-2 max-w-2xl text-ink-600">
            Pick a category to see the shops delivering to you right now.
          </p>
        </header>
        <ModulePicker />
      </Container>
    </section>
  );
}
