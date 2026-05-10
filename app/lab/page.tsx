"use client";

import { useState } from "react";
import Link from "next/link";
import { LabKeywordInput } from "@/components/lab/LabKeywordInput";
import { LabErrorCard } from "@/components/lab/LabResultCard";

/* ── 6개 증거 실험실 데이터 ────────────────── */
const LAB_FEATURES = [
  {
    id: "intent",
    href: "/lab/intent",
    icon: "target",
    title: "검색 의도 분석",
    role: "사람들이 왜 검색했는지 분석",
    algorithms: ["Intent Clustering", "Embedding Similarity", "Semantic Grouping"],
    summary: "같은 검색어 속 서로 다른 사람들의 이유를 읽습니다.",
    description: "사람들이 같은 검색어를 왜 다르게 찾는지 분석합니다. 뉴스, 댓글, 검색 맥락을 AI가 읽고 비슷한 의도를 가진 사람들을 그룹으로 묶습니다.",
  },
  {
    id: "social-graph",
    href: "/lab/social-graph",
    icon: "hub",
    title: "사회 현상 연결망",
    role: "어떤 사회 현상과 연결되는지 분석",
    algorithms: ["Graph Embedding", "Knowledge Graph", "Semantic Relation Mapping"],
    summary: "이 키워드는 사회와 어떻게 연결될까요?",
    description: "키워드를 단순 단어가 아니라 사회적 의미 관계로 연결합니다.",
  },
  {
    id: "cascade",
    href: "/lab/cascade",
    icon: "share",
    title: "유행 확산 분석",
    role: "유행이 어디서 시작되어 어떻게 퍼졌는지 분석",
    algorithms: ["Cascade Detection", "Diffusion Analysis", "Temporal Propagation Tracking"],
    summary: "유행의 시작점과 퍼져나간 흐름을 추적합니다.",
    description: "유튜브, 뉴스, 검색량의 시간 흐름을 비교해 확산 경로를 추적합니다.",
  },
  {
    id: "sequential",
    href: "/lab/sequential",
    icon: "event_repeat",
    title: "반복 사회 패턴",
    role: "반복되는 사회 행동 흐름 분석",
    algorithms: ["Sequential Pattern Mining", "PrefixSpan", "Seasonal Pattern Detection"],
    summary: "사람들은 매년 어떤 행동을 반복할까요?",
    description: "계절, 명절처럼 반복되는 사회 행동 패턴을 찾습니다.",
  },
  {
    id: "markov",
    href: "/lab/markov",
    icon: "route",
    title: "관심 이동 분석",
    role: "사람들의 관심이 어디로 이동하는지 분석",
    algorithms: ["Markov Chain", "Session Flow Analysis", "Transition Probability Modeling"],
    summary: "사람들의 관심은 다음 어디로 이동할까요?",
    description: "검색 흐름과 시간 순서를 바탕으로 관심 이동 경로를 예측합니다.",
  },
  {
    id: "emotion",
    href: "/lab/emotion",
    icon: "mood",
    title: "감정 흐름 분석",
    role: "사회 분위기와 감정 변화 분석",
    algorithms: ["Emotion Trajectory", "Sentiment Timeline Analysis", "Temporal Emotion Modeling"],
    summary: "사회 분위기와 감정은 어떻게 변했을까요?",
    description: "기대감, 걱정, 만족 같은 감정의 흐름을 이벤트 전후로 추적합니다.",
  },
];

/* ── 타입 ────────────────────────────── */
interface XReaction {
  theme: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  summary: string;
  samplePosts: string[];
}

interface LabBriefing {
  lab: string;
  title: string;
  briefing: string;
}

interface SocialInterpretResult {
  keyword: string;
  interpretation: string;
  mood: { title: string; signals: string[] };
  hearts: { title: string; desires: string[] };
  changes: { title: string; signals: string[] };
  labBriefings?: LabBriefing[];
  xOpinions?: {
    overview: string;
    reactions: XReaction[];
    dominantSentiment: string;
    gap: string;
  };
  meta: { newsCount: number; commentCount: number; videoCount: number; xAvailable: boolean };
}

