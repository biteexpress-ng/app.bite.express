import { DM_Sans, DM_Serif_Display } from "next/font/google";

export const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});
