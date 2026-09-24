import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

const CANDIDATES = ["sigma-logo.svg", "sigma-logo.png", "sigma-logo.webp"];

/**
 * Public URL of the SIGMA logo if one has been added to web/public/brand/,
 * else null. Resolved on the server so a missing file never renders as a
 * broken image.
 */
export function resolveLogoSrc(): string | null {
  const found = CANDIDATES.find((file) =>
    existsSync(join(process.cwd(), "public", "brand", file)),
  );
  return found ? `/brand/${found}` : null;
}
