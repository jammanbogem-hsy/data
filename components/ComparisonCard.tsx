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
  여름: "wb_sunny",
  겨울: "ac_unit",
  봄: "local_florist",
  가을: "eco",
  연중: "autorenew",
  없음: "remove",
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
    <section className="m3-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="m3-chip-primary">
          <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-on-primary)" }}>compare_arrows</span>
          비교 분석
        </span>
        <span className="m3-body-sm">
          {keywords.length}개 키워드 동시 분석
        </span>
      </div>

      {/* 종합 요약 */}
      <div className="mb-4 rounded-xl p-3 text-sm leading-relaxed" style={{ background: "var(--md-surface-container-low)", color: "var(--md-on-surface)" }}>
        <span className="mr-1 font-semibold" style={{ color: "var(--md-primary)" }}>한 줄 요약</span>
        {data.summary}
      </div>

      {/* 피크 비교 테이블 */}
      {data.peakComparison?.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <h4 className="m3-label-sm mb-2">
            키워드별 통계
          </h4>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                <th className="p-2 text-left m3-label-sm">키워드</th>
                <th className="p-2 text-center m3-label-sm">평균</th>
                <th className="p-2 text-center m3-label-sm">최고</th>
                <th className="p-2 text-left m3-label-sm">피크 날짜</th>
                <th className="p-2 text-center m3-label-sm">주요 시즌</th>
              </tr>
            </thead>
            <tbody>
              {data.peakComparison.map((pc) => (
                <tr key={pc.keyword} style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                  <td className="p-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: colors[pc.keyword] ?? "#94a3b8" }}
                    />
                    <span className="ml-2 font-semibold" style={{ color: "var(--md-on-surface)" }}>
                      {pc.keyword}
                    </span>
                    {pc.keyword === primaryKeyword && (
                      <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "color-mix(in srgb, var(--md-primary) 15%, var(--md-surface-container))", color: "var(--md-primary)" }}>
                        주
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center tabular-nums m3-body-sm">
                    {pc.avgRatio?.toFixed?.(1) ?? "?"}
                  </td>
                  <td className="p-2 text-center tabular-nums font-bold" style={{ color: "var(--md-on-surface)" }}>
                    {pc.peakRatio}
                  </td>
                  <td className="p-2 font-mono m3-body-sm">
                    {pc.peakPeriod}
                  </td>
                  <td className="p-2 text-center">
                    <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-primary)" }}>{SEASON_ICON[pc.dominantSeason] ?? "remove"}</span>
                    <span className="ml-1 m3-body-sm">
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
          <div className="m3-card-outlined">
            <h4 className="mb-2 m3-label-sm flex items-center gap-1.5">
              <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-primary)" }}>handshake</span>
              공통 주제
            </h4>
            <ul className="space-y-1 text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
              {data.commonThemes.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: "var(--md-primary)" }}>•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.differences?.length > 0 && (
          <div className="m3-card-outlined">
            <h4 className="mb-2 m3-label-sm flex items-center gap-1.5">
              <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-primary)" }}>balance</span>
              차이점
            </h4>
            <dl className="space-y-1.5 text-sm">
              {data.differences.map((d, i) => (
                <div key={i}>
                  <dt className="text-xs font-semibold" style={{ color: "var(--md-primary)" }}>
                    {d.aspect}
                  </dt>
                  <dd style={{ color: "var(--md-on-surface-variant)" }}>{d.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* 추천 */}
      {data.recommendation && (
        <div className="mt-4 rounded-xl p-3 text-sm flex items-start gap-2" style={{ background: "color-mix(in srgb, var(--md-primary) 10%, var(--md-surface-container))", color: "var(--md-on-surface)" }}>
          <span className="m3-icon-sm shrink-0" style={{ color: "var(--md-primary)" }}>lightbulb</span>
          <span><b style={{ color: "var(--md-primary)" }}>추천:</b> {data.recommendation}</span>
        </div>
      )}
    </section>
  );
}
