import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

// next/font self-hosts the files and generates size-matched fallbacks, so the
// swap to the web fonts doesn't shift text (CLS stays at 0).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Matchday", template: "%s · Matchday" },
  description: "A prototype fixtures and results page built for match-day traffic.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AU"
      className={`${fraunces.variable} ${manrope.variable} ${plexMono.variable} antialiased`}
    >
      <body className="min-h-screen">
        <div className="blob" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[1360px] px-5 md:px-10">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-5">
            <span className="font-display text-2xl font-semibold tracking-tight">Matchday</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill pill--static">Prototype</span>
              <span className="pill pill--static">Live data · ESPN feed</span>
            </div>
          </header>
          <main className="pb-24">{children}</main>
        </div>
      </body>
    </html>
  );
}
