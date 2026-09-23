"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Bike, ShieldCheck, Clock } from "lucide-react";
import { Container } from "@/components/ui/container";
import { AddressPicker } from "@/components/address/address-picker";
import { ZoneResult } from "./zone-result";
import { useLocation, type DeliveryLocation } from "@/lib/location-store";

/**
 * Premium welcome / splash hero.
 *
 * Cinematic obsidian backdrop with red neon orbs and a soft spotlight
 * that tracks the cursor. Serif display headline, frosted address
 * picker, three trust pills. Once the user picks an address we hand
 * off to <ZoneResult />.
 */
export function WelcomeHero() {
  const t = useTranslations("welcome");
  const stored = useLocation((s) => s.location);
  const hydrate = useLocation((s) => s.hydrate);
  const [picked, setPicked] = useState<DeliveryLocation | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const handler = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--mx", `${mx}%`);
      el.style.setProperty("--my", `${my}%`);
    };
    el.addEventListener("pointermove", handler);
    return () => el.removeEventListener("pointermove", handler);
  }, []);

  const active = picked ?? stored;

  return (
    <section
      ref={heroRef}
      className="hero-radial-bg relative isolate overflow-hidden"
    >
      <div className="spotlight" aria-hidden />

      {/* Subtle grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(60% 60% at 50% 30%, #000 30%, transparent 80%)",
        }}
      />

      <Container className="relative flex flex-col items-center gap-10 py-24 text-center sm:py-32 md:py-40">
        <span className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur-md">
          <Sparkles size={12} className="text-brand-orange" />
          {t("eyebrow")}
        </span>

        <h1 className="rise font-serif text-5xl leading-[1.02] tracking-[-0.02em] text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]">
          {t("titleA")}{" "}
          <span className="relative inline-block italic">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #ff7a47 0%, #ff3d20 55%, #ff2a14 100%)",
              }}
            >
              {t("titleEmphasised")}
            </span>
          </span>{" "}
          {t("titleB")}
        </h1>

        <p
          className="rise max-w-2xl text-balance text-base leading-relaxed text-white/70 sm:text-lg"
          style={{ animationDelay: "120ms" }}
        >
          {t("subtitle")}
        </p>

        <div
          className="rise relative z-10 w-full max-w-xl"
          style={{ animationDelay: "220ms" }}
        >
          <div className="rounded-pill p-[1px]" style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.04) 35%, rgba(255,42,20,0.32))",
          }}>
            <AddressPicker
              variant="dark"
              onPick={setPicked}
              showCurrentLocation
            />
          </div>
          {active && <ZoneResult location={active} />}
        </div>

        <div
          className="rise flex flex-wrap items-center justify-center gap-2 pt-2 sm:gap-3"
          style={{ animationDelay: "340ms" }}
        >
          <TrustPill icon={<Bike size={13} />} label="Live tracking" />
          <TrustPill icon={<Clock size={13} />} label="Avg. 32-min arrival" />
          <TrustPill icon={<ShieldCheck size={13} />} label="Secure payments" />
        </div>
      </Container>

      {/* Bottom edge softener */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
        style={{
          background:
            "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))",
        }}
      />
    </section>
  );
}

function TrustPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur-md">
      <span className="text-brand-orange">{icon}</span>
      {label}
    </span>
  );
}
