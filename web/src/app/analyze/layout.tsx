import type { ReactNode } from "react";
import { AnalyzeTabs } from "@/components/layout/analyze-tabs";
import { ACCESS_REFERENCE } from "@/lib/access/reference";
import { accessReadiness } from "@/lib/access/readiness";

/** Analyze: ACCESS, Policy and Lab under one secondary navigation. */
export default function AnalyzeLayout({ children }: { children: ReactNode }) {
  const { ready } = accessReadiness(ACCESS_REFERENCE);
  return (
    <>
      <AnalyzeTabs accessReady={ready} />
      {children}
    </>
  );
}
