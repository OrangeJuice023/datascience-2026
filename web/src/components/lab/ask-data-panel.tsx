"use client";

import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SignalBadge } from "@/components/ui/signal-badge";
import { DEMO_SIGNALS } from "@/data/demo-signals";
import { formatSignedPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

const DEFAULT_PROMPT =
  "Show dengue signals in LGUs that exceeded their historical baseline.";

const DEMO_QUERY = `-- Example only. Not executed against real data.
select disease, location_name, signal_level, change_percent
from signals
where disease = 'Dengue'
  and signal_level > expected_baseline
order by change_percent desc;`;

export function AskDataPanel() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [hasRun, setHasRun] = useState(false);
  const [showQuery, setShowQuery] = useState(false);

  const results = DEMO_SIGNALS.filter(
    (s) => s.disease === "Dengue" && s.signalLevel > 1,
  )
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-slate-900">Ask the data</h2>
        <StatusBadge label="Demo interaction" tone="warning" />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Describe what you want to see. This first phase does not query a live
        backend — it previews how a future natural-language-to-query workflow
        could work.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="ask-data-prompt" className="sr-only">
          Question for the data
        </label>
        <input
          id="ask-data-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button onClick={() => setHasRun(true)}>Analyze</Button>
      </div>

      {hasRun && (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
            <StatusBadge label="Demo result" tone="warning" />
            <button
              type="button"
              onClick={() => setShowQuery((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              aria-expanded={showQuery}
            >
              View generated query
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  showQuery && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
          </div>

          {showQuery && (
            <pre className="overflow-x-auto border-b border-slate-200 bg-slate-900 px-3 py-3 text-[11px] leading-relaxed text-slate-100">
              {DEMO_QUERY}
            </pre>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Signal</th>
                  <th className="px-3 py-2">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((result) => (
                  <tr key={result.id}>
                    <td className="px-3 py-2 text-slate-700">
                      {result.locationName}
                    </td>
                    <td className="px-3 py-2">
                      <SignalBadge status={result.status} />
                    </td>
                    <td className="px-3 py-2 tabular-nums text-rose-700">
                      {formatSignedPercent(result.changePercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-400">
            Illustrative demo result generated from static sample data — not a
            live query.
          </p>
        </div>
      )}
    </Card>
  );
}
