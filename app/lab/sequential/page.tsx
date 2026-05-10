"use client";

import { useState } from "react";
import Link from "next/link";
import { LabKeywordInput } from "@/components/lab/LabKeywordInput";
import { LabResultCard, LabErrorCard, LabEmptyCard } from "@/components/lab/LabResultCard";

interface RecurringPattern {
  months: number[];
  years: number[];
  avgIntensity: number;
  consistency: number;
  seasonLabel: string;
}

interface YearSeries {
  year: number;
  data: Array<{ month: number; avg: number }>;
}

interface SequentialResult {
  keyword: string;
  yearlyPeaks: Array<{ year: number; month: number; weekPeriod: string; ratio: number }>;
  patterns: RecurringPattern[];
  yearSeries: YearSeries[];
  interpretation: {
    patterns: Array<{ season: string; description: string }>;
    narrative: string;
  };
}

const SEASON_COLORS: Record<string, string> = {
  봄: "#4CAF50",
  여름: "#FF9800",
  가을: "#E65100",
  겨울: "#1565C0",
};

export default function SequentialPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SequentialResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(keyword: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lab/sequential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `오류 ${res.status}`);
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // 반복 피크 월 집합 (하이라이트 용)
  const recurringMonths = new Set(
    result?.patterns.flatMap((p) => p.months) ?? []
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/lab" className="m3-icon-sm no-underline" style={{ color: "var(--md-on-surface-variant)" }}>
          arrow_back
        </Link>
        <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>event_repeat</span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>
            반복 사회 패턴
          </h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Sequential Pattern Mining</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>PrefixSpan</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Seasonal Pattern Detection</span>
          </div>
          <p className="mt-1 m3-body-sm">계절, 명절, 시험기간처럼 반복되는 사회 행동 패턴을 찾습니다. 몇 년간의 데이터를 비교해 사람들이 반복적으로 보이는 관심 흐름을 분석합니다.</p>
          <p className="mt-0.5 text-xs italic" style={{ color: "var(--md-primary)" }}>&ldquo;사람들은 매년 어떤 행동을 반복할까요?&rdquo;</p>
        </div>
      </div>

      {/* 입력 */}
      <LabKeywordInput onSubmit={handleSubmit} loading={loading} placeholder="분석할 키워드 입력 (예: 에어컨, 김장)" />

      {/* 에러 */}
      {error && <LabErrorCard message={error} />}

      {/* 결과 */}
      {result ? (
        <div className="space-y-4">
          {/* 연도별 미니 차트 */}
          <LabResultCard icon="event_repeat" title={`"${result.keyword}" 연도별 검색 추이`} subtitle="월별 평균 검색량 (높을수록 진한 막대)">
            <div className="space-y-3">
              {result.yearSeries.map((ys) => {
                const maxAvg = Math.max(...ys.data.map((d) => d.avg), 1);
                return (
                  <div key={ys.year} className="flex items-end gap-1">
                    <span
                      className="w-12 shrink-0 text-xs font-bold text-right"
                      style={{ color: "var(--md-on-surface-variant)" }}
                    >
                      {ys.year}
                    </span>
                    <div className="flex flex-1 items-end gap-[2px]">
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthData = ys.data.find((d) => d.month === i + 1);
                        const height = monthData
                          ? Math.max((monthData.avg / maxAvg) * 40, 2)
                          : 2;
                        const isRecurring = recurringMonths.has(i + 1);
                        return (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-0.5"
                          >
                            <div
                              className="w-full rounded-sm transition-all"
                              style={{
                                height: `${height}px`,
                                background: isRecurring
                                  ? "var(--md-primary)"
                                  : "var(--md-surface-container-highest)",
                                opacity: isRecurring ? 1 : 0.6,
                              }}
                            />
                            {ys === result.yearSeries[result.yearSeries.length - 1] && (
                              <span
                                className="text-[9px]"
                                style={{ color: "var(--md-on-surface-variant)" }}
                              >
                                {i + 1}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 범례 */}
            <div className="flex gap-4 mt-3 text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--md-primary)" }} />
                반복 피크 월
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--md-surface-container-highest)", opacity: 0.6 }} />
                일반
              </span>
            </div>
          </LabResultCard>

          {/* 패턴 카드 */}
          {result.patterns.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {result.patterns.map((pattern, i) => {
                const color = SEASON_COLORS[pattern.seasonLabel] || "var(--md-primary)";
                return (
                  <div key={i} className="m3-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold" style={{ color }}>
                        {pattern.seasonLabel} 패턴
                      </h4>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={{
                          background: `color-mix(in srgb, ${color} 15%, var(--md-surface-container))`,
                          color,
                        }}
                      >
                        일관성 {Math.round(pattern.consistency * 100)}%
                      </span>
                    </div>

                    {/* 월 표시 */}
                    <div className="flex gap-1.5">
                      {pattern.months.map((m) => (
                        <span
                          key={m}
                          className="rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{
                            background: `color-mix(in srgb, ${color} 12%, var(--md-surface-container))`,
                            color,
                          }}
                        >
                          {m}월
                        </span>
                      ))}
                    </div>

                    {/* 반복 연도 */}
                    <p className="m3-body-sm">
                      반복 연도: {pattern.years.join(", ")}년 | 평균 강도: {pattern.avgIntensity}
                    </p>

                    {/* AI 해석 */}
                    {result.interpretation.patterns[i] && (
                      <p className="m3-body-sm" style={{ color: "var(--md-on-surface)" }}>
                        {result.interpretation.patterns[i].description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 패턴 없음 안내 */}
          {result.patterns.length === 0 && (
            <div className="m3-card flex items-center gap-3 p-4">
              <span className="m3-icon" style={{ color: "var(--md-on-surface-variant)" }}>info</span>
              <p className="m3-body-sm">
                뚜렷한 반복 패턴이 발견되지 않았습니다. 계절과 관련된 키워드를 시도해보세요.
              </p>
            </div>
          )}

          {/* AI 종합 해석 */}
          {result.interpretation.narrative && (
            <LabResultCard icon="psychology" title="AI 종합 해석" subtitle="Claude가 분석한 반복 패턴의 사회적 의미">
              <p className="m3-body-sm leading-relaxed" style={{ color: "var(--md-on-surface)" }}>
                {result.interpretation.narrative}
              </p>
            </LabResultCard>
          )}
        </div>
      ) : (
        !loading && !error && <LabEmptyCard />
      )}
    </div>
  );
}
