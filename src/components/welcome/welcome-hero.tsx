"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { AddressPicker } from "@/components/address/address-picker";
import type { DeliveryLocation } from "@/lib/location-store";

/**
 * V0 splash hero. Dark background, serif headline, address picker.
 *
 * Once the user picks an address, we show a "Got it — we're checking
 * your area" confirmation block. The actual zone-detect call against
 * /api/v1/config/zone-list is the next slice — for now we just
 * persist the location and acknowledge it.
 */
export function WelcomeHero() {
  const t = useTranslations("welcome");
  const [picked, setPicked] = useState<DeliveryLocation | null>(null);

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

          {picked ? (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-left text-sm text-white/90 backdrop-blur">
              <p className="font-medium">Got it — checking your area</p>
              <p className="mt-1 text-white/65">
                {picked.formattedAddress}
              </p>
              <p className="mt-3 inline-flex items-center gap-1 text-white/55">
                Zone & store availability coming in the next release{" "}
                <ArrowRight size={14} strokeWidth={2} />
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-white/55">
              {t("signInHint")}
            </p>
          )}
        </div>

        <ComingSoonPanel message={t("comingSoon")} />
      </Container>
    </section>
  );
}

function ComingSoonPanel({ message }: { message: string }) {
  return (
    <div className="mt-6 w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-5 text-sm text-white/65 backdrop-blur">
      <p className="font-semibold uppercase tracking-[0.18em] text-white/55">
        V0 — Foundation
      </p>
      <p className="mt-2 leading-relaxed">{message}</p>
    </div>
  );
}
