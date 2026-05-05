"use client";

import { useEffect, useState } from "react";
import type { SpikeRange } from "@/lib/spike";

interface Hypothesis {
  title: string;
  reasoning: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
}
interface SpikeInsight {
  hypotheses: Hypothesis[];
  summary: string;
  topKeywords: string[];
  topComments: Array<{ text: string; likeCount: number; reason: string }>;
}

interface Refetched {
  peakDay: string;
  weekday: string;
  seasonal: string[];
  queries: string[];
  newsWindowCount: number;
  newsContextCount: number;
  blogsWindowCount: number;
  newsTotal: number;
  blogsTotal: number;
  videosCount: number;
  commentsCount: number;
  ratio: { naver: number; youtube: number };
}

interface PeakEvidence {
  peakVideos: Array<{ videoId: string; title: string; channelTitle: string; viewCount: number; publishedAt: string }>;
  peakBlogs: Array<{ title: string; link: string; description: string; pubDate: string }>;
  peakNews: Array<{ title: string; link: string; description: string; pubDate: string }>;
  peakComments: Array<{ text: string; likeCount: number }>;
}

interface Props {
  keyword: string;
  spike: SpikeRange;
  news: Array<{ title: string; description: string; link: string; pubDate: string }>;
  videos: Array<{ title: string; description: string; channelTitle: string; viewCount: number }>;
  comments: Array<{ text: string; likeCount: number }>;
}

const CONFIDENCE_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  high: { text: "높음", bg: "var(--md-primary)", color: "var(--md-on-primary)" },
  medium: { text: "보통", bg: "#1565C0", color: "white" },
  low: { text: "낮음", bg: "var(--md-outline)", color: "var(--md-on-surface)" },
};

