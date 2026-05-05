"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpikeRange } from "@/lib/spike";
import { CitationText } from "./CitationText";

interface Hypothesis {
  title: string;
  reasoning: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
}
export interface SpikeInsight {
  hypotheses: Hypothesis[];
  summary: string;
  topKeywords: string[];
  topComments: Array<{ text: string; likeCount: number; reason: string }>;
  prevDayEvents?: Array<{ event: string; evidence: string }>;
  sameDayEvents?: Array<{ event: string; evidence: string }>;
}
export interface Refetched {
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
  debug?: {
    newsBufferDays: number;
    blogsBufferDays: number;
    newsFallback: boolean;
    blogsFallback: boolean;
    firstNewsDate: string;
    firstBlogDate: string;
    newestInWindowNews: string;
    newestInWindowBlogs: string;
  };
}
export interface SentimentTimeline {
  buckets: Array<{
    label: string;
    dateRange: string;
    itemCount: number;
    positive: number;
    negative: number;
    neutral: number;
    dominantNote: string;
  }>;
  narrative: string;
}
export interface PeakEvidence {
  peakVideos: Array<{ videoId: string; title: string; channelTitle: string; viewCount: number; publishedAt: string }>;
  peakBlogs: Array<{ title: string; link: string; description: string; pubDate: string }>;
  peakNews: Array<{ title: string; link: string; description: string; pubDate: string }>;
  peakComments: Array<{ text: string; likeCount: number }>;
}

const CONF = {
  high: { text: "높음", bg: "var(--md-primary)", color: "var(--md-on-primary)" },
  medium: { text: "보통", bg: "#1565C0", color: "white" },
  low: { text: "낮음", bg: "var(--md-outline)", color: "var(--md-on-surface)" },
};

// 좌측 네비 항목
const NAV_ITEMS = [
  { id: "overview", icon: "summarize", label: "개요" },
  { id: "events", icon: "event", label: "사건" },
  { id: "keywords", icon: "tag", label: "키워드" },
  { id: "hypotheses", icon: "lightbulb", label: "가설" },
  { id: "videos", icon: "smart_display", label: "영상" },
  { id: "news", icon: "newspaper", label: "뉴스" },
  { id: "comments", icon: "chat_bubble", label: "댓글" },
];

interface Props {
  keyword: string;
  color: string;
  spike: SpikeRange;
  data: SpikeInsight | null;
  refetched: Refetched | null;
  peakEvidence: PeakEvidence | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export function SpikeAnalysisModal({
  keyword, color, spike, data, refetched, peakEvidence, loading, error, onClose,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeNav, setActiveNav] = useState("overview");

  // 출처 맵: peakEvidence에서 V1, N1 등 생성
  const citations = useMemo(() => {
    const map: Record<string, any> = {};
    peakEvidence?.peakVideos?.forEach((v, i) => {
      map[`V${i + 1}`] = { label: `V${i + 1}`, title: v.title, description: v.channelTitle, link: `https://youtu.be/${v.videoId}`, pubDate: v.publishedAt };
    });
    peakEvidence?.peakNews?.forEach((n, i) => {
      map[`N${i + 1}`] = { label: `N${i + 1}`, title: n.title, description: n.description?.slice(0, 120), link: n.link, pubDate: n.pubDate };
    });
    peakEvidence?.peakBlogs?.forEach((b, i) => {
      const idx = (peakEvidence?.peakNews?.length ?? 0) + i + 1;
      map[`N${idx}`] = { label: `N${idx}`, title: b.title, description: b.description?.slice(0, 120), link: b.link, pubDate: b.pubDate };
    });
    peakEvidence?.peakComments?.forEach((c, i) => {
      map[`C${i + 1}`] = { label: `C${i + 1}`, title: c.text?.slice(0, 80), description: `좋아요 ${c.likeCount ?? 0}` };
    });
    return map;
  }, [peakEvidence]);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Focus trap: Tab cycles within modal
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Auto-focus the modal on open
    modalRef.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  function scrollTo(id: string) {
    setActiveNav(id);
    const el = document.getElementById(`spike-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 max-md:p-0"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${keyword} 급등 분석 모달`}
    >
      <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} aria-hidden="true" />
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative flex h-[90vh] w-full max-w-5xl overflow-hidden rounded-m3-lg max-md:h-full max-md:max-w-none max-md:rounded-none"
        style={{ background: "var(--md-surface-container)", boxShadow: "var(--md-elevation-3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 좌측 카테고리 네비 */}
        <nav
          className="hidden w-48 shrink-0 flex-col gap-0.5 border-r py-4 sm:flex"
          style={{ borderColor: "var(--md-outline-variant)", background: "var(--md-surface-container-low)" }}
        >
          <div className="px-4 pb-3">
            <div className="m3-label-sm" style={{ color: "var(--md-primary)" }}>급등 분석</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: "var(--md-on-surface)" }}>{keyword}</div>
            <div className="m3-body-sm">{spike.peakPeriod}</div>
          </div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition"
              style={{
                background: activeNav === item.id ? "var(--md-primary)" : "transparent",
                color: activeNav === item.id ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
                borderRadius: "0 var(--md-radius-xl) var(--md-radius-xl) 0",
                marginRight: "8px",
                fontWeight: activeNav === item.id ? 600 : 400,
              }}
            >
              <span className="m3-icon-sm">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* 우측 콘텐츠 */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          {/* 닫기 */}
          <button
            onClick={onClose}
            aria-label="모달 닫기"
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full transition"
            style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}
          >
            <span className="m3-icon-sm" aria-hidden="true">close</span>
          </button>

