import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";
import { StoreList } from "@/components/browse/store-list";

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
      <section className="bg-ink-50 py-10">
        <Container>
          <p className="text-ink-700">Invalid module.</p>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container>
        <Link
          href="/browse"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={14} /> All categories
        </Link>

        <header className="mb-8">
          <h1 className="font-serif text-display-md text-ink-900">
            Shops near you
          </h1>
          <p className="mt-2 text-ink-600">
            Sorted by distance from your delivery address.
          </p>
        </header>

        <StoreList moduleId={id} />
      </Container>
    </section>
  );
}
