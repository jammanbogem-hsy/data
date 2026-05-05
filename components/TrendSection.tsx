"use client";

import { useEffect, useRef, useState } from "react";
import { TrendChart } from "./TrendChart";
import type { TrendPoint, SpikeRange } from "@/lib/spike";
import type { CorrectedPoint } from "@/lib/correction";

/* ── 상수 ──────────────────────────────────────── */
const COMPARE_PALETTE = ["#F59E0B", "#EC4899", "#8B5CF6", "#0EA5E9"];

const TIME_UNIT_LABEL: Record<string, string> = {
  date: "일간",
  week: "주간",
  month: "월간",
};

/* ── TrendChartResponsive ─────────────────────── */
function TrendChartResponsive(props: {
  series: TrendPoint[];
  spikes: SpikeRange[];
  selectedSpikeIdx: number;
  onSelectSpike: (s: SpikeRange) => void;
  raw?: boolean;
  extraSeries?: Array<{ keyword: string; series: TrendPoint[]; color: string }>;
  extraSpikes?: Array<{ keyword: string; color: string; spikes: SpikeRange[] }>;
  primaryKeyword?: string;
  onSelectExtraSpike?: (keyword: string, spike: SpikeRange) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0].contentRect.width;
      if (cw > 0) setW(Math.floor(cw));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      <TrendChart
        series={props.series}
        spikes={props.spikes}
        width={w}
        height={Math.max(200, Math.min(280, w * 0.35))}
        selectedSpikeIdx={props.selectedSpikeIdx}
        onSelectSpike={props.onSelectSpike}
        raw={props.raw}
        extraSeries={props.extraSeries}
        extraSpikes={props.extraSpikes}
        primaryKeyword={props.primaryKeyword}
        onSelectExtraSpike={props.onSelectExtraSpike}
      />
    </div>
  );
}

/* ── SpikeTab 타입 ────────────────────────────── */
export interface SpikeTab {
  key: string;
  keyword: string;
  color: string;
  spike: SpikeRange;
  isPrimary: boolean;
}

/* ── Props ─────────────────────────────────────── */
interface SpikeResultStatus {
  status: "pending" | "loading" | "done" | "error";
}

interface TrendSectionProps {
  trend: Array<{ period: string; ratio: number }>;
  multiTrend?: Array<{ keyword: string; series: Array<{ period: string; ratio: number }> }>;
  wikipediaTrend?: Array<{ keyword: string; series: Array<{ period: string; ratio: number; views: number }> }>;
  spikes: SpikeRange[];
  allSpikeTabs: SpikeTab[];
  selectedSpikeIdx: number;
  selectedTabKey: string | null;
  colorMap: Record<string, string>;
  perKeywordSpikes: Array<{ keyword: string; color: string; spikes: SpikeRange[] }>;
  correctedSeries: CorrectedPoint[];
  keyword: string;
  range?: { startDate: string; endDate: string; timeUnit: "date" | "week" | "month" };
  isNaturalPeakOnly: boolean;
  naturalPeak: SpikeRange | null;
  detectedSpikes: SpikeRange[];
  spikeResultStatuses: Record<string, SpikeResultStatus>;
  rawChart: boolean;
  showCorrected: boolean;
  setRawChart: (v: boolean) => void;
  setShowCorrected: (v: boolean) => void;
  setModalKey: (key: string) => void;
  setSelectedTabKey: (key: string) => void;
}

