import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { StoreDetailView } from "@/components/store/store-detail";

export const metadata: Metadata = {
  title: "Shop",
};

type Props = { params: Promise<{ id: string }> };

export default async function StoreDetailPage({ params }: Props) {
  const { id } = await params;
  const storeId = Number(id);

  if (!Number.isFinite(storeId)) {
    return (
      <section className="bg-ink-50 py-10">
        <Container>
          <p className="text-ink-700">Invalid store.</p>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container>
        <StoreDetailView storeId={storeId} />
      </Container>
    </section>
  );
}
