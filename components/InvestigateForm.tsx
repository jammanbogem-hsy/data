"use client";

import { useState, useEffect, useRef } from "react";
import { InsightDisplay } from "./InsightDisplay";
import { DateRangeControl, presetRange, autoTimeUnit, DEFAULT_ADVANCED, type DateRange, type AdvancedOptions } from "./DateRangeControl";

/* ─── 단계별 프로그레스 ─── */
interface LoadingStep {
  icon: string;
  label: string;
  durationMs: number;
}

const LOADING_STEPS: LoadingStep[] = [
  { icon: "newspaper", label: "네이버에서 뉴스와 블로그를 모으고 있어요", durationMs: 3000 },
  { icon: "smart_display", label: "YouTube에서 영상과 댓글을 찾고 있어요", durationMs: 5000 },
  { icon: "psychology", label: "AI가 자료를 읽고 분석하고 있어요", durationMs: 15000 },
];

function LoadingProgress() {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = Date.now() - startRef.current;
      setElapsed(ms);
      if (ms >= LOADING_STEPS[0].durationMs + LOADING_STEPS[1].durationMs) {
        setCurrentStep(2);
      } else if (ms >= LOADING_STEPS[0].durationMs) {
        setCurrentStep(1);
      } else {
        setCurrentStep(0);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const totalDuration = LOADING_STEPS.reduce((s, step) => s + step.durationMs, 0);
  const progressPercent = Math.min((elapsed / totalDuration) * 100, 95);

  return (
    <div className="m3-card space-y-4">
      {/* 전체 진행률 바 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="m3-body-sm font-medium" style={{ color: "var(--md-primary)" }}>
            분석 진행 중
          </span>
          <span className="m3-body-sm">{Math.round(progressPercent)}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ background: "var(--md-surface-container-high)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              background: "var(--md-primary)",
            }}
          />
        </div>
      </div>

      {/* 단계별 상태 */}
      <div className="space-y-3">
        {LOADING_STEPS.map((step, idx) => {
          const isDone = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <div
              key={idx}
              className="flex items-center gap-3 transition-opacity duration-300"
              style={{ opacity: isActive ? 1 : isDone ? 0.6 : 0.35 }}
            >
              {isDone ? (
                <span
                  className="m3-icon-sm"
                  style={{ color: "var(--md-primary)", fontSize: 20 }}
                >
                  check_circle
                </span>
              ) : isActive ? (
                <span
                  className="m3-icon-sm animate-pulse"
                  style={{ color: "var(--md-primary)", fontSize: 20 }}
                >
                  {step.icon}
                </span>
              ) : (
                <span
                  className="m3-icon-sm"
                  style={{ color: "var(--md-outline)", fontSize: 20 }}
                >
                  {step.icon}
                </span>
              )}
              <span
                className="text-sm font-medium"
                style={{
                  color: isActive
                    ? "var(--md-on-surface)"
                    : "var(--md-on-surface-variant)",
                }}
              >
                {step.label}
              </span>
              {isDone && (
                <span className="m3-body-sm" style={{ color: "var(--md-primary)" }}>
                  완료
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  keywordInsight?: {
    keyword: string;
    totalMonthly: number;
    pcMonthly: number;
    mobileMonthly: number;
    mobileRatio: number;
    compIdx: string;
    relatedKeywords: Array<{ relKeyword: string; totalQcCnt: number; monthlyPcQcCnt: number; monthlyMobileQcCnt: number; compIdx: string }>;
  } | null;
}

export function InvestigateForm({ examples }: { examples: string[] }) {
  const [keyword, setKeyword] = useState("");
  const [range, setRange] = useState<DateRange>(() => presetRange("3m"));
  const [advanced, setAdvanced] = useState<AdvancedOptions>(DEFAULT_ADVANCED);
  const [deep, setDeep] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Response | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K (또는 Cmd+K) → 검색창 포커스
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      {/* 검색창 + 버튼: 모바일에서 세로 배치 */}
      <form
        onSubmit={handleSubmit}
        className="flex items-stretch gap-3 max-md:flex-col"
      >
        <input
          ref={inputRef}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="분석하고 싶은 키워드를 입력하세요 (비교: 쉼표로 구분)"
          disabled={busy}
          aria-label="분석할 키워드 입력"
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
          aria-label={busy ? "분석 진행 중" : "키워드 분석 시작"}
          className="m3-btn-filled flex h-12 items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          <span className="m3-icon-sm" aria-hidden="true">search</span>
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
        <span
          className="ml-2 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium"
          style={{ borderColor: "var(--md-outline)", color: "var(--md-on-surface-variant)" }}
        >
          <kbd>Ctrl</kbd>+<kbd>K</kbd> 검색창 포커스
        </span>
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

      {busy && <LoadingProgress />}

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