          {/* 헤더 */}
          <div className="border-b px-6 pb-4 pt-5" style={{ borderColor: "var(--md-outline-variant)" }}>
            <div className="flex flex-wrap items-center gap-2 pr-10">
              <span className="m3-chip-primary" style={{ background: color }}>
                <span className="m3-icon-sm" style={{ fontSize: 16 }}>trending_up</span>
                급등 구간
              </span>
              <span className="m3-body-sm font-mono">
                {spike.startPeriod} ~ {spike.endPeriod}
              </span>
              <span className="m3-chip" style={{ fontWeight: 600 }}>
                평소 x{spike.multiplier.toFixed(1)} · 피크 {spike.peakRatio.toFixed(1)}
              </span>
            </div>
            {refetched && !loading && (
              <div className="mt-2 flex flex-wrap items-center gap-2 m3-body-sm">
                <span>{refetched.peakDay} ({refetched.weekday}요일)</span>
                {refetched.seasonal.length > 0 && (
                  <span className="m3-chip" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)", fontSize: 11 }}>
                    시즌: {refetched.seasonal.join(", ")}
                  </span>
                )}
                <span>네이버 {refetched.ratio.naver}건 · YouTube {refetched.ratio.youtube}건</span>
              </div>
            )}
          </div>

          {loading && (
            <div className="animate-pulse space-y-2 p-6">
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--md-primary)" }}>
                <span className="m3-icon-sm">hourglass_top</span>
                자료를 모아 분석하고 있어요...
              </div>
              <p className="m3-body-sm">네이버 뉴스, YouTube 영상을 읽고 원인을 찾는 중입니다.</p>
            </div>
          )}

          {error && (
            <div className="m-6 rounded-m3-md border p-4 text-sm" style={{ borderColor: "var(--md-error)", color: "var(--md-error)" }}>
              <span className="m3-icon-sm mr-1">error</span>{error}
            </div>
          )}

          {data && (
            <div className="space-y-6 p-6">
              {/* AI 오버뷰 */}
              <section id="spike-overview">
                <h3 className="m3-section-title mb-3">
                  <span className="m3-icon" style={{ color: "var(--md-primary)" }}>auto_awesome</span>
                  AI 오버뷰
                </h3>
                <div
                  className="rounded-m3-lg p-5"
                  style={{
                    background: "linear-gradient(135deg, color-mix(in srgb, var(--md-primary) 5%, var(--md-surface-container)), var(--md-surface-container))",
                    borderLeft: "3px solid var(--md-primary)",
                  }}
                >
                  <div className="whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--md-on-surface)" }}>
                    <CitationText text={data.summary} citations={citations} />
                  </div>
                </div>
              </section>

              {/* 사건 */}
              {((data.prevDayEvents?.length ?? 0) > 0 || (data.sameDayEvents?.length ?? 0) > 0) && (
                <section id="spike-events">
                  <h3 className="m3-section-title mb-3">
                    <span className="m3-icon" style={{ color: "var(--md-primary)" }}>event</span>
                    전날·당일 사건
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(data.prevDayEvents?.length ?? 0) > 0 && (
                      <div className="m3-card-outlined">
                        <h4 className="m3-label-sm mb-2">전날 (D-1)</h4>
                        <ul className="space-y-1.5 m3-body-sm">
                          {data.prevDayEvents!.map((e, i) => (
                            <li key={i}><CitationText text={`${e.event} ${e.evidence}`} citations={citations} /></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(data.sameDayEvents?.length ?? 0) > 0 && (
                      <div className="m3-card-outlined">
                        <h4 className="m3-label-sm mb-2">당일 (D)</h4>
                        <ul className="space-y-1.5 m3-body-sm">
                          {data.sameDayEvents!.map((e, i) => (
                            <li key={i}><CitationText text={`${e.event} ${e.evidence}`} citations={citations} /></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 키워드 */}
              {data.topKeywords?.length > 0 && (
                <section id="spike-keywords">
                  <h3 className="m3-section-title mb-2">
                    <span className="m3-icon" style={{ color: "var(--md-primary)" }}>tag</span>
                    급등 구간 키워드
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {data.topKeywords.map((k, i) => (
                      <span key={i} className="m3-chip">#{k}</span>
                    ))}
                  </div>
                </section>
              )}

              {/* 가설 */}
              {data.hypotheses?.length > 0 && (
                <section id="spike-hypotheses">
                  <h3 className="m3-section-title mb-3">
                    <span className="m3-icon" style={{ color: "var(--md-primary)" }}>lightbulb</span>
                    이 급등의 원인 가설
                  </h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    {data.hypotheses.map((h, i) => {
                      const conf = CONF[h.confidence] ?? CONF.medium;
                      return (
                        <article key={i} className="m3-card flex flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <span className="m3-label-sm">가설 {i + 1}</span>
                            <span className="rounded-m3-sm px-2 py-0.5 text-[11px] font-semibold" style={{ background: conf.bg, color: conf.color }}>
                              {conf.text}
                            </span>
                          </div>
                          <h4 className="mt-2 text-sm font-bold" style={{ color: "var(--md-on-surface)" }}>{h.title}</h4>
                          <p className="mt-1.5 flex-1 m3-body-sm leading-relaxed"><CitationText text={h.reasoning} citations={citations} /></p>
                          {h.evidence?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {h.evidence.slice(0, 4).map((ev, j) => (
                                <span key={j} className="rounded-m3-sm px-1.5 py-0.5 text-[10px] font-mono" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>
                                  {ev.slice(0, 50)}
                                </span>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 영상 */}
              {peakEvidence && peakEvidence.peakVideos?.length > 0 && (
                <section id="spike-videos">
                  <h3 className="m3-section-title mb-3">
                    <span className="m3-icon" style={{ color: "var(--md-primary)" }}>smart_display</span>
                    피크 기간 YouTube 영상
                  </h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {peakEvidence.peakVideos.slice(0, 6).map((v, i) => (
                      <a key={v.videoId} href={`https://youtu.be/${v.videoId}`} target="_blank" rel="noopener noreferrer"
                         className="m3-card-outlined flex gap-3 transition hover:shadow-m3-2">
                        <img src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`} alt={`${v.title} 썸네일`} loading="lazy" sizes="96px" className="h-14 w-24 rounded-m3-sm object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="m3-body-sm flex justify-between"><span className="font-mono">유튜브{i + 1}</span><span>{v.publishedAt?.slice(0, 10)}</span></div>
                          <p className="line-clamp-2 text-sm font-medium" style={{ color: "var(--md-on-surface)" }}>{v.title}</p>
                          <div className="m3-body-sm">{v.channelTitle} · {v.viewCount.toLocaleString()}회</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* 뉴스 */}
              {peakEvidence && (peakEvidence.peakBlogs?.length > 0 || peakEvidence.peakNews?.length > 0) && (
                <section id="spike-news">
                  <h3 className="m3-section-title mb-3">
                    <span className="m3-icon" style={{ color: "var(--md-primary)" }}>newspaper</span>
                    피크 기간 뉴스·블로그
                  </h3>
                  <div className="space-y-1.5">
                    {[...(peakEvidence.peakNews ?? []), ...(peakEvidence.peakBlogs ?? [])]
                      .slice(0, 10)
                      .map((n, i) => (
                        <a key={n.link + i} href={n.link} target="_blank" rel="noopener noreferrer"
                           className="m3-card-outlined block transition hover:shadow-m3-1">
                          <div className="flex justify-between m3-body-sm"><span className="font-mono">뉴스{i + 1}</span><span>{n.pubDate?.slice(0, 10)}</span></div>
                          <h5 className="text-sm font-medium" style={{ color: "var(--md-on-surface)" }}>{n.title}</h5>
                          <p className="line-clamp-1 m3-body-sm">{n.description}</p>
                        </a>
                      ))}
                  </div>
                </section>
              )}

              {/* 댓글 */}
              {data.topComments?.length > 0 && (
                <section id="spike-comments">
                  <h3 className="m3-section-title mb-3">
                    <span className="m3-icon" style={{ color: "var(--md-primary)" }}>chat_bubble</span>
                    주목할 만한 댓글
                  </h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {data.topComments.map((c, i) => (
                      <div key={i} className="m3-card-outlined">
                        <p className="text-sm" style={{ color: "var(--md-on-surface)" }}>&ldquo;{c.text}&rdquo;</p>
                        <div className="mt-1.5 flex items-center justify-between m3-body-sm">
                          <span style={{ color: "var(--md-primary)" }}>{c.reason}</span>
                          <span>좋아요 {c.likeCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
