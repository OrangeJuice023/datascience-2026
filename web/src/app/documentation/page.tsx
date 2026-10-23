import type { Metadata } from "next";

import { DocumentationView } from "./documentation-view";

export const metadata: Metadata = {
  title: "API documentation — SIGMA",
  description:
    "The SIGMA public-health intelligence API: endpoints, parameters, response envelopes, data statuses and limits.",
};

/**
 * GET /documentation
 *
 * The human-readable reference for the API. It renders from the same registry
 * that the `GET /api/v1` index is generated from, so the two cannot drift.
 */
export default function DocumentationPage() {
  return <DocumentationView />;
}
