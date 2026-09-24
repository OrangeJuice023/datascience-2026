"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { SelectFilter } from "@/components/ui/select-filter";
import { ComparisonChart } from "@/components/charts/comparison-chart";
import { DEMO_LGUS, getLguById } from "@/data/demo-lgus";
import { DEMO_DISEASES, getSignal } from "@/data/demo-signals";
import { getTrendSeries } from "@/data/demo-trends";
import { SignalBadge } from "@/components/ui/signal-badge";
import { formatSignedPercent } from "@/lib/utils";
import type { LGU, Signal, TrendPoint } from "@/types";

export function ComparisonTab({
  lgu,
  signal,
  trend,
}: {
  lgu: LGU;
  signal: Signal;
  trend: TrendPoint[];
}) {
  const otherLgus = DEMO_LGUS.filter((l) => l.id !== lgu.id);
  const [compareLocationId, setCompareLocationId] = useState(otherLgus[0]?.id ?? "");
  const [compareDisease, setCompareDisease] = useState(signal.disease);

  const compareLgu = getLguById(compareLocationId);
  const compareSignal = compareLgu ? getSignal(compareDisease, compareLgu.id) : undefined;
  const compareTrend = compareLgu ? getTrendSeries(compareLgu.id) : [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <SelectFilter
          label="Compare with LGU"
          value={compareLocationId}
          onChange={setCompareLocationId}
          options={otherLgus.map((l) => ({ value: l.id, label: l.name }))}
        />
        <SelectFilter
          label="Disease/Event"
          value={compareDisease}
          onChange={setCompareDisease}
          options={DEMO_DISEASES.map((d) => ({ value: d, label: d }))}
        />
      </Card>

      {compareLgu ? (
        <>
          <Card className="p-4">
            <p className="mb-1 text-xs font-semibold text-slate-600">
              {lgu.name} vs {compareLgu.name}
            </p>
            <p className="mb-2 text-[11px] text-slate-400">
              Observed signal, demo data
            </p>
            <ComparisonChart
              seriesA={trend}
              seriesB={compareTrend}
              labelA={lgu.name}
              labelB={compareLgu.name}
            />
          </Card>

          <Card className="overflow-x-auto p-4">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="py-2">Metric</th>
                  <th className="py-2">{lgu.name}</th>
                  <th className="py-2">{compareLgu.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 text-slate-500">Signal status</td>
                  <td className="py-2">
                    <SignalBadge status={signal.status} />
                  </td>
                  <td className="py-2">
                    {compareSignal ? (
                      <SignalBadge status={compareSignal.status} />
                    ) : (
                      <span className="text-slate-400">No demo signal</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Baseline deviation</td>
                  <td className="py-2 tabular-nums text-slate-700">
                    {formatSignedPercent(signal.changePercent)}
                  </td>
                  <td className="py-2 tabular-nums text-slate-700">
                    {compareSignal ? formatSignedPercent(compareSignal.changePercent) : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Signal volume (sources)</td>
                  <td className="py-2 tabular-nums text-slate-700">{signal.sourceCount}</td>
                  <td className="py-2 tabular-nums text-slate-700">
                    {compareSignal ? compareSignal.sourceCount : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Source diversity (confidence)</td>
                  <td className="py-2 capitalize text-slate-700">{signal.confidence}</td>
                  <td className="py-2 capitalize text-slate-700">
                    {compareSignal ? compareSignal.confidence : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center text-sm text-slate-400">
          Select an LGU to compare.
        </Card>
      )}
    </div>
  );
}
