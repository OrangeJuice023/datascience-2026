import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import type { ProjectedMap } from '@/api/geo';
import { useTheme } from '@/hooks/use-theme';

/**
 * The 126 reporting units as a map: neutral polygons, one marker per unit at
 * its label point. Colour (signal class) and size (reported cases) live on
 * the markers only. Following docs/geo/spatial-assessment-and-method.md §5,
 * areas are never filled by counts, and a unit with no result is drawn
 * hollow, never as the lowest class.
 */

export interface UnitMarker {
  id: string;
  color: string;
  radius: number;
  hollow?: boolean;
}

const ZOOMS = [1, 1.6, 2.6, 4, 6];
const NICE_KM = [25, 50, 100, 200, 300, 500];

export function UnitMap({
  map,
  markers,
  selectedId,
  onSelect,
  height,
  interactive = true,
  legend,
}: {
  map: ProjectedMap;
  markers: UnitMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height: number;
  interactive?: boolean;
  legend?: React.ReactNode;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const zoom = ZOOMS[zoomIndex];

  // Fit the whole archipelago into the box at zoom 1.
  const fit = width > 0 ? Math.min(width / map.width, height / map.height) : 1;
  const pxPerUnit = fit * zoom;
  const baseX = (width - map.width * fit) / 2;
  const baseY = (height - map.height * fit) / 2;

  // Drag to pan once zoomed in; at zoom 1 the whole country fits, and a drag
  // scrolls the page instead. A short tap still reaches polygons and markers.
  const pan = usePanGesture({
    enabled: interactive && zoomIndex > 0,
    minDistance: 5,
    runOnJS: true,
    onUpdate: (e) => setOffset((o) => ({ x: o.x + e.changeX, y: o.y + e.changeY })),
  });

  const zoomTo = (next: number) => {
    const i = Math.max(0, Math.min(ZOOMS.length - 1, next));
    const ratio = ZOOMS[i] / zoom;
    // Keep the box centre where it is.
    const cx = width / 2 - baseX - offset.x;
    const cy = height / 2 - baseY - offset.y;
    setOffset({ x: offset.x - cx * (ratio - 1), y: offset.y - cy * (ratio - 1) });
    setZoomIndex(i);
  };
  const reset = () => {
    setZoomIndex(0);
    setOffset({ x: 0, y: 0 });
  };

  // The longest round distance that fits in a third of the box.
  const scaleKm = [...NICE_KM].reverse().find((km) => km * map.unitsPerKm * pxPerUnit <= width * 0.32) ?? NICE_KM[0];
  const scalePx = scaleKm * map.unitsPerKm * pxPerUnit;
  const markerScale = Math.sqrt(zoom);

  return (
    <GestureDetector gesture={pan}>
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <G transform={`translate(${baseX + offset.x} ${baseY + offset.y}) scale(${pxPerUnit})`}>
            {map.units.map((u) => (
              <Path
                key={u.id}
                d={u.d}
                fill={u.id === selectedId ? theme.brand : theme.land}
                fillOpacity={u.id === selectedId ? 0.35 : 1}
                stroke={theme.backgroundElement}
                strokeWidth={0.6 / pxPerUnit}
                onPress={interactive && onSelect ? () => onSelect(u.id) : undefined}
              />
            ))}
            {markers.map((m) => {
              const u = map.units.find((x) => x.id === m.id);
              if (!u || m.radius <= 0) return null;
              const r = (m.radius * markerScale) / pxPerUnit;
              return (
                <Circle
                  key={m.id}
                  cx={u.center[0]}
                  cy={u.center[1]}
                  r={r}
                  fill={m.hollow ? theme.backgroundElement : m.color}
                  fillOpacity={m.hollow ? 1 : 0.92}
                  stroke={m.hollow ? m.color : theme.backgroundElement}
                  strokeWidth={(m.hollow ? 1.6 : 1.2) / pxPerUnit}
                  onPress={interactive && onSelect ? () => onSelect(m.id) : undefined}
                />
              );
            })}
          </G>
          {interactive ? (
            <G>
              <Line x1={width - 12 - scalePx} x2={width - 12} y1={height - 14} y2={height - 14} stroke={theme.text} strokeWidth={1.5} />
              <Line x1={width - 12 - scalePx} x2={width - 12 - scalePx} y1={height - 19} y2={height - 9} stroke={theme.text} strokeWidth={1.5} />
              <Line x1={width - 12} x2={width - 12} y1={height - 19} y2={height - 9} stroke={theme.text} strokeWidth={1.5} />
              <SvgText x={width - 12} y={height - 24} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                {`${scaleKm} km`}
              </SvgText>
            </G>
          ) : null}
        </Svg>
      ) : null}

      {interactive ? (
        <View style={styles.controls}>
          <MapButton icon="plus" label="Zoom in" onPress={() => zoomTo(zoomIndex + 1)} />
          <MapButton icon="minus" label="Zoom out" onPress={() => zoomTo(zoomIndex - 1)} />
          <View style={{ height: 8 }} />
          <MapButton icon="crosshairs-gps" label="Show the whole country" onPress={reset} />
        </View>
      ) : null}
      {legend ? (
        <View style={[styles.legend, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>{legend}</View>
      ) : null}
    </View>
    </GestureDetector>
  );
}

function MapButton({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <MaterialCommunityIcons name={icon} size={24} color={theme.text} />
    </Pressable>
  );
}

export function MapCaption({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.caption, { color: theme.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  controls: { position: 'absolute', left: 0, top: 4, gap: 4 },
  button: { width: 46, height: 46, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  legend: { position: 'absolute', right: 0, top: 4, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  caption: { fontSize: 13, lineHeight: 18 },
});

