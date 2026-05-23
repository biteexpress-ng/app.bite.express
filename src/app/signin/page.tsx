import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInFlow } from "@/components/auth/signin-flow";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <section className="bg-ink-50 py-16 md:py-24">
      <Container size="prose">
        <header className="mb-8 text-center">
          <h1 className="text-display-md font-serif text-ink-900">
            Sign in to <span className="italic text-brand-red">BiteExpress</span>
          </h1>
          <p className="mt-3 text-base text-ink-600">
            Enter your phone number — we'll send a 6-digit code to verify.
          </p>
        </header>

        {/* SignInFlow reads `useSearchParams()` for the post-login redirect
            target. Next 16 requires that to be inside a Suspense boundary
            so the page can still prerender statically. */}
        <Suspense fallback={null}>
          <SignInFlow />
        </Suspense>
      </Container>
    </section>
  );
}