/* ── 6개 실험실 API 경로 매핑 ────────── */
const LAB_API_MAP: Record<string, string> = {
  intent: "/api/lab/intent",
  "social-graph": "/api/lab/social-graph",
  cascade: "/api/lab/cascade",
  sequential: "/api/lab/sequential",
  markov: "/api/lab/markov",
  emotion: "/api/lab/emotion",
};

type LabStatus = "idle" | "loading" | "done" | "error";
interface LabResult { status: LabStatus; data?: Record<string, unknown>; error?: string }

/* ── 페이지 ──────────────────────────── */
export default function LabPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SocialInterpretResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzedKeyword, setAnalyzedKeyword] = useState<string>("");
  const [labResults, setLabResults] = useState<Record<string, LabResult>>({});

  async function handleSubmit(keyword: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalyzedKeyword(keyword);
    // 6개 실험실 상태 초기화
    const initLabs: Record<string, LabResult> = {};
    for (const id of Object.keys(LAB_API_MAP)) initLabs[id] = { status: "idle" };
    setLabResults(initLabs);

    try {
      // 1단계: AI 사회 해석 (메인)
      const res = await fetch("/api/lab/social-interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `오류 ${res.status}`);
      setResult(data);
      setLoading(false);

      // 2단계: 6개 실험실 병렬 호출 (캐싱 덕분에 두 번째부터 즉시)
      for (const id of Object.keys(LAB_API_MAP)) {
        setLabResults((prev) => ({ ...prev, [id]: { status: "loading" } }));
      }

      const labPromises = Object.entries(LAB_API_MAP).map(async ([id, url]) => {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keyword }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || `오류 ${r.status}`);
          setLabResults((prev) => ({ ...prev, [id]: { status: "done", data: d } }));
        } catch (e) {
          setLabResults((prev) => ({ ...prev, [id]: { status: "error", error: (e as Error).message } }));
        }
      });

      await Promise.allSettled(labPromises);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  // 브리핑에서 해당 실험실 찾기
  function getBriefingForLab(labId: string): LabBriefing | null {
    if (!result?.labBriefings) return null;
    return result.labBriefings.find((b) => b.lab === labId) ?? null;
  }

  return (
    <div className="space-y-8">
      {/* ── 헤더 ── */}
      <div className="flex items-center gap-3">
        <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>psychology</span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>
            AI 사회 탐구 실험실
          </h1>
          <p className="m3-body-sm">
            검색량 분석을 넘어, 사람들의 마음과 사회 분위기의 흐름을 읽습니다.
          </p>
        </div>
      </div>

      {/* ── 키워드 입력 ── */}
      <LabKeywordInput
        onSubmit={handleSubmit}
        loading={loading}
        placeholder="사회 현상을 읽고 싶은 키워드 (예: 치킨, 저출산, BTS)"
      />

      {error && <LabErrorCard message={error} />}

      {/* ── AI 사회 해석 (최상위 레이어) ── */}
      {result && (
        <div className="space-y-5">
          {/* 종합 해석 */}
          <section
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--md-primary) 8%, var(--md-surface)) 0%, var(--md-surface-container) 100%)",
              border: "1px solid color-mix(in srgb, var(--md-primary) 20%, var(--md-outline-variant))",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="m3-icon" style={{ color: "var(--md-primary)", fontSize: 22 }}>auto_awesome</span>
              <h2 className="text-base font-bold" style={{ color: "var(--md-on-surface)" }}>
                AI 사회 해석
              </h2>
              <span className="m3-chip text-[11px]">{result.keyword}</span>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--md-on-surface)", lineHeight: 1.8 }}
            >
              {result.interpretation}
            </p>
          </section>

          {/* 3개 카드: 사회 분위기 / 사람들의 마음 / 사회 변화 신호 */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* 사회 분위기 */}
            <div className="m3-card space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, #1565C0 12%, var(--md-surface-container))" }}>
                  <span className="m3-icon-sm" style={{ color: "#1565C0", fontSize: 18 }}>cloud</span>
                </div>
                <h3 className="text-sm font-bold" style={{ color: "#1565C0" }}>사회 분위기</h3>
              </div>
              <p className="text-xs font-medium" style={{ color: "var(--md-on-surface)" }}>{result.mood.title}</p>
              <ul className="space-y-1.5">
                {result.mood.signals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--md-on-surface-variant)" }}>
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#1565C0" }} />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* 사람들의 마음 */}
            <div className="m3-card space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, var(--md-primary) 12%, var(--md-surface-container))" }}>
                  <span className="m3-icon-sm" style={{ color: "var(--md-primary)", fontSize: 18 }}>favorite</span>
                </div>
                <h3 className="text-sm font-bold" style={{ color: "var(--md-primary)" }}>사람들의 마음</h3>
              </div>
              <p className="text-xs font-medium" style={{ color: "var(--md-on-surface)" }}>{result.hearts.title}</p>
              <ul className="space-y-1.5">
                {result.hearts.desires.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--md-on-surface-variant)" }}>
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--md-primary)" }} />
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {/* 사회 변화 신호 */}
            <div className="m3-card space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, #E65100 12%, var(--md-surface-container))" }}>
                  <span className="m3-icon-sm" style={{ color: "#E65100", fontSize: 18 }}>trending_up</span>
                </div>
                <h3 className="text-sm font-bold" style={{ color: "#E65100" }}>사회 변화 신호</h3>
              </div>
              <p className="text-xs font-medium" style={{ color: "var(--md-on-surface)" }}>{result.changes.title}</p>
              <ul className="space-y-1.5">
                {result.changes.signals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--md-on-surface-variant)" }}>
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#E65100" }} />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* X(Twitter) 실시간 반응 (Grok) */}
          {result.xOpinions && (
            <section className="m3-card space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, #1D9BF0 12%, var(--md-surface-container))" }}>
                  <span className="m3-icon-sm" style={{ color: "#1D9BF0", fontSize: 18 }}>forum</span>
                </div>
                <h3 className="text-sm font-bold" style={{ color: "#1D9BF0" }}>X(Twitter) 실시간 반응</h3>
                <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>
                  Grok AI
                </span>
                {/* 신뢰도 라벨 */}
                <span className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: "color-mix(in srgb, #F57F17 12%, var(--md-surface-container))", color: "#F57F17" }}>
                  참고용
                </span>
              </div>
              {/* 안내 문구 */}
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
                X에서 관찰된 주요 반응입니다. 전체 여론을 대표하기보다는, 빠르게 확산되는 실시간 담론과 감정 흐름을 참고하기 위한 자료입니다.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--md-on-surface)" }}>
                {result.xOpinions.overview}
              </p>
              <div className="space-y-2">
                {result.xOpinions.reactions.map((r, i) => {
                  const sentColor = r.sentiment === "positive" ? "var(--md-primary)" : r.sentiment === "negative" ? "var(--md-error)" : "#78909C";
                  return (
                    <div key={i} className="rounded-lg p-2.5" style={{ background: "var(--md-surface-container-low)" }}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: sentColor }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--md-on-surface)" }}>{r.theme}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${sentColor} 12%, var(--md-surface-container))`, color: sentColor }}>
                          {r.sentiment === "positive" ? "긍정" : r.sentiment === "negative" ? "부정" : r.sentiment === "mixed" ? "혼합" : "중립"}
                        </span>
                      </div>
                      <p className="mt-1 m3-body-sm">{r.summary}</p>
                      {r.samplePosts.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {r.samplePosts.slice(0, 2).map((post, j) => (
                            <p key={j} className="text-[11px] italic pl-3" style={{ color: "var(--md-on-surface-variant)", borderLeft: `2px solid ${sentColor}` }}>
                              &ldquo;{post}&rdquo;
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {result.xOpinions.gap && (
                <div className="rounded-lg p-2.5 flex items-start gap-2" style={{ background: "color-mix(in srgb, #1D9BF0 6%, var(--md-surface-container))" }}>
                  <span className="m3-icon-sm shrink-0" style={{ fontSize: 14, color: "#1D9BF0" }}>compare_arrows</span>
                  <div>
                    <span className="text-[11px] font-semibold" style={{ color: "#1D9BF0" }}>뉴스 vs X 반응 온도 차이</span>
                    <p className="mt-0.5 m3-body-sm">{result.xOpinions.gap}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 데이터 소스 요약 */}
          <div className="flex flex-wrap gap-3 m3-body-sm">
            <span className="flex items-center gap-1">
              <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>newspaper</span>
              뉴스 {result.meta.newsCount}건
            </span>
            <span className="flex items-center gap-1">
              <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>smart_display</span>
              영상 {result.meta.videoCount}개
            </span>
            <span className="flex items-center gap-1">
              <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>chat</span>
              댓글 {result.meta.commentCount}건
            </span>
            {result.meta.xAvailable && (
              <span className="flex items-center gap-1">
                <span className="m3-icon-sm" style={{ fontSize: 14, color: "#1D9BF0" }}>forum</span>
                X 반응 수집
              </span>
            )}
          </div>

          {/* 탐구 유도 */}
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "var(--md-surface-container-low)", border: "1px solid var(--md-outline-variant)" }}
          >
            <span className="m3-icon shrink-0" style={{ color: "var(--md-primary)", fontSize: 20 }}>explore</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--md-on-surface)" }}>
                AI는 왜 이런 해석을 했을까요?
              </p>
              <p className="mt-0.5 m3-body-sm">
                아래 실험실에서 각각의 근거를 직접 탐구해보세요. 데이터가 어떤 이야기를 하는지 확인할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 6개 증거 실험실 ── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="m3-icon-sm" style={{ color: "var(--md-primary)", fontSize: 18 }}>science</span>
          <h2 className="text-sm font-bold" style={{ color: "var(--md-on-surface)" }}>
            {result ? "근거 탐구 실험실" : "사회 탐구 실험실"}
          </h2>
          {result && (
            <span className="m3-body-sm">
              &mdash; &ldquo;{result.keyword}&rdquo; 해석의 증거를 각 실험실에서 확인하세요
            </span>
          )}
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {LAB_FEATURES.map((f) => {
            const briefing = getBriefingForLab(f.id);
            const lr = labResults[f.id];
            return (
              <div key={f.id} className="m3-card flex flex-col">
                {/* 헤더 */}
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "color-mix(in srgb, var(--md-primary) 12%, var(--md-surface-container))" }}
                  >
                    <span className="m3-icon" style={{ fontSize: 22, color: "var(--md-primary)" }}>{f.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold" style={{ color: "var(--md-on-surface)" }}>{f.title}</h3>
                      {lr?.status === "loading" && <span className="m3-icon-sm animate-spin" style={{ fontSize: 14, color: "var(--md-primary)" }}>progress_activity</span>}
                      {lr?.status === "done" && <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>check_circle</span>}
                      {lr?.status === "error" && <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-error)" }}>error</span>}
                    </div>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>{f.role}</p>
                  </div>
                </div>

                {/* 분석 결과 인라인 표시 */}
                {lr?.status === "done" && lr.data && (
                  <div className="mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed space-y-2" style={{ background: "var(--md-surface-container-low)" }}>
                    <LabMiniResult labId={f.id} data={lr.data} />
                  </div>
                )}
                {lr?.status === "loading" && (
                  <div className="mt-3 rounded-xl px-3 py-3 text-xs flex items-center gap-2" style={{ background: "var(--md-surface-container-low)", color: "var(--md-on-surface-variant)" }}>
                    <span className="m3-icon-sm animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                    분석 중...
                  </div>
                )}
                {lr?.status === "error" && (
                  <div className="mt-3 rounded-xl px-3 py-2.5 text-xs" style={{ background: "color-mix(in srgb, var(--md-error) 5%, var(--md-surface-container))", color: "var(--md-error)" }}>
                    {lr.error}
                  </div>
                )}
                {/* 브리핑 (아직 실제 결과가 없을 때) */}
                {(!lr || lr.status === "idle") && briefing && (
                  <div className="mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed flex items-start gap-2" style={{ background: "color-mix(in srgb, var(--md-primary) 5%, var(--md-surface-container))", color: "var(--md-on-surface)" }}>
                    <span className="m3-icon-sm shrink-0 mt-0.5" style={{ fontSize: 14, color: "var(--md-primary)" }}>lightbulb</span>
                    <span>{briefing.briefing}</span>
                  </div>
                )}
                {(!lr || lr.status === "idle") && !briefing && (
                  <p className="mt-3 text-xs italic" style={{ color: "var(--md-primary)" }}>&ldquo;{f.summary}&rdquo;</p>
                )}

                {/* 상세 보기 링크 */}
                <Link href={f.href} className="mt-auto pt-2 flex items-center gap-1 text-[11px] font-medium no-underline" style={{ color: "var(--md-primary)" }}>
                  <span>직접 탐구하기</span>
                  <span className="m3-icon-sm" style={{ fontSize: 14 }}>arrow_forward</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── 실험실별 미니 결과 표시 ──────────── */
function LabMiniResult({ labId, data }: { labId: string; data: Record<string, unknown> }) {
  switch (labId) {
    case "intent": {
      const intents = (data.intents as Array<{ name: string; percentage: number }>) ?? [];
      const summary = data.summary as string;
      return (
        <>
          {summary && <p style={{ color: "var(--md-on-surface)" }}>{summary}</p>}
          <div className="flex flex-wrap gap-1.5">
            {intents.slice(0, 4).map((intent, i) => (
              <span key={i} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "color-mix(in srgb, var(--md-primary) 10%, var(--md-surface-container))", color: "var(--md-on-surface)" }}>
                {intent.name} {intent.percentage}%
              </span>
            ))}
          </div>
        </>
      );
    }
    case "social-graph": {
      const narrative = data.narrative as string;
      const meta = data.meta as { nodeCount?: number; edgeCount?: number };
      return (
        <>
          {meta && <p style={{ color: "var(--md-on-surface-variant)" }}>{meta.nodeCount}개 키워드, {meta.edgeCount}개 연결</p>}
          {narrative && <p style={{ color: "var(--md-on-surface)" }}>{(narrative as string).slice(0, 150)}...</p>}
        </>
      );
    }
    case "cascade": {
      const cascade = data.cascade as { pattern?: string; events?: Array<{ platform: string; date: string }> };
      const narrative = data.narrative as string;
      const patternLabel: Record<string, string> = { "youtube-first": "유튜브 선행", "news-first": "뉴스 선행", simultaneous: "동시 발생", "search-only": "검색 단독" };
      return (
        <>
          {cascade?.pattern && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "color-mix(in srgb, var(--md-primary) 12%, var(--md-surface-container))", color: "var(--md-primary)" }}>
              {patternLabel[cascade.pattern] ?? cascade.pattern}
            </span>
          )}
          {narrative && <p style={{ color: "var(--md-on-surface)" }}>{(narrative as string).slice(0, 150)}...</p>}
        </>
      );
    }
    case "sequential": {
      const patterns = (data.patterns as Array<{ season: string; description: string }>) ?? [];
      const narrative = data.narrative as string;
      return (
        <>
          {patterns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {patterns.slice(0, 3).map((p, i) => (
                <span key={i} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "color-mix(in srgb, var(--md-primary) 10%, var(--md-surface-container))", color: "var(--md-on-surface)" }}>
                  {p.season}
                </span>
              ))}
            </div>
          )}
          {narrative && <p style={{ color: "var(--md-on-surface)" }}>{(narrative as string).slice(0, 150)}...</p>}
        </>
      );
    }
    case "markov": {
      const chain = (data.chain as string[]) ?? [];
      const story = data.story as string;
      return (
        <>
          {chain.length > 0 && (
            <p className="font-medium" style={{ color: "var(--md-primary)" }}>
              {chain.slice(0, 5).join(" → ")}
            </p>
          )}
          {story && <p style={{ color: "var(--md-on-surface)" }}>{(story as string).slice(0, 150)}...</p>}
        </>
      );
    }
    case "emotion": {
      const arc = data.arc as string;
      const timeline = (data.timeline as Array<{ period: string; dominantEmotion: string }>) ?? [];
      return (
        <>
          {timeline.length > 0 && (
            <p className="font-medium" style={{ color: "var(--md-primary)" }}>
              {timeline.map((t) => t.dominantEmotion).join(" → ")}
            </p>
          )}
          {arc && <p style={{ color: "var(--md-on-surface)" }}>{(arc as string).slice(0, 150)}...</p>}
        </>
      );
    }
    default:
      return <p style={{ color: "var(--md-on-surface-variant)" }}>분석 완료</p>;
  }
}
