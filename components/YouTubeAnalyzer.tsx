"use client";

import { useMemo, useState } from "react";
import { analyzeComments, type CommentAnalysisResult } from "@/lib/comment-analyze";
import { WordCloud } from "./WordCloud";
import { StudentStoryCard } from "./StudentStoryCard";

interface Video {
  videoId: string; title: string; description: string; channelTitle: string;
  publishedAt: string; viewCount: number; likeCount: number; commentCount: number;
  thumbnail: string; tags: string[];
}
interface Keyword { keyword: string; count: number; sentiment: "positive" | "negative" | "neutral"; emotion?: string }
interface NotableComment { index: number; text: string; likeCount: number; sentiment: "positive" | "negative" | "neutral"; insight: string }
interface Analysis {
  summary: string;
  videoPosition: { positive: number; negative: number; neutral: number; reasoning: string };
  commentSentiment: { positive: number; negative: number; neutral: number; summary: string };
  topKeywords: Keyword[];
  notableComments: NotableComment[];
}
interface Result {
  video: Video; analysis: Analysis; commentsCollected: number;
  rawComments?: Array<{ text: string; likeCount: number }>;
}

function formatK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return String(n);
}

export function YouTubeAnalyzer() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [kwView, setKwView] = useState<"map" | "table">("map");

  async function analyze() {
    if (!url.trim()) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/youtube-analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: url.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `오류 ${r.status}`);
      setResult(d);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* 입력 */}
      <form onSubmit={(e) => { e.preventDefault(); analyze(); }} className="flex items-stretch gap-3">
        <input
          value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="유튜브 링크를 붙여넣으세요 (예: https://youtu.be/...)"
          disabled={busy}
          className="h-12 flex-1 rounded-m3-md border px-4 text-base focus:outline-none focus:ring-2"
          style={{ background: "var(--md-surface-container)", borderColor: "var(--md-outline)", color: "var(--md-on-surface)" }}
        />
        <button type="submit" disabled={busy || !url.trim()} className="m3-btn-filled flex h-12 items-center gap-2 whitespace-nowrap disabled:opacity-50">
          <span className="m3-icon-sm">play_arrow</span>
          {busy ? "분석 중..." : "영상 분석"}
        </button>
      </form>

      {busy && (
        <div className="m3-card animate-pulse">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--md-primary)" }}>
            <span className="m3-icon-sm">hourglass_top</span>
            영상 정보와 댓글을 수집하고 AI가 분석하고 있어요...
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-m3-md border p-4 text-sm" style={{ borderColor: "var(--md-error)", color: "var(--md-error)" }}>
          <span className="m3-icon-sm mr-1">error</span>{error}
        </div>
      )}

      {result && (() => {
        const { video: v, analysis: a } = result;
        // 프론트 실제 빈도 분석 (Claude 아닌 데이터 직접 카운팅)
        const realAnalysis: CommentAnalysisResult | null = result.rawComments
          ? analyzeComments(result.rawComments)
          : null;
        return (
          <div className="space-y-6">
            {/* 영상 정보 카드 */}
            <div className="m3-card flex gap-4">
              <a href={`https://youtu.be/${v.videoId}`} target="_blank" rel="noopener noreferrer">
                <img src={v.thumbnail} alt="" className="h-24 w-40 shrink-0 rounded-m3-sm object-cover" />
              </a>
              <div className="min-w-0 flex-1">
                <a href={`https://youtu.be/${v.videoId}`} target="_blank" rel="noopener noreferrer" className="m3-title-md hover:underline" style={{ color: "var(--md-on-surface)", textDecoration: "none" }}>
                  {v.title}
                </a>
                <div className="mt-1 m3-body-sm">{v.channelTitle} · {v.publishedAt?.slice(0, 10)}</div>
                <div className="mt-1 flex gap-3 m3-body-sm">
                  <span>조회 {formatK(v.viewCount)}</span>
                  <span>좋아요 {formatK(v.likeCount)}</span>
                  <span>댓글 {formatK(v.commentCount)}</span>
                </div>
                {v.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.tags.slice(0, 8).map((t, i) => <span key={i} className="m3-chip text-[11px]">#{t}</span>)}
                  </div>
                )}
              </div>
            </div>

            {/* 영상 요약 */}
            <div className="m3-card">
              <h3 className="m3-section-title mb-2">
                <span className="m3-icon" style={{ color: "var(--md-primary)" }}>summarize</span>
                영상 요약
              </h3>
              <p className="m3-body-md leading-relaxed">{a.summary}</p>
            </div>

            {/* 포지션 분석 2개 카드 */}
            <div className="grid gap-4 md:grid-cols-2">
              <PositionCard
                title="영상 포지션"
                icon="movie"
                data={a.videoPosition}
                reasoning={a.videoPosition.reasoning}
              />
              <PositionCard
                title="댓글 반응"
                icon="forum"
                data={a.commentSentiment}
                reasoning={a.commentSentiment.summary}
                subtitle={`수집 ${result.commentsCollected}개`}
              />
            </div>

            {/* 실제 빈도 기반 감정 분포 (데이터 직접 계산) */}
            {realAnalysis && (
              <div className="m3-card">
                <h3 className="m3-section-title mb-3">
                  <span className="m3-icon" style={{ color: "var(--md-primary)" }}>bar_chart</span>
                  댓글 감정 분포 (실제 빈도 기반)
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex flex-col items-center rounded-m3-md p-4" style={{ background: "color-mix(in srgb, var(--md-primary) 10%, var(--md-surface-container))" }}>
                    <span className="text-3xl font-bold" style={{ color: "var(--md-primary)" }}>{realAnalysis.sentimentDist.positive}%</span>
                    <span className="m3-body-sm mt-1">긍정 댓글</span>
                  </div>
                  <div className="flex flex-col items-center rounded-m3-md p-4" style={{ background: "var(--md-surface-container-high)" }}>
                    <span className="text-3xl font-bold" style={{ color: "var(--md-on-surface-variant)" }}>{realAnalysis.sentimentDist.neutral}%</span>
                    <span className="m3-body-sm mt-1">중립 댓글</span>
                  </div>
                  <div className="flex flex-col items-center rounded-m3-md p-4" style={{ background: "color-mix(in srgb, var(--md-error) 10%, var(--md-surface-container))" }}>
                    <span className="text-3xl font-bold" style={{ color: "var(--md-error)" }}>{realAnalysis.sentimentDist.negative}%</span>
                    <span className="m3-body-sm mt-1">부정 댓글</span>
                  </div>
                </div>
                <div className="mt-3 flex justify-between m3-body-sm">
                  <span>총 {realAnalysis.totalComments}개 댓글 분석</span>
                  <span>평균 길이 {realAnalysis.avgLength}자</span>
                </div>
              </div>
            )}

            {/* 실제 빈도 기반 워드맵 (데이터 직접 카운팅) */}
            {realAnalysis && realAnalysis.topKeywords.length > 0 && (
              <div className="m3-card">
                <h3 className="m3-section-title mb-3">
                  <span className="m3-icon" style={{ color: "var(--md-primary)" }}>data_array</span>
                  댓글 실제 빈도 키워드 (데이터 기반)
                </h3>
                <p className="m3-body-sm mb-3">댓글 원문에서 직접 카운팅한 결과입니다. AI 추측이 아닌 실제 등장 횟수.</p>
                <WordCloud
                  words={realAnalysis.topKeywords.slice(0, 25).map((k) => ({
                    text: k.keyword,
                    value: k.count,
                    sentiment: k.sentiment,
                  }))}
                  height={300}
                  comments={result.rawComments}
                />
              </div>
            )}

            {/* AI 분석 키워드 (Claude 기반) */}
            <div className="m3-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="m3-section-title">
                  <span className="m3-icon" style={{ color: "var(--md-primary)" }}>psychology</span>
                  AI가 분석한 핵심 키워드
                </h3>
                <div className="flex rounded-m3-md border overflow-hidden" style={{ borderColor: "var(--md-outline)" }}>
                  <button onClick={() => setKwView("map")} className="px-3 py-1.5 text-xs font-medium" style={{ background: kwView === "map" ? "var(--md-primary)" : "var(--md-surface-container)", color: kwView === "map" ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>워드맵</button>
                  <button onClick={() => setKwView("table")} className="px-3 py-1.5 text-xs font-medium" style={{ background: kwView === "table" ? "var(--md-primary)" : "var(--md-surface-container)", color: kwView === "table" ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>테이블</button>
                </div>
              </div>

              {kwView === "map" ? (
                <WordCloud
                  words={a.topKeywords.map((k) => ({
                    text: k.keyword,
                    value: k.count,
                    sentiment: k.sentiment,
                  }))}
                  height={320}
                  comments={result.rawComments}
                />
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                      <th className="p-2 text-left m3-label-sm">키워드</th>
                      <th className="p-2 text-center m3-label-sm">감정</th>
                      <th className="p-2 text-right m3-label-sm">빈도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.topKeywords.map((k, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                        <td className="p-2 font-medium" style={{ color: "var(--md-on-surface)" }}>{k.keyword}</td>
                        <td className="p-2 text-center">
                          <span className="h-3 w-3 inline-block rounded-full" style={{ background: k.sentiment === "positive" ? "var(--md-primary)" : k.sentiment === "negative" ? "var(--md-error)" : "var(--md-outline)" }} />
                        </td>
                        <td className="p-2 text-right tabular-nums">{k.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 주목할 댓글 */}
            {a.notableComments?.length > 0 && (
              <div className="m3-section">
                <h3 className="m3-section-title">
                  <span className="m3-icon" style={{ color: "var(--md-primary)" }}>chat_bubble</span>
                  주목할 댓글
                </h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {a.notableComments.map((c, i) => (
                    <div key={i} className="m3-card-outlined" style={{ borderLeft: `3px solid ${c.sentiment === "positive" ? "var(--md-primary)" : c.sentiment === "negative" ? "var(--md-error)" : "var(--md-outline)"}` }}>
                      <p className="text-sm" style={{ color: "var(--md-on-surface)" }}>&ldquo;{c.text}&rdquo;</p>
                      <div className="mt-1.5 flex items-center justify-between m3-body-sm">
                        <span style={{ color: "var(--md-primary)" }}>{c.insight}</span>
                        <span>좋아요 {c.likeCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 학생용 읽기 자료 */}
            <StudentStoryCard
              title={v.title}
              channelTitle={v.channelTitle}
              summary={a.summary}
              keywords={a.topKeywords}
              commentSentiment={a.commentSentiment}
              videoPosition={a.videoPosition}
            />
          </div>
        );
      })()}
    </div>
  );
}

function PositionCard({ title, icon, data, reasoning, subtitle }: {
  title: string; icon: string;
  data: { positive: number; negative: number; neutral: number };
  reasoning: string; subtitle?: string;
}) {
  return (
    <div className="m3-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="m3-section-title">
          <span className="m3-icon" style={{ color: "var(--md-primary)" }}>{icon}</span>
          {title}
        </h3>
        {subtitle && <span className="m3-body-sm">{subtitle}</span>}
      </div>
      <div className="h-3 overflow-hidden rounded-full" style={{ background: "var(--md-surface-container-high)" }}>
        <div className="flex h-full">
          <div style={{ width: `${data.positive}%`, background: "var(--md-primary)" }} />
          <div style={{ width: `${data.neutral}%`, background: "var(--md-outline)" }} />
          <div style={{ width: `${data.negative}%`, background: "var(--md-error)" }} />
        </div>
      </div>
      <div className="mt-2 flex gap-4 m3-body-sm">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--md-primary)" }} /> 긍정 {data.positive}%</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--md-outline)" }} /> 중립 {data.neutral}%</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--md-error)" }} /> 부정 {data.negative}%</span>
      </div>
      <p className="mt-3 m3-body-sm italic">{reasoning}</p>
    </div>
  );
}
