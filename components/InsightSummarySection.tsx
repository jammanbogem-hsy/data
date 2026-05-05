"use client";

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
  return (
    <section className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 dark:border-blue-900 dark:from-blue-950 dark:to-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">키워드</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
            {keyword}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span title="네이버 뉴스 + 블로그 검색 API">📰 네이버 {newsCount}</span>
          <span title="YouTube Data API v3 검색 결과">🎬 YouTube {videosCount}</span>
          <span title="각 영상 상위 댓글 수집">💬 댓글 {commentsCount}</span>
          <span title="네이버 데이터랩 검색어 트렌드">📊 트렌드 {trendLength}p</span>
        </div>
      </div>
      <h2 className="mt-3 text-xl font-bold leading-relaxed text-slate-900 dark:text-slate-100">
        {summary}
      </h2>
      <p className="mt-3 rounded-lg bg-white/60 p-3 text-sm italic text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
        💭 <b>사람들의 마음</b>: {mindset}
      </p>

      {trendStats && (
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
            <div className="text-xs text-slate-500">최근 7일 평균</div>
            <div className="mt-1 text-lg font-bold tabular-nums">
              {trendStats.recentAvg.toFixed(1)}
            </div>
          </div>
          <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
            <div className="text-xs text-slate-500">직전 30일 평균</div>
            <div className="mt-1 text-lg font-bold tabular-nums">
              {trendStats.priorAvg.toFixed(1)}
            </div>
          </div>
          <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
            <div className="text-xs text-slate-500">급등 배수</div>
            <div
              className={`mt-1 text-lg font-bold tabular-nums ${
                trendStats.ratio >= 1.5
                  ? "text-orange-500"
                  : trendStats.ratio <= 0.7
                    ? "text-rose-500"
                    : "text-slate-700 dark:text-slate-200"
              }`}
            >
              ×{trendStats.ratio.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
