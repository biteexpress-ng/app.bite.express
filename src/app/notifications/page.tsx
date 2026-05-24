import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { NotificationsList } from "@/components/notifications/notifications-list";

export const metadata: Metadata = {
  title: "Notifications",
};

export default function NotificationsPage() {
  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container size="narrow">
        <Link
          href="/profile"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={14} /> Back to profile
        </Link>
        <h1 className="mb-6 font-serif text-display-md text-ink-900">
          Notifications
        </h1>
        <RouteGuard>
          <NotificationsList />
        </RouteGuard>
      </Container>
    </section>
  );
}
