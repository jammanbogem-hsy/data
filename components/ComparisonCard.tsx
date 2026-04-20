"use client";

export interface ComparisonInsight {
  summary: string;
  peakComparison: Array<{
    keyword: string;
    peakPeriod: string;
    peakRatio: number;
    avgRatio: number;
    dominantSeason: string;
  }>;
  commonThemes: string[];
  differences: Array<{ aspect: string; description: string }>;
  recommendation: string;
}

const SEASON_ICON: Record<string, string> = {
  여름: "☀️",
  겨울: "❄️",
  봄: "🌸",
  가을: "🍁",
  연중: "🔁",
  없음: "•",
};

export function ComparisonCard({
  data,
  keywords,
  primaryKeyword,
  colors,
}: {
  data: ComparisonInsight;
  keywords: string[];
  primaryKeyword: string;
  colors: Record<string, string>;
}) {
  return (
    <section className="rounded-xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-5 dark:border-purple-800 dark:from-purple-950 dark:to-pink-950">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-purple-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
          🔀 비교 분석
        </span>
        <span className="text-xs text-purple-800 dark:text-purple-300">
          {keywords.length}개 키워드 동시 분석
        </span>
      </div>

      {/* 종합 요약 */}
      <div className="mb-4 rounded-lg bg-white/70 p-3 text-sm leading-relaxed text-slate-900 dark:bg-slate-900/60 dark:text-slate-100">
        <span className="mr-1 font-semibold text-purple-700 dark:text-purple-300">한 줄 요약</span>
        {data.summary}
      </div>

      {/* 피크 비교 테이블 */}
      {data.peakComparison?.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
            키워드별 통계
          </h4>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-purple-200 dark:border-purple-800">
                <th className="p-2 text-left text-slate-600 dark:text-slate-400">키워드</th>
                <th className="p-2 text-center text-slate-600 dark:text-slate-400">평균</th>
                <th className="p-2 text-center text-slate-600 dark:text-slate-400">최고</th>
                <th className="p-2 text-left text-slate-600 dark:text-slate-400">피크 날짜</th>
                <th className="p-2 text-center text-slate-600 dark:text-slate-400">주요 시즌</th>
              </tr>
            </thead>
            <tbody>
              {data.peakComparison.map((pc) => (
                <tr key={pc.keyword} className="border-b border-purple-100 dark:border-purple-900">
                  <td className="p-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: colors[pc.keyword] ?? "#94a3b8" }}
                    />
                    <span className="ml-2 font-semibold text-slate-900 dark:text-slate-100">
                      {pc.keyword}
                    </span>
                    {pc.keyword === primaryKeyword && (
                      <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
                        주
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center tabular-nums text-slate-700 dark:text-slate-300">
                    {pc.avgRatio?.toFixed?.(1) ?? "?"}
                  </td>
                  <td className="p-2 text-center tabular-nums font-bold text-slate-900 dark:text-slate-100">
                    {pc.peakRatio}
                  </td>
                  <td className="p-2 font-mono text-slate-600 dark:text-slate-400">
                    {pc.peakPeriod}
                  </td>
                  <td className="p-2 text-center">
                    <span className="text-base">{SEASON_ICON[pc.dominantSeason] ?? "·"}</span>
                    <span className="ml-1 text-slate-700 dark:text-slate-300">
                      {pc.dominantSeason}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 공통 주제 + 차이점 */}
      <div className="grid gap-3 md:grid-cols-2">
        {data.commonThemes?.length > 0 && (
          <div className="rounded-lg border border-purple-200 bg-white/60 p-3 dark:border-purple-800 dark:bg-slate-900/50">
            <h4 className="mb-2 text-xs font-bold text-purple-700 dark:text-purple-300">
              🤝 공통 주제
            </h4>
            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {data.commonThemes.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-purple-400">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.differences?.length > 0 && (
          <div className="rounded-lg border border-purple-200 bg-white/60 p-3 dark:border-purple-800 dark:bg-slate-900/50">
            <h4 className="mb-2 text-xs font-bold text-purple-700 dark:text-purple-300">
              ⚖️ 차이점
            </h4>
            <dl className="space-y-1.5 text-sm">
              {data.differences.map((d, i) => (
                <div key={i}>
                  <dt className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                    {d.aspect}
                  </dt>
                  <dd className="text-slate-700 dark:text-slate-300">{d.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* 추천 */}
      {data.recommendation && (
        <div className="mt-4 rounded-lg bg-purple-100 p-3 text-sm text-purple-900 dark:bg-purple-900 dark:text-purple-100">
          <span className="font-bold">💡 추천: </span>
          {data.recommendation}
        </div>
      )}
    </section>
  );
}
