"use client";

import dynamic from "next/dynamic";
import type { TrendPoint, SpikeRange } from "@/lib/spike";

const TrendChartInternal = dynamic(
  () => import("./TrendChart").then((mod) => ({ default: mod.TrendChart })),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-m3-md"
        style={{ height: 240, background: "var(--md-surface-container-high)" }}
      >
        <span className="m3-body-sm" style={{ color: "var(--md-on-surface-variant)" }}>
          차트 로딩 중...
        </span>
      </div>
    ),
  }
);

export function TrendChartLazy(props: {
  series: TrendPoint[];
  spikes: SpikeRange[];
  width?: number;
  height?: number;
  onSelectSpike?: (spike: SpikeRange) => void;
  selectedSpikeIdx?: number;
  raw?: boolean;
  extraSeries?: Array<{ keyword: string; series: TrendPoint[]; color: string; dashed?: boolean }>;
  extraSpikes?: Array<{ keyword: string; color: string; spikes: SpikeRange[] }>;
  primaryKeyword?: string;
  onSelectExtraSpike?: (keyword: string, spike: SpikeRange) => void;
}) {
  return <TrendChartInternal {...props} />;
}
