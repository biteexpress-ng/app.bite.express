import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInFlow } from "@/components/auth/signin-flow";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <section className="aurora-bg relative isolate py-16 md:py-24">
      <Container size="prose">
        <header className="fade-up mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-200 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700 backdrop-blur">
            Welcome back
          </span>
          <h1 className="mt-5 font-serif text-display-lg tracking-[-0.02em] text-ink-900 md:text-display-xl">
            Sign in to{" "}
            <span
              className="italic bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #ff7a47 0%, #de1600 80%)",
              }}
            >
              BiteExpress
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-600">
            Enter your phone number — we'll send a 6-digit code to verify.
          </p>
        </header>

        <Suspense fallback={null}>
          <SignInFlow />
        </Suspense>
      </Container>
    </section>
  );
}
