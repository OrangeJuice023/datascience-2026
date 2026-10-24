import { redirect } from "next/navigation";
import { ACCESS_REFERENCE } from "@/lib/access/reference";
import { accessReadiness } from "@/lib/access/readiness";

/** /analyze opens the first available subtab: ACCESS once it is ready, otherwise Policy. */
export default function AnalyzePage() {
  const { ready } = accessReadiness(ACCESS_REFERENCE);
  redirect(ready ? "/analyze/access" : "/analyze/policy");
}
