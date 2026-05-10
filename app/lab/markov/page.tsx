"use client";

import { useState } from "react";
import Link from "next/link";
import { LabKeywordInput } from "@/components/lab/LabKeywordInput";
import { LabResultCard, LabErrorCard, LabEmptyCard } from "@/components/lab/LabResultCard";

interface MarkovTransition {
  from: string;
  to: string;
  lagDays: number;
  correlation: number;
  probability: number;
}

interface MarkovResult {
  keyword: string;
  relatedKeywords: string[];
  chain: string[];
  transitions: MarkovTransition[];
  story: string;
  insight: string;
}

export default function MarkovPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MarkovResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(keyword: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lab/markov", {
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

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/lab" className="m3-icon-sm no-underline" style={{ color: "var(--md-on-surface-variant)" }}>
          arrow_back
        </Link>
        <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>route</span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>
            관심 이동 분석
          </h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Markov Chain</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Session Flow Analysis</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Transition Probability Modeling</span>
          </div>
          <p className="mt-1 m3-body-sm">사람들의 관심이 다음으로 어디로 이동하는지 분석합니다. 검색 흐름과 시간 순서를 바탕으로 관심 이동 경로를 예측합니다.</p>
          <p className="mt-0.5 text-xs italic" style={{ color: "var(--md-primary)" }}>&ldquo;사람들의 관심은 다음 어디로 이동할까요?&rdquo;</p>
        </div>
      </div>

      {/* 입력 */}
      <LabKeywordInput onSubmit={handleSubmit} loading={loading} placeholder="분석할 키워드 입력 (예: 캠핑, 아이폰)" />

      {/* 에러 */}
      {error && <LabErrorCard message={error} />}

      {/* 결과 */}
      {result ? (
        <div className="space-y-4">
          {/* 관심 이동 체인 시각화 */}
          <LabResultCard icon="route" title={`"${result.keyword}" 관심 이동 체인`} subtitle="키워드 간 관심 이동 흐름">
            <div className="flex flex-wrap items-center gap-1">
              {result.chain.map((kw, i) => {
                const isMain = kw === result.keyword;
                // 그라데이션: 메인은 primary, 멀어질수록 연해짐
                const opacity = isMain ? 1 : Math.max(0.4, 1 - i * 0.15);
                return (
                  <div key={i} className="flex items-center gap-1">
                    {/* 키워드 박스 */}
                    <div
                      className="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap"
                      style={{
                        background: isMain
                          ? "var(--md-primary)"
                          : `color-mix(in srgb, var(--md-primary) ${Math.round(opacity * 100)}%, var(--md-surface-container))`,
                        color: isMain
                          ? "var(--md-on-primary)"
                          : opacity > 0.6
                            ? "var(--md-on-primary)"
                            : "var(--md-on-surface)",
                      }}
                    >
                      {kw}
                    </div>
                    {/* 화살표 (마지막 제외) */}
                    {i < result.chain.length - 1 && (() => {
                      // 이 전이의 lag와 확률 찾기
                      const transition = result.transitions.find(
                        (t) => t.from === kw && t.to === result.chain[i + 1]
                      );
                      return (
                        <div className="flex flex-col items-center mx-1">
                          <span
                            className="text-lg font-bold"
                            style={{ color: "var(--md-primary)", lineHeight: 1 }}
                          >
                            →
                          </span>
                          {transition && (
                            <span
                              className="text-[10px] whitespace-nowrap"
                              style={{ color: "var(--md-on-surface-variant)" }}
                            >
                              {transition.lagDays}일 ({Math.round(transition.probability * 100)}%)
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </LabResultCard>

          {/* Claude 해석 */}
          {(result.story || result.insight) && (
            <LabResultCard icon="auto_awesome" title="AI 해석" subtitle="관심 이동 이야기">
              <div className="space-y-3">
                {result.story && (
                  <p className="m3-body-sm" style={{ color: "var(--md-on-surface)" }}>
                    {result.story}
                  </p>
                )}
                {result.insight && (
                  <div
                    className="rounded-lg px-3 py-2"
                    style={{ background: "var(--md-surface-container-high)" }}
                  >
                    <p className="m3-body-sm font-medium" style={{ color: "var(--md-primary)" }}>
                      {result.insight}
                    </p>
                  </div>
                )}
              </div>
            </LabResultCard>
          )}

          {/* 전이 테이블 */}
          {result.transitions.length > 0 && (
            <LabResultCard icon="table_chart" title="전이 상세" subtitle="키워드 간 관심 이동 관계">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ color: "var(--md-on-surface)" }}>
                  <thead>
                    <tr
                      className="border-b text-left"
                      style={{ borderColor: "var(--md-outline-variant)" }}
                    >
                      <th className="pb-2 pr-4 font-medium">출발</th>
                      <th className="pb-2 pr-4 font-medium">도착</th>
                      <th className="pb-2 pr-4 font-medium text-right">지연(일)</th>
                      <th className="pb-2 pr-4 font-medium text-right">상관계수</th>
                      <th className="pb-2 font-medium text-right">확률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transitions
                      .sort((a, b) => b.probability - a.probability)
                      .map((t, i) => (
                        <tr
                          key={i}
                          className="border-b"
                          style={{ borderColor: "var(--md-outline-variant)" }}
                        >
                          <td className="py-2 pr-4">{t.from}</td>
                          <td className="py-2 pr-4">{t.to}</td>
                          <td className="py-2 pr-4 text-right">{t.lagDays}</td>
                          <td className="py-2 pr-4 text-right">{t.correlation.toFixed(3)}</td>
                          <td className="py-2 text-right">{Math.round(t.probability * 100)}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </LabResultCard>
          )}
        </div>
      ) : (
        !loading && !error && <LabEmptyCard />
      )}
    </div>
  );
}
