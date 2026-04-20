"use client";

import type { SummaryMetrics } from "@/lib/correction";

const SOURCE_ICON: Record<string, string> = {
  "네이버 뉴스": "📰",
  YouTube: "🎬",
  블로그: "📝",
};

export function SummaryCards({ metrics, keyword }: { metrics: SummaryMetrics; keyword: string }) {
  const changeColor =
    metrics.recentChangePercent >= 20
      ? "text-rose-600"
      : metrics.recentChangePercent >= 0
        ? "text-emerald-600"
        : "text-blue-600";
  const changeArrow = metrics.recentChangePercent >= 0 ? "▲" : "▼";

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {/* 카드 1: 주요 소스 */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-2xl dark:bg-violet-900">
          {SOURCE_ICON[metrics.dominantSource] ?? "📊"}
        </div>
        <div>
          <div className="text-xs text-slate-500">언급 가장 많은 채널</div>
          <div className="text-lg font-bold text-violet-700 dark:text-violet-300">
            {metrics.dominantSource}
          </div>
          <div className="text-xs text-slate-400">{metrics.dominantSourceCount}건 수집</div>
        </div>
      </div>

      {/* 카드 2: 피크 날짜 */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl dark:bg-amber-900">
          📅
        </div>
        <div>
          <div className="text-xs text-slate-500">검색 가장 많았던 날</div>
          <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
            {metrics.peakDate}
          </div>
          <div className="text-xs text-slate-400">
            ratio {metrics.peakRatio.toFixed(1)} · {metrics.peakWeekday}요일이 평균 높음 ({metrics.peakWeekdayAvg.toFixed(1)})
          </div>
        </div>
      </div>

      {/* 카드 3: 전월 대비 변화율 */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900">
          📈
        </div>
        <div>
          <div className="text-xs text-slate-500">최근 30일 vs 직전 30일</div>
          <div className={`text-lg font-bold ${changeColor}`}>
            {changeArrow} {Math.abs(metrics.recentChangePercent).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400">
            평균 {metrics.avgRatio} · 보정 지수 {metrics.recentCorrectedAvg}
          </div>
        </div>
      </div>
    </div>
  );
}
