import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { TransferInstructions } from "@/components/checkout/transfer-instructions";

export const metadata: Metadata = {
  title: "Finish your transfer",
};

type Props = { params: Promise<{ orderId: string }> };

export default async function TransferPage({ params }: Props) {
  const { orderId } = await params;
  const id = Number(orderId);

  if (!Number.isFinite(id)) {
    return (
      <section className="bg-ink-50 py-10">
        <Container size="prose">
          <p className="text-ink-700">Invalid order.</p>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container size="prose">
        <RouteGuard>
          <Suspense fallback={null}>
            <TransferInstructions orderId={id} />
          </Suspense>
        </RouteGuard>
      </Container>
    </section>
  );
}
