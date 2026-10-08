import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "G.YM", template: "%s · G.YM" },
  description: "Allenamenti, progressi e livelli di forza.",
  applicationName: "G.YM",
  appleWebApp: { capable: true, title: "G.YM", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1114",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const raw = jar.get("ghisa_theme")?.value;
  const theme = raw === "light" || raw === "system" ? raw : "dark";
  return (
    <html lang="it" data-theme={theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
