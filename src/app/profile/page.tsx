import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { ProfileCard } from "@/components/profile/profile-card";

export const metadata: Metadata = {
  title: "Your profile",
};

export default function ProfilePage() {
  return (
    <section className="bg-ink-50 py-12 md:py-16">
      <Container size="narrow">
        <h1 className="mb-6 font-serif text-display-md text-ink-900">
          Your profile
        </h1>
        <RouteGuard>
          <ProfileCard />
        </RouteGuard>
      </Container>
    </section>
  );
}