export function SpikeAnalysisCard({ keyword, spike, news, videos, comments }: Props) {
  const [data, setData] = useState<SpikeInsight | null>(null);
  const [refetched, setRefetched] = useState<Refetched | null>(null);
  const [peakEvidence, setPeakEvidence] = useState<PeakEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // spike 변경 시 새 분석 요청
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setRefetched(null);
    setPeakEvidence(null);
    setError(null);
    fetch("/api/spike-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword,
        spike: {
          startPeriod: spike.startPeriod,
          endPeriod: spike.endPeriod,
          peakPeriod: spike.peakPeriod,
          peakRatio: spike.peakRatio,
          multiplier: spike.multiplier,
        },
        news,
        videos,
        comments,
      }),
    })
      .then(async (r) => {
        if (cancelled) return;
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `오류 ${r.status}`);
        setData(j.insight);
        if (j.refetched) setRefetched(j.refetched);
        if (j.evidence) setPeakEvidence(j.evidence);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [keyword, spike.startPeriod, spike.endPeriod, news, videos, comments]);

  return (
    <section className="m3-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="m3-chip-primary">
          <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-on-primary)" }}>local_fire_department</span>
          급등 구간 분석
        </span>
        <span className="font-mono m3-body-sm">
          {spike.startPeriod} ~ {spike.endPeriod}
        </span>
        <span className="m3-chip text-xs font-bold">
          평소 x{spike.multiplier.toFixed(1)} · 피크 {spike.peakRatio.toFixed(1)}
        </span>
      </div>

      {loading && (
        <div className="animate-pulse space-y-1 py-6 text-sm" style={{ color: "var(--md-primary)" }}>
          <div className="flex items-center gap-1.5">
            <span className="m3-icon-sm">search</span>
            피크 기간 YouTube 영상 재검색 + 네이버 블로그/뉴스 기간 쿼리...
          </div>
          <div className="m3-body-sm">Claude가 피크 시점 댓글, 영상, 기사로 가설을 좁히고 있습니다.</div>
        </div>
      )}

      {refetched && !loading && (
        <div className="mb-3 space-y-1.5 rounded-xl px-3 py-2 m3-body-sm" style={{ background: "var(--md-surface-container-low)", color: "var(--md-on-surface-variant)" }}>
          <div className="flex items-center gap-1.5">
            <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>refresh</span>
            <b style={{ color: "var(--md-on-surface)" }}>{refetched.peakDay}</b> ({refetched.weekday}요일){" "}
            {refetched.seasonal.length > 0 && (
              <span className="rounded-md px-1.5 py-0.5 font-semibold text-[11px]" style={{ background: "color-mix(in srgb, var(--md-primary) 12%, var(--md-surface-container))", color: "var(--md-primary)" }}>
                시즌: {refetched.seasonal.join(", ")}
              </span>
            )}
          </div>
          <div>
            <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>bar_chart</span>{" "}수집{" "}
            <b style={{ color: "var(--md-primary)" }}>네이버 {refetched.ratio.naver}건</b>
            {" ("}뉴스 {refetched.newsWindowCount}+{refetched.newsContextCount}, 블로그 {refetched.blogsWindowCount}{") "}
            · <b style={{ color: "var(--md-error)" }}>YouTube {refetched.ratio.youtube}건</b>
            {" ("}영상 {refetched.videosCount}, 댓글 {refetched.commentsCount}{")"}
          </div>
          {refetched.queries.length > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <span style={{ color: "var(--md-on-surface-variant)" }}>쿼리 {refetched.queries.length}개:</span>
              {refetched.queries.map((q, i) => (
                <span
                  key={i}
                  className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
                  style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}
                >
                  {q}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--md-error)", color: "var(--md-error)" }}>
          <span className="m3-icon-sm mr-1">error</span>분석 실패: {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* 종합 요약 */}
          <div className="rounded-xl p-3 text-sm leading-relaxed" style={{ background: "var(--md-surface-container-low)", color: "var(--md-on-surface)" }}>
            <span className="mr-1 font-semibold" style={{ color: "var(--md-primary)" }}>왜 떴나?</span>
            {data.summary}
          </div>

          {/* 핵심 키워드 */}
          {data.topKeywords?.length > 0 && (
            <div>
              <h4 className="m3-label-sm mb-1.5">
                급등 구간 키워드
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.topKeywords.map((k, i) => (
                  <span key={i} className="m3-chip text-xs">
                    #{k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 가설 카드 */}
          {data.hypotheses?.length > 0 && (
            <div>
              <h4 className="m3-label-sm mb-2">
                급등 가설
              </h4>
              <div className="grid gap-2 md:grid-cols-3">
                {data.hypotheses.map((h, i) => {
                  const conf = CONFIDENCE_LABEL[h.confidence] ?? CONFIDENCE_LABEL.medium;
                  return (
                    <article
                      key={i}
                      className="m3-card-outlined flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="m3-label-sm">#{i + 1}</span>
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: conf.bg, color: conf.color }}>
                          {conf.text}
                        </span>
                      </div>
                      <h5 className="mt-1 text-sm font-bold" style={{ color: "var(--md-on-surface)" }}>
                        {h.title}
                      </h5>
                      <p className="mt-1.5 flex-1 m3-body-sm leading-relaxed">
                        {h.reasoning}
                      </p>
                      {h.evidence?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {h.evidence.slice(0, 4).map((ev, j) => (
                            <span
                              key={j}
                              className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
                              style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}
                            >
                              {ev.slice(0, 50)}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* 피크 기간에 실제로 업로드된 YouTube 영상 */}
          {peakEvidence && peakEvidence.peakVideos?.length > 0 && (
            <div>
              <h4 className="m3-label-sm mb-2">
                피크 기간 YouTube 영상
              </h4>
              <div className="grid gap-2 md:grid-cols-2">
                {peakEvidence.peakVideos.slice(0, 6).map((v, i) => (
                  <a
                    key={v.videoId}
                    href={`https://youtu.be/${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="m3-card-outlined flex gap-3 transition hover:shadow-md"
                  >
                    <img
                      src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`}
                      alt=""
                      className="h-14 w-24 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2 m3-body-sm">
                        <span className="font-mono">유튜브{i + 1}</span>
                        <span>{v.publishedAt?.slice(0, 10)}</span>
                      </div>
                      <p className="line-clamp-2 text-xs font-semibold" style={{ color: "var(--md-on-surface)" }}>
                        {v.title}
                      </p>
                      <div className="m3-body-sm flex items-center gap-1">
                        {v.channelTitle} · <span className="m3-icon-sm" style={{ fontSize: 12 }}>visibility</span> {v.viewCount.toLocaleString()}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 피크 기간 블로그/뉴스 (쿼리 힌트 기반) */}
          {peakEvidence && (peakEvidence.peakBlogs?.length > 0 || peakEvidence.peakNews?.length > 0) && (
            <div>
              <h4 className="m3-label-sm mb-2">
                피크 기간 블로그·뉴스 (&ldquo;{keyword}&rdquo; 쿼리)
              </h4>
              <div className="space-y-1.5">
                {[...(peakEvidence.peakNews ?? []), ...(peakEvidence.peakBlogs ?? [])]
                  .slice(0, 8)
                  .map((n, i) => (
                    <a
                      key={n.link + i}
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="m3-card-outlined block transition hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 m3-body-sm">
                        <span className="font-mono">뉴스{i + 1}</span>
                        <span>{n.pubDate?.slice(0, 10)}</span>
                      </div>
                      <h5 className="text-xs font-semibold" style={{ color: "var(--md-on-surface)" }}>
                        {n.title}
                      </h5>
                      <p className="line-clamp-1 m3-body-sm">
                        {n.description}
                      </p>
                    </a>
                  ))}
              </div>
            </div>
          )}

          {/* 시사적 댓글 */}
          {data.topComments?.length > 0 && (
            <div>
              <h4 className="m3-label-sm mb-2">
                시사적 댓글
              </h4>
              <div className="grid gap-2 md:grid-cols-2">
                {data.topComments.map((c, i) => (
                  <div
                    key={i}
                    className="m3-card-outlined"
                  >
                    <p className="text-sm" style={{ color: "var(--md-on-surface)" }}>
                      &ldquo;{c.text}&rdquo;
                    </p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="m3-body-sm italic flex items-center gap-1" style={{ color: "var(--md-primary)" }}>
                        <span className="m3-icon-sm" style={{ fontSize: 12 }}>lightbulb</span> {c.reason}
                      </span>
                      <span className="m3-body-sm flex items-center gap-1">
                        <span className="m3-icon-sm" style={{ fontSize: 12 }}>thumb_up</span> {c.likeCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
