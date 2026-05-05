"use client";

import { useState } from "react";
import { InsightDisplay } from "./InsightDisplay";
import { DateRangeControl, presetRange, autoTimeUnit, DEFAULT_ADVANCED, type DateRange, type AdvancedOptions } from "./DateRangeControl";

interface Response {
  keyword: string;
  keywords?: string[];
  fetchedAt: string;
  range?: { startDate: string; endDate: string; timeUnit: "date" | "week" | "month" };
  insight: {
    hypotheses: Array<{
      title: string;
      reasoning: string;
      evidence: string[];
      confidence: "high" | "medium" | "low";
    }>;
    summary: string;
    mindset: string;
    relatedKeywords?: Array<{
      keyword: string;
      category: string;
      strength: "strong" | "medium" | "weak";
      sentiment: "positive" | "negative" | "neutral";
      context: string;
    }>;
  };
  verificationTrace?: {
    plans: Array<{ hypothesisTitle: string; verifyQueries: string[] }>;
    batches: Array<{ hypothesisTitle: string; query: string; newsCount: number }>;
    refined?: boolean;
  } | null;
  compareInsight?: {
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
  } | null;
  evidence: {
    news: Array<{ title: string; description: string; link: string; pubDate: string }>;
    videos: Array<{
      videoId: string;
      title: string;
      description: string;
      channelTitle: string;
      viewCount: number;
      likeCount: number;
    }>;
    comments: Array<{ videoId: string; text: string; likeCount: number }>;
    trend: Array<{ period: string; ratio: number }>;
    multiTrend?: Array<{ keyword: string; series: Array<{ period: string; ratio: number }> }>;
  };
}

export function InvestigateForm({ examples }: { examples: string[] }) {
  const [keyword, setKeyword] = useState("");
  const [range, setRange] = useState<DateRange>(() => presetRange("3m"));
  const [advanced, setAdvanced] = useState<AdvancedOptions>(DEFAULT_ADVANCED);
  const [deep, setDeep] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Response | null>(null);

  async function investigate(kw: string, r: DateRange = range) {
    if (!kw.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const keywords = kw.split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: kw.trim(),
          keywords,
          startDate: r.startDate,
          endDate: r.endDate,
          timeUnit: autoTimeUnit(r),
          deep,
          gender: advanced.gender,
          ages: advanced.ages,
          device: advanced.device,
          compareGender: advanced.compareGender,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `오류 ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    investigate(keyword);
  }

  // 기간 변경 시 결과가 이미 있으면 자동 재조회 (없으면 다음 검색에 적용)
  function handleRangeChange(next: DateRange) {
    setRange(next);
    if (result && keyword.trim()) {
      investigate(keyword, next);
    }
  }

  return (
    <div className="space-y-5">
      {/* 검색창 + 버튼: 같은 높이(h-12), 정렬 통일 */}
      <form
        onSubmit={handleSubmit}
        className="flex items-stretch gap-3"
      >
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="분석하고 싶은 키워드를 입력하세요 (비교: 쉼표로 구분)"
          disabled={busy}
          className="h-12 flex-1 rounded-m3-md border px-4 text-base focus:outline-none focus:ring-2 disabled:opacity-60"
          style={{
            background: "var(--md-surface-container)",
            borderColor: "var(--md-outline)",
            color: "var(--md-on-surface)",
          }}
        />
        <button
          type="submit"
          disabled={busy || !keyword.trim()}
          className="m3-btn-filled flex h-12 items-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          <span className="m3-icon-sm">search</span>
          {busy ? "분석 중…" : "분석 시작"}
        </button>
      </form>

      {/* 기간 + 옵션: 한 줄 정렬 */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangeControl value={range} onChange={handleRangeChange} disabled={busy} advanced={advanced} onAdvancedChange={setAdvanced} />
        <label
          className="flex h-9 cursor-pointer items-center gap-2 rounded-m3-md border px-3 text-sm transition"
          style={{
            borderColor: deep ? "var(--md-primary)" : "var(--md-outline)",
            background: deep ? "var(--md-primary)" : "var(--md-surface-container)",
            color: deep ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
          }}
        >
          <input
            type="checkbox"
            checked={deep}
            onChange={(e) => setDeep(e.target.checked)}
            disabled={busy}
            className="h-4 w-4 accent-current"
          />
          <span className="font-medium">더 자세히 분석</span>
        </label>
      </div>

      {/* 쉬운 안내 문구 */}
      <p className="m3-body-sm">
        쉼표로 여러 키워드를 넣으면 한 차트에서 비교할 수 있어요. 첫 번째 키워드가 주인공이 됩니다.
      </p>

      {/* 예시 칩 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="m3-body-sm font-medium" style={{ color: "var(--md-on-surface-variant)" }}>
          예시
        </span>
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setKeyword(ex);
              investigate(ex);
            }}
            disabled={busy}
            className="m3-chip transition hover:shadow-m3-1 disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>

      {busy && (
        <div className="m3-card animate-pulse space-y-2">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--md-primary)" }}>
            <span className="m3-icon-sm">hourglass_top</span>
            네이버 뉴스, YouTube, 검색 트렌드를 모아오고 있어요…
          </div>
          <p className="m3-body-sm">
            AI가 자료를 읽고 왜 이 키워드가 떴는지 분석하고 있습니다.
          </p>
        </div>
      )}

      {error && (
        <div
          className="rounded-m3-md border p-4 text-sm"
          style={{
            borderColor: "var(--md-error)",
            background: "#FDECEA",
            color: "var(--md-error)",
          }}
        >
          <span className="m3-icon-sm mr-1">error</span>
          {error}
        </div>
      )}

      {result && <InsightDisplay data={result} />}
    </div>
  );
}
