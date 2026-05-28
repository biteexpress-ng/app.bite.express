import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";
import { StoreList } from "@/components/browse/store-list";
import { StoreSearch } from "@/components/browse/store-search";

export const metadata: Metadata = {
  title: "Browse",
};

type Props = {
  params: Promise<{ moduleId: string }>;
};

/**
 * The module name itself isn't rendered server-side — the modules
 * list is a client-fetched payload (zone-scoped), so it would be
 * wasteful to re-fetch on the server just for the header. The page
 * shows "Shops" generically and the back link, then hydrates.
 *
 * In Next 16 dynamic-segment params are always async.
 */
export default async function ModuleStoreListPage({ params }: Props) {
  const { moduleId } = await params;
  const id = Number(moduleId);

  if (!Number.isFinite(id)) {
    return (
      <section className="aurora-bg py-12">
        <Container>
          <p className="text-ink-700">Invalid module.</p>
        </Container>
      </section>
    );
  }

  return (
    <section className="aurora-bg relative isolate py-12 md:py-16">
      <Container>
        <Link
          href="/browse"
          className="mb-5 inline-flex items-center gap-1.5 rounded-pill border border-ink-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-ink-700 backdrop-blur transition-colors hover:border-brand-red/30 hover:text-brand-red"
        >
          <ArrowLeft size={13} /> All categories
        </Link>

        <header className="fade-up mb-8 max-w-3xl">
          <h1 className="font-serif text-display-lg text-ink-900 md:text-display-xl">
            Shops near you
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600 md:text-lg">
            Sorted by distance from your delivery address.
          </p>
        </header>

        <StoreSearch moduleId={id} className="mb-8" />

        <StoreList moduleId={id} />
      </Container>
    </section>
  );
}
