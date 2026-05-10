"use client";

import { FormatText } from "@/lib/format-text";

interface TrendStats {
  recentAvg: number;
  priorAvg: number;
  ratio: number;
}

interface InsightSummarySectionProps {
  keyword: string;
  summary: string;
  mindset: string;
  newsCount: number;
  videosCount: number;
  commentsCount: number;
  trendLength: number;
  trendStats: TrendStats | null;
}

export function InsightSummarySection({
  keyword,
  summary,
  mindset,
  newsCount,
  videosCount,
  commentsCount,
  trendLength,
  trendStats,
}: InsightSummarySectionProps) {
  const ratioColor =
    trendStats && trendStats.ratio >= 1.5
      ? "var(--md-error)"
      : trendStats && trendStats.ratio <= 0.7
        ? "#1565C0"
        : "var(--md-on-surface)";

  return (
    <section className="m3-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="m3-label-sm">키워드</span>
          <span className="m3-chip-primary text-sm">
            {keyword}
          </span>
        </div>
        <div className="flex items-center gap-3 m3-body-sm">
          <span title="네이버 뉴스 + 블로그 검색 API" className="flex items-center gap-1">
            <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>newspaper</span> 네이버 {newsCount}
          </span>
          <span title="YouTube Data API v3 검색 결과" className="flex items-center gap-1">
            <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>smart_display</span> YouTube {videosCount}
          </span>
          <span title="각 영상 상위 댓글 수집" className="flex items-center gap-1">
            <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>chat</span> 댓글 {commentsCount}
          </span>
          <span title="네이버 데이터랩 검색어 트렌드" className="flex items-center gap-1">
            <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>show_chart</span> 트렌드 {trendLength}p
          </span>
        </div>
      </div>
      <h2 className="mt-3 text-xl font-bold leading-relaxed" style={{ color: "var(--md-on-surface)" }}>
        <FormatText text={summary} />
      </h2>
      <div className="mt-3 rounded-xl p-3 text-sm italic flex items-start gap-2" style={{ background: "var(--md-surface-container-low)", color: "var(--md-on-surface-variant)" }}>
        <span className="m3-icon-sm shrink-0" style={{ color: "var(--md-primary)" }}>psychology</span>
        <span><b style={{ color: "var(--md-on-surface)" }}>사람들의 마음</b>: {mindset}</span>
      </div>

      {trendStats && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs sm:gap-3 sm:text-sm">
          <div className="rounded-xl p-3" style={{ background: "var(--md-surface-container-low)" }}>
            <div className="m3-body-sm">최근 7일 평균</div>
            <div className="mt-1 text-lg font-bold tabular-nums" style={{ color: "var(--md-on-surface)" }}>
              {trendStats.recentAvg.toFixed(1)}
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--md-surface-container-low)" }}>
            <div className="m3-body-sm">직전 30일 평균</div>
            <div className="mt-1 text-lg font-bold tabular-nums" style={{ color: "var(--md-on-surface)" }}>
              {trendStats.priorAvg.toFixed(1)}
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--md-surface-container-low)" }}>
            <div className="m3-body-sm">급등 배수</div>
            <div
              className="mt-1 text-lg font-bold tabular-nums"
              style={{ color: ratioColor }}
            >
              x{trendStats.ratio.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
