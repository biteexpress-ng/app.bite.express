import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { SignUpFlow } from "@/components/auth/signup-flow";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function SignUpPage() {
  return (
    <section className="aurora-bg relative isolate py-16 md:py-24">
      <Container size="prose">
        <header className="fade-up mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-200 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700 backdrop-blur">
            Get started
          </span>
          <h1 className="mt-5 font-serif text-display-lg tracking-[-0.02em] text-ink-900 md:text-display-xl">
            Create your{" "}
            <span
              className="italic bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #ff7a47 0%, #de1600 80%)",
              }}
            >
              BiteExpress
            </span>{" "}
            account
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-600">
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
