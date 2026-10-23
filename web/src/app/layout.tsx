import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { BootSplash } from "@/components/entry/boot-splash";
import { resolveLogoSrc } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** The 8-bit face, used only on the boot splash and the landing page. */
const pixelify = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
});

/**
 * Runs before first paint: a visitor who already saw the splash or pressed
 * start this session gets the app at once, with no flash of either screen.
 */
const ENTRY_SCRIPT = `try{var s=sessionStorage,d=document.documentElement.dataset;if(s.getItem("sigma-booted"))d.sigmaBooted="1";if(s.getItem("sigma-entered"))d.sigmaEntered="1"}catch(e){}`;

export const metadata: Metadata = {
  title: "SIGMA — Spatial Intelligence & Geographic Modeling for Action",
  description:
    "Scaffold for a public-health intelligence and scenario-analysis platform.",
};

// Explicit props rather than the generated LayoutProps global: CI runs
// `tsc --noEmit` before `next build`, when .next/types does not exist yet.
export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${pixelify.variable} h-full antialiased`}
      // The entry script sets data attributes on <html> before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ENTRY_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <BootSplash />
        <AppShell logoSrc={resolveLogoSrc()}>{children}</AppShell>
      </body>
    </html>
  );
}
