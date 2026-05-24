"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { AddressPicker } from "@/components/address/address-picker";
import { ZoneResult } from "./zone-result";
import { useLocation, type DeliveryLocation } from "@/lib/location-store";

/**
 * Welcome / splash hero. Dark background, serif headline, address
 * picker. Once the user picks an address we hand off to <ZoneResult />,
 * which calls /api/v1/config/get-zone-id and shows one of:
 *   - in-zone CTA -> /browse
 *   - out-of-zone notify-me capture
 *   - temp-unavailable notify-me capture
 *   - soft error / skipped
 *
 * Returning visitors see their last picked address rehydrated from
 * localStorage.
 */
export function WelcomeHero() {
  const t = useTranslations("welcome");
  const stored = useLocation((s) => s.location);
  const hydrate = useLocation((s) => s.hydrate);
  const [picked, setPicked] = useState<DeliveryLocation | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const active = picked ?? stored;

  return (
    <section className="hero-radial-bg relative isolate overflow-hidden">
      <Container className="flex flex-col items-center gap-10 py-24 text-center sm:py-32 md:py-40">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur">
          {t("eyebrow")}
        </span>

        <h1 className="font-serif text-4xl leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-[4.5rem]">
          {t("titleA")}{" "}
          <span className="italic text-brand-orange">
            {t("titleEmphasised")}
          </span>{" "}
          {t("titleB")}
        </h1>

        <p className="max-w-2xl text-balance text-base leading-relaxed text-white/75 sm:text-lg">
          {t("subtitle")}
        </p>

        <div className="w-full max-w-xl">
          <AddressPicker variant="dark" onPick={setPicked} />
          {active && <ZoneResult location={active} />}
        </div>
      </Container>
    </section>
  );
}
