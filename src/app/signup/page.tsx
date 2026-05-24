import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { SignUpFlow } from "@/components/auth/signup-flow";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function SignUpPage() {
  return (
    <section className="bg-ink-50 py-16 md:py-24">
      <Container size="prose">
        <header className="mb-8 text-center">
          <h1 className="text-display-md font-serif text-ink-900">
            Create your <span className="italic text-brand-red">BiteExpress</span>{" "}
            account
          </h1>
          <p className="mt-3 text-base text-ink-600">
            We just need a few details to get you ordering.
          </p>
        </header>
        <Suspense fallback={null}>
          <SignUpFlow />
        </Suspense>
      </Container>
    </section>
  );
}
