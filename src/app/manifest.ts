import type { MetadataRoute } from "next";

/** Makes the web app installable, which is what lets iPhone users get push. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BiteExpress",
    short_name: "BiteExpress",
    description: "Order food, groceries and more, delivered fast.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#de1600",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
