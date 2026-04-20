"use client";

import { useState } from "react";
import { InsightDisplay } from "./InsightDisplay";
import { DateRangeControl, presetRange, autoTimeUnit, type DateRange } from "./DateRangeControl";

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
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="flex-1">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 스타벅스  ·  비교: 물냉면, 비빔냉면 (쉼표로 구분, 최대 5개)"
            disabled={busy}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-blue-400"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            💡 쉼표로 여러 키워드 입력 시 한 차트에서 비교됩니다. 첫 번째 키워드가 주 분석 대상.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy || !keyword.trim()}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "조사 중…" : "🔍 조사 시작"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangeControl value={range} onChange={handleRangeChange} disabled={busy} />
        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
          <input
            type="checkbox"
            checked={deep}
            onChange={(e) => setDeep(e.target.checked)}
            disabled={busy}
            className="h-3.5 w-3.5"
          />
          <span className="font-semibold">🧠 깊이 분석</span>
          <span className="opacity-70">(가설→검증→refine, +20초)</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-slate-500">예시:</span>
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setKeyword(ex);
              investigate(ex);
            }}
            disabled={busy}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {ex}
          </button>
        ))}
      </div>

      {busy && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <div className="animate-pulse">🔎 네이버 뉴스·YouTube·검색 트렌드 수집 중…</div>
          <div className="mt-2 animate-pulse text-xs text-slate-400">
            Claude가 증거를 분석하고 가설을 세우고 있습니다. 20~40초 소요.
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
          오류: {error}
        </div>
      )}

      {result && <InsightDisplay data={result} />}
    </div>
  );
}
