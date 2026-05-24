import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { OrderDetailView } from "@/components/orders/order-detail-view";

export const metadata: Metadata = {
  title: "Order",
};

type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Props) {
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
          href="/orders"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={14} /> All orders
        </Link>
        <RouteGuard>
          <OrderDetailView orderId={orderId} />
        </RouteGuard>
      </Container>
    </section>
  );
}
