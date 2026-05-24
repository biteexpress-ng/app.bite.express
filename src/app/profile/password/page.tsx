import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

export const metadata: Metadata = {
  title: "Change password",
};

export default function ChangePasswordPage() {
  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container size="prose">
        <Link
          href="/profile"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={14} /> Back to profile
        </Link>
        <h1 className="mb-6 font-serif text-display-md text-ink-900">
          Change your password
        </h1>
        <RouteGuard>
          <ChangePasswordForm />
        </RouteGuard>
      </Container>
    </section>
  );
}
