"use client";

import { useState } from "react";
import Link from "next/link";
import { LabKeywordInput } from "@/components/lab/LabKeywordInput";
import { LabResultCard, LabErrorCard, LabEmptyCard } from "@/components/lab/LabResultCard";

interface Intent {
  name: string;
  description: string;
  keywords: string[];
  percentage: number;
}

interface IntentResult {
  keyword: string;
  intents: Intent[];
  summary: string;
  autocomplete: string[];
  meta: { newsCount: number; commentCount: number; autocompleteCount: number };
}

const INTENT_COLORS = [
  "var(--md-primary)",
  "#1565C0",
  "#F57F17",
  "#E65100",
  "#6A1B9A",
];

export default function IntentPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(keyword: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lab/intent", {
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
        <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>target</span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>
            검색 의도 분석
          </h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Intent Clustering</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Embedding Similarity</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Semantic Grouping</span>
          </div>
          <p className="mt-1 m3-body-sm">사람들이 같은 검색어를 왜 다르게 찾는지 분석합니다. 뉴스, 댓글, 검색 맥락을 AI가 읽고 비슷한 의도를 가진 사람들을 그룹으로 묶습니다.</p>
          <p className="mt-0.5 text-xs italic" style={{ color: "var(--md-primary)" }}>&ldquo;같은 검색어 속 서로 다른 사람들의 이유를 읽습니다.&rdquo;</p>
        </div>
      </div>

      {/* 입력 */}
      <LabKeywordInput onSubmit={handleSubmit} loading={loading} placeholder="분석할 키워드 입력 (예: 치킨, BTS)" />

      {/* 에러 */}
      {error && <LabErrorCard message={error} />}

      {/* 결과 */}
      {result ? (
        <div className="space-y-4">
          {/* 요약 */}
          <LabResultCard icon="target" title={`"${result.keyword}" 검색 의도 분석`} subtitle={result.summary}>
            {/* 수집 데이터 요약 */}
            <div className="flex flex-wrap gap-3 m3-body-sm">
              <span className="flex items-center gap-1">
                <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>newspaper</span>
                뉴스 {result.meta.newsCount}건
              </span>
              <span className="flex items-center gap-1">
                <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>chat</span>
                댓글 {result.meta.commentCount}건
              </span>
              <span className="flex items-center gap-1">
                <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>search</span>
                자동완성 {result.meta.autocompleteCount}건
              </span>
            </div>
          </LabResultCard>

          {/* 의도 카드 */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {result.intents.map((intent, i) => {
              const color = INTENT_COLORS[i % INTENT_COLORS.length];
              return (
                <div key={i} className="m3-card space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold" style={{ color }}>
                      {intent.name}
                    </h4>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: `color-mix(in srgb, ${color} 15%, var(--md-surface-container))`, color }}
                    >
                      {intent.percentage}%
                    </span>
                  </div>

                  {/* 비율 바 */}
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--md-surface-container-high)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${intent.percentage}%`, background: color }}
                    />
                  </div>

                  <p className="m3-body-sm">{intent.description}</p>

                  {/* 키워드 칩 */}
                  <div className="flex flex-wrap gap-1.5">
                    {intent.keywords.map((kw, j) => (
                      <span
                        key={j}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: `color-mix(in srgb, ${color} 8%, var(--md-surface-container))`,
                          color: "var(--md-on-surface)",
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 자동완성 참고 */}
          {result.autocomplete.length > 0 && (
            <LabResultCard icon="search" title="사람들이 함께 검색하는 것" subtitle="네이버 자동완성 기반">
              <div className="flex flex-wrap gap-2">
                {result.autocomplete.map((kw, i) => (
                  <span
                    key={i}
                    className="rounded-full px-3 py-1.5 text-sm"
                    style={{
                      background: "var(--md-surface-container-high)",
                      color: "var(--md-on-surface)",
                    }}
                  >
                    {kw}
                  </span>
                ))}
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