export function TrendSection({
  trend,
  multiTrend,
  wikipediaTrend,
  spikes,
  allSpikeTabs,
  selectedSpikeIdx,
  colorMap,
  perKeywordSpikes,
  correctedSeries,
  keyword,
  range,
  isNaturalPeakOnly,
  naturalPeak,
  detectedSpikes,
  spikeResultStatuses,
  rawChart,
  showCorrected,
  setRawChart,
  setShowCorrected,
  setModalKey,
}: TrendSectionProps) {
  if (trend.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">📈 검색 트렌드</h3>
          <p className="mt-1 text-xs text-slate-500" title="네이버 데이터랩 검색어 트렌드 API (PC+모바일 통합)">
            데이터 출처: <b>네이버 데이터랩</b> ·{" "}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800">
              {range ? TIME_UNIT_LABEL[range.timeUnit] : "?"} {trend.length}p
            </span>{" "}
            · 기간 내 최대값을 100 으로 정규화
          </p>
          {range?.timeUnit !== "date" && (
            <p className="mt-1 text-[10px] text-amber-600">
              ⚠ 현재 {TIME_UNIT_LABEL[range?.timeUnit ?? "month"]} 단위라 DataLab 공식 사이트(일간)와 모양이 다를 수 있습니다. 일간 보려면 기간을 3년 이하로 설정하세요.
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={rawChart}
            onChange={(e) => setRawChart(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          DataLab 원본 스타일
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={showCorrected}
            onChange={(e) => setShowCorrected(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          📊 보정 지수 (요일 효과 제거)
        </label>
        {allSpikeTabs.length > 0 && (
          <div className="flex max-w-full flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">
              급등 선택 ({allSpikeTabs.length}):
            </span>
            {allSpikeTabs.slice(0, 14).map((t) => {
              const status = spikeResultStatuses[t.key]?.status;
              const statusDot =
                status === "done"
                  ? "✓"
                  : status === "error"
                    ? "⚠"
                    : status === "loading" || status === "pending"
                      ? "…"
                      : "○";
              return (
                <button
                  key={t.key}
                  onClick={() => setModalKey(t.key)}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:shadow-sm"
                  style={{
                    background: `${t.color}22`,
                    color: t.color,
                  }}
                  title={`클릭하여 분석 보기 · ${t.keyword} · ${t.spike.startPeriod} ~ ${t.spike.endPeriod} (×${t.spike.multiplier.toFixed(1)})`}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: t.color }}
                  />
                  <span className="font-semibold">{t.keyword}</span>
                  <span className="opacity-80">{t.spike.peakPeriod.slice(5)}</span>
                  <span className="tabular-nums">×{t.spike.multiplier.toFixed(1)}</span>
                  <span
                    className={`ml-0.5 text-[10px] ${status === "done" ? "text-emerald-500" : status === "error" ? "text-rose-500" : "text-slate-400"}`}
                  >
                    {statusDot}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <TrendChartResponsive
        series={trend}
        spikes={spikes}
        selectedSpikeIdx={selectedSpikeIdx}
        onSelectSpike={(_sp) => {
          // 주 키워드 점/음영 클릭 시 모달 열기
          const idx = detectedSpikes.findIndex((s) => s.startPeriod === _sp.startPeriod);
          if (idx >= 0) setModalKey(`${keyword}#${idx}`);
        }}
        onSelectExtraSpike={(kw, sp) => {
          // 비교 키워드 점 클릭 시 모달 열기
          const match = perKeywordSpikes.find((p) => p.keyword === kw);
          if (!match) return;
          const idx = match.spikes.findIndex((s) => s.startPeriod === sp.startPeriod);
          if (idx >= 0) setModalKey(`${kw}#${idx}`);
        }}
        raw={rawChart}
        primaryKeyword={keyword}
        extraSeries={[
          // 보정 지수 시리즈 (토글 ON 시)
          ...(showCorrected
            ? [{
                keyword: `📊 ${keyword} 보정`,
                series: correctedSeries.map((p) => ({ period: p.period, ratio: p.corrected })),
                color: "#A855F7",
                dashed: true,
              }]
            : []),
          // 비교 키워드 DataLab 시리즈
          ...(multiTrend ?? [])
            .filter((t) => t.keyword !== keyword)
            .map((t, i) => ({
              keyword: t.keyword,
              series: t.series,
              color: COMPARE_PALETTE[i % COMPARE_PALETTE.length],
              dashed: false,
            })),
          // Wikipedia 조회수 (점선, 회색, 보조)
          ...(wikipediaTrend ?? []).map((w) => ({
            keyword: `📖 ${w.keyword}`,
            series: w.series,
            color: "#6B7280",
            dashed: true,
          })),
        ]}
        extraSpikes={perKeywordSpikes}
      />
      {/* 다중 키워드 + Wikipedia 범례 */}
      {((multiTrend && multiTrend.length > 1) ||
        (wikipediaTrend && wikipediaTrend.length > 0)) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-500">범례:</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-green-500" />
            <b>{keyword}</b> (주·DataLab)
          </span>
          {(multiTrend ?? [])
            .filter((t) => t.keyword !== keyword)
            .map((t, i) => (
              <span key={t.keyword} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-5"
                  style={{ background: COMPARE_PALETTE[i % COMPARE_PALETTE.length] }}
                />
                {t.keyword}
              </span>
            ))}
          {(wikipediaTrend ?? []).map((w) => (
            <span key={`wiki-${w.keyword}`} className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-5"
                style={{
                  background:
                    "repeating-linear-gradient(to right, #6B7280 0, #6B7280 4px, transparent 4px, transparent 7px)",
                }}
              />
              📖 wiki:{w.keyword}
            </span>
          ))}
        </div>
      )}
      {isNaturalPeakOnly && (
        <p className="mt-2 text-center text-xs text-blue-500">
          📌 이동평균 돌파형 급등은 없지만, 전체에서 가장 높았던 <b>{naturalPeak!.peakPeriod}</b> 구간을 자동 분석합니다 (평균 대비 ×{naturalPeak!.multiplier.toFixed(1)})
        </p>
      )}
      {spikes.length === 0 && (
        <p className="mt-2 text-center text-xs text-slate-400">
          이 기간에는 뚜렷한 피크가 감지되지 않았습니다.
        </p>
      )}
    </section>
  );
}
