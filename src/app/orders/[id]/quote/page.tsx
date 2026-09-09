import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { QuoteReview } from "@/components/orders/quote-review";

export const metadata: Metadata = {
  title: "Confirm prices",
};

type Props = { params: Promise<{ id: string }> };

export default async function OrderQuotePage({ params }: Props) {
  const { id } = await params;
  const orderId = Number(id);

  if (!Number.isFinite(orderId)) {
    return (
      <section className="bg-ink-50 py-10">
        <Container>
          <p className="text-ink-700">Invalid order.</p>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container>
        <Link
          href={`/orders/${orderId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={14} /> Back to the order
        </Link>
        <RouteGuard>
          <QuoteReview orderId={orderId} />
        </RouteGuard>
      </Container>
    </section>
  );
}
