import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { formatCount } from '@/components/format';
import { useTheme } from '@/hooks/use-theme';

/** Round axis maximum and ticks (1, 2, 2.5 or 5 x 10^n steps). */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v));
  return ticks;
}

/**
 * Weekly line chart. A week with no record (null) breaks the line: the gap
 * is visible, and nothing is drawn at zero for it.
 */
export function WeeklyLineChart({
  points,
  height = 190,
  accessibilityLabel,
}: {
  points: { periodStart: string; value: number | null }[];
  height?: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const pad = { left: 46, right: 8, top: 8, bottom: 22 };

  const chart = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const max = Math.max(...points.map((p) => p.value ?? 0));
    const ticks = niceTicks(max);
    const top = ticks[ticks.length - 1] || 1;
    const t0 = Date.parse(points[0].periodStart);
    const t1 = Date.parse(points[points.length - 1].periodStart);
    const span = Math.max(t1 - t0, 1);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const x = (iso: string) => pad.left + ((Date.parse(iso) - t0) / span) * plotW;
    const y = (v: number) => pad.top + plotH - (v / top) * plotH;
    let d = '';
    let pen = false;
    for (const p of points) {
      if (p.value === null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(p.periodStart).toFixed(1)} ${y(p.value).toFixed(1)}`;
      pen = true;
    }
    const years: { label: string; x: number }[] = [];
    const firstYear = new Date(t0).getUTCFullYear();
    const lastYear = new Date(t1).getUTCFullYear();
    // A year starts at 1 January, or at the first week when the series begins in that year's first fortnight.
    const FORTNIGHT = 14 * 86_400_000;
    for (let yr = firstYear; yr <= lastYear; yr++) {
      const t = Math.max(Date.UTC(yr, 0, 1), t0);
      if (t - Date.UTC(yr, 0, 1) <= FORTNIGHT && t <= t1) years.push({ label: String(yr), x: x(new Date(t).toISOString().slice(0, 10)) });
    }
    return { d, ticks, y, years, plotW };
  }, [width, points, height, pad.left, pad.right, pad.top, pad.bottom]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={accessibilityLabel}>
      {chart ? (
        <Svg width={width} height={height}>
          {chart.ticks.map((t) => (
            <G key={t}>
              <Line x1={pad.left} x2={width - pad.right} y1={chart.y(t)} y2={chart.y(t)} stroke={theme.grid} strokeWidth={1} />
              <SvgText x={pad.left - 6} y={chart.y(t) + 4} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                {formatCount(t)}
              </SvgText>
            </G>
          ))}
          {chart.years.map((yr) => (
            <G key={yr.label}>
              <Line x1={yr.x} x2={yr.x} y1={pad.top} y2={height - pad.bottom} stroke={theme.grid} strokeWidth={1} />
              <SvgText x={yr.x} y={height - 6} fontSize={11} fill={theme.textSecondary} textAnchor="middle">
                {yr.label}
              </SvgText>
            </G>
          ))}
          <Path d={chart.d} stroke={theme.brand} strokeWidth={2} fill="none" strokeLinejoin="round" />
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

type DonutSegment = { key: string; value: number; color: string; hollow?: boolean };

/** SVG arcs for the non-empty segments, clockwise from 12 o'clock. */
export function donutArcs(segments: DonutSegment[], total: number, c: number, r: number): (DonutSegment & { d: string })[] {
  const out: (DonutSegment & { d: string })[] = [];
  let angle = -Math.PI / 2;
  const p = (a: number) => `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
  for (const s of segments) {
    if (s.value <= 0) continue;
    const sweep = (s.value / total) * Math.PI * 2;
    const a0 = angle;
    angle += sweep;
    const d =
      sweep >= Math.PI * 2 - 1e-6
        ? `M${p(a0)}A${r} ${r} 0 1 1 ${p(a0 + Math.PI)}A${r} ${r} 0 1 1 ${p(a0)}`
        : `M${p(a0)}A${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${p(angle)}`;
    out.push({ ...s, d });
  }
  return out;
}

/** A donut of counts, segments separated by a 2px gap, total in the middle. */
export function Donut({
  segments,
  size = 120,
  centerLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  centerLabel: string;
}) {
  const theme = useTheme();
  const total = segments.reduce((s, x) => s + x.value, 0);
  const stroke = size * 0.16;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const arcs = donutArcs(segments, total, c, r);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {total === 0 ? <Circle cx={c} cy={c} r={r} stroke={theme.grid} strokeWidth={stroke} fill="none" /> : null}
        {arcs.map((a) => (
          <G key={a.key}>
            <Path d={a.d} stroke={theme.backgroundElement} strokeWidth={stroke + 2} fill="none" />
            <Path d={a.d} stroke={a.color} strokeWidth={stroke} fill="none" strokeDasharray={a.hollow ? '3 3' : undefined} />
          </G>
        ))}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.total, { color: theme.text }]}>{formatCount(total)}</Text>
        <Text style={[styles.centerLabel, { color: theme.textSecondary }]}>{centerLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  total: { fontSize: 24, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  centerLabel: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
});
