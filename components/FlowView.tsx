"use client";

import { useMemo } from "react";
import { Group } from "@visx/group";
import { scaleLinear, scaleTime, scaleOrdinal } from "@visx/scale";
import { AreaStack } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import type { KeywordDaily } from "@shared/schema";

type Series = Record<string, KeywordDaily[]>;

const PALETTE = [
  "#3b82f6", "#f97316", "#10b981", "#a855f7", "#ec4899",
  "#eab308", "#06b6d4", "#f43f5e", "#8b5cf6", "#14b8a6",
  "#f59e0b", "#64748b",
];

export function FlowView({ series }: { series: Series }) {
  const width = 1000;
  const height = 420;
  const margin = { top: 16, right: 16, bottom: 40, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const keywords = Object.keys(series);

  // 날짜 축: 모든 날짜 유니온
  const { data, dates, maxStack } = useMemo(() => {
    const allDates = new Set<string>();
    Object.values(series).forEach((rows) =>
      rows.forEach((r) => allDates.add(r.date))
    );
    const dates = Array.from(allDates).sort();

    const data = dates.map((d) => {
      const row: Record<string, number | string> = { date: d };
      for (const kw of keywords) {
        const hit = series[kw].find((r) => r.date === d);
        row[kw] = hit?.count ?? 0;
      }
      return row;
    });

    const maxStack = data.reduce((mx, row) => {
      const sum = keywords.reduce((s, kw) => s + ((row[kw] as number) ?? 0), 0);
      return Math.max(mx, sum);
    }, 0);

    return { data, dates, maxStack };
  }, [series, keywords]);

  const xScale = scaleTime<number>({
    domain: [new Date(dates[0] ?? "2026-01-01"), new Date(dates[dates.length - 1] ?? "2026-01-02")],
    range: [0, innerW],
  });
  const yScale = scaleLinear<number>({
    domain: [0, Math.max(maxStack, 10)],
    range: [innerH, 0],
  });
  const color = scaleOrdinal<string, string>({
    domain: keywords,
    range: PALETTE,
  });

  if (keywords.length === 0 || dates.length < 2) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm" style={{ borderColor: "var(--md-outline)", color: "var(--md-on-surface-variant)" }}>
        시계열 데이터가 부족합니다. 며칠 더 수집하면 표시됩니다.
      </p>
    );
  }

  return (
    <div className="m3-card">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="키워드 트렌드">
        <Group left={margin.left} top={margin.top}>
          <AreaStack
            keys={keywords}
            data={data as any}
            x={(d) => xScale(new Date((d.data as { date: string }).date)) ?? 0}
            y0={(d) => yScale(d[0]) ?? 0}
            y1={(d) => yScale(d[1]) ?? 0}
          >
            {({ stacks, path }) =>
              stacks.map((stack) => {
                const totalCount = data.reduce(
                  (s, row) => s + ((row[stack.key] as number) ?? 0),
                  0
                );
                return (
                  <path
                    key={stack.key}
                    d={path(stack) || ""}
                    fill={color(stack.key)}
                    fillOpacity={0.85}
                    stroke="white"
                    strokeWidth={0.5}
                    style={{ cursor: "pointer" }}
                  >
                    <title>
                      {`${stack.key} · 누적 ${totalCount.toLocaleString()}회`}
                    </title>
                  </path>
                );
              })
            }
          </AreaStack>
          <AxisLeft scale={yScale} stroke="#94a3b8" tickStroke="#94a3b8" tickLabelProps={() => ({ fill: "#64748b", fontSize: 10 })} />
          <AxisBottom
            top={innerH}
            scale={xScale}
            stroke="#94a3b8"
            tickStroke="#94a3b8"
            tickLabelProps={() => ({ fill: "#64748b", fontSize: 10, textAnchor: "middle" })}
          />
        </Group>
      </svg>

      <div className="mt-3 flex flex-wrap gap-2">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="m3-chip text-xs"
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: color(kw) }} />
            {kw}
          </span>
        ))}
      </div>
    </div>
  );
}
