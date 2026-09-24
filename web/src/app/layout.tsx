import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { resolveLogoSrc } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell logoSrc={resolveLogoSrc()}>{children}</AppShell>
      </body>
    </html>
  );
}
