// A small graph over a range of days: bars (one per day), a line, dots, and an optional dashed goal line.

import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import type { Point } from '../lib/body';
import { addDays, daysBetween, shortDate, type DateKey } from '../lib/dates';
import { C, T } from '../theme';

export type Bar = Point & { color?: string };

// The web preview would otherwise draw the labels in a serif font; the iPhone uses its system font anyway.
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, sans-serif' : undefined;

function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

export function Chart({
  from,
  to,
  bars,
  line,
  dots,
  goal,
  color,
  faintDots,
  height = 220,
  format = (v) => String(Math.round(v * 10) / 10),
}: {
  from: DateKey;
  to: DateKey;
  bars?: Bar[];
  line?: Point[];
  dots?: Point[];
  goal?: number;
  color: string;
  faintDots?: boolean; // the dots sit behind a smoothed line
  height?: number;
  format?: (v: number) => string;
}) {
  const [width, setWidth] = useState(0);
  const inRange = <P extends Point>(ps: P[] | undefined): P[] => (ps ?? []).filter((p) => p.date >= from && p.date <= to);
  const b = inRange(bars);
  const l = inRange(line);
  const d = inRange(dots);
  const values = [...b, ...l, ...d].map((p) => p.value);

  if (values.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={T.muted}>Nothing logged in this period yet.</Text>
      </View>
    );
  }

  // The up-and-down scale: from zero for bars, snug around the values for lines.
  if (goal !== undefined) values.push(goal);
  let lo = b.length > 0 ? 0 : Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    hi += 1;
    lo = Math.max(0, lo - 1);
  }
  const step = niceStep((hi - lo) / 3);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000);

  // As in Apple Health: the scale on the right, dashed grid lines.
  const L = 6;
  const R = 44;
  const TOP = 10;
  const BOTTOM = 24;
  const days = Math.max(1, daysBetween(from, to));
  const barW = Math.max(2, Math.min(18, ((width - L - R) / (days + 1)) * 0.7));
  const inset = b.length > 0 ? barW / 2 + 2 : 5;
  const plotW = Math.max(1, width - L - R - inset * 2);
  const plotH = height - TOP - BOTTOM;
  const x = (date: DateKey) => L + inset + (plotW * daysBetween(from, date)) / days;
  const y = (v: number) => TOP + plotH * (1 - (v - lo) / (hi - lo));
  const mid = Math.floor(days / 2);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <React.Fragment key={t}>
              <Line x1={L} x2={width - R + 4} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} strokeDasharray={t === lo ? undefined : [3, 3]} />
              <SvgText fontFamily={FONT} x={width - R + 10} y={y(t) + 4} fill={C.muted} fontSize={11} textAnchor="start">
                {format(t)}
              </SvgText>
            </React.Fragment>
          ))}

          {b.map((p) => (
            <Rect
              key={p.date}
              x={x(p.date) - barW / 2}
              y={y(p.value)}
              width={barW}
              height={Math.max(1, y(lo) - y(p.value))}
              rx={Math.min(4, barW / 2)}
              fill={p.color ?? color}
            />
          ))}

          {goal !== undefined ? (
            <Line
              x1={L}
              x2={width - R}
              y1={y(goal)}
              y2={y(goal)}
              stroke={C.text}
              strokeOpacity={0.7}
              strokeWidth={1.5}
              strokeDasharray={[6, 4]}
            />
          ) : null}

          {l.length > 1 ? (
            <Polyline
              points={l.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {d.map((p) => (
            <Circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={d.length > 60 ? 2 : 3.5} fill={color} fillOpacity={faintDots ? 0.45 : 1} />
          ))}

          <SvgText fontFamily={FONT} x={L + inset} y={height - 6} fill={C.muted} fontSize={11} textAnchor="start">
            {shortDate(from)}
          </SvgText>
          {days >= 6 ? (
            <SvgText fontFamily={FONT} x={L + inset + plotW / 2} y={height - 6} fill={C.muted} fontSize={11} textAnchor="middle">
              {shortDate(addDays(from, mid))}
            </SvgText>
          ) : null}
          <SvgText fontFamily={FONT} x={width - R - inset} y={height - 6} fill={C.muted} fontSize={11} textAnchor="end">
            {shortDate(to)}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}
