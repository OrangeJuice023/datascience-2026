import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lab, Policy and ACCESS moved under Analyze; Simulate was removed. The old
  // addresses keep working for bookmarks and shared links.
  async redirects() {
    return [
      { source: "/lab", destination: "/analyze/lab", permanent: false },
      { source: "/policy", destination: "/analyze/policy", permanent: false },
      { source: "/access", destination: "/analyze/access", permanent: false },
      { source: "/simulate", destination: "/analyze", permanent: false },
    ];
  },
};

export default nextConfig;
