import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "G.YM",
    short_name: "G.YM",
    description: "Allenamenti, progressi e livelli di forza.",
    start_url: "/home",
    display: "standalone",
    background_color: "#0f1114",
    theme_color: "#0f1114",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
