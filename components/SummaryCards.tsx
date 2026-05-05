"use client";

import type { SummaryMetrics } from "@/lib/correction";

export function SummaryCards({ metrics, keyword }: { metrics: SummaryMetrics; keyword: string }) {
  const changeColor =
    metrics.recentChangePercent >= 20
      ? "var(--md-error)"
      : metrics.recentChangePercent >= 0
        ? "var(--md-primary)"
        : "#1565C0";
  const changeArrow = metrics.recentChangePercent >= 0 ? "arrow_upward" : "arrow_downward";

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {/* 카드 1: 주요 소스 */}
      <div className="m3-card flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}
        >
          <span className="m3-icon">newspaper</span>
        </div>
        <div>
          <div className="m3-label-sm">언급 가장 많은 채널</div>
          <div className="mt-0.5 text-lg font-bold" style={{ color: "var(--md-primary)" }}>
            {metrics.dominantSource}
          </div>
          <div className="m3-body-sm">{metrics.dominantSourceCount}건 수집</div>
        </div>
      </div>

      {/* 카드 2: 피크 날짜 */}
      <div className="m3-card flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "var(--md-primary-dark)", color: "var(--md-on-primary)" }}
        >
          <span className="m3-icon">calendar_today</span>
        </div>
        <div>
          <div className="m3-label-sm">검색 가장 많았던 날</div>
          <div className="mt-0.5 text-lg font-bold" style={{ color: "#F57F17" }}>
            {metrics.peakDate}
          </div>
          <div className="m3-body-sm">
            {metrics.peakWeekday}요일이 평균 높음 ({metrics.peakWeekdayAvg.toFixed(1)})
          </div>
        </div>
      </div>

      {/* 카드 3: 전월 대비 */}
      <div className="m3-card flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "var(--md-primary-light)", color: "var(--md-on-primary)" }}
        >
          <span className="m3-icon">{changeArrow}</span>
        </div>
        <div>
          <div className="m3-label-sm">최근 30일 vs 직전 30일</div>
          <div className="mt-0.5 text-lg font-bold" style={{ color: changeColor }}>
            {metrics.recentChangePercent >= 0 ? "+" : ""}{Math.abs(metrics.recentChangePercent).toFixed(1)}%
          </div>
          <div className="m3-body-sm">
            평균 {metrics.avgRatio} · 보정 {metrics.recentCorrectedAvg}
          </div>
        </div>
      </div>
    </div>
  );
}
