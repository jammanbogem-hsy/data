"use client";

import { useState } from "react";

interface Story {
  korean: string;
  englishEasy: string;
  englishNormal: string;
  koreanTitle: string;
  englishTitle: string;
}

interface Props {
  title: string;
  channelTitle: string;
  summary: string;
  keywords: Array<{ keyword: string }>;
  commentSentiment: { positive: number; negative: number; neutral: number; summary: string };
  videoPosition: { positive: number; negative: number; neutral: number };
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")   // # 제목
    .replace(/\*\*(.+?)\*\*/g, "$1") // **볼드**
    .replace(/\*(.+?)\*/g, "$1")     // *이탤릭*
    .replace(/^[-*]\s+/gm, "")       // - 리스트
    .replace(/^\d+\.\s+/gm, "")      // 1. 리스트
    .trim();
}

export function StudentStoryCard(props: Props) {
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"korean" | "englishEasy" | "englishNormal">("korean");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/youtube-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: props.title,
          channelTitle: props.channelTitle,
          summary: props.summary,
          keywords: props.keywords,
          sentiment: props.commentSentiment,
          videoPosition: props.videoPosition,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStory(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyText() {
    if (!story) return;
    const body = lang === "korean" ? story.korean : lang === "englishEasy" ? story.englishEasy : story.englishNormal;
    const title = lang === "korean" ? story.koreanTitle : story.englishTitle;
    const text = `${title}\n\n${body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="m3-section">
      <h3 className="m3-section-title">
        <span className="m3-icon" style={{ color: "var(--md-primary)" }}>school</span>
        학생용 읽기 자료
      </h3>
      <p className="m3-body-sm -mt-2">
        이 영상의 분석 결과를 초등 5-6학년이 이해할 수 있는 이야기로 만들어줍니다.
      </p>

      {!story && (
        <button
          onClick={generate}
          disabled={loading}
          className="m3-btn-filled flex items-center gap-2 disabled:opacity-50"
        >
          <span className="m3-icon-sm">{loading ? "hourglass_top" : "auto_stories"}</span>
          {loading ? "이야기를 만들고 있어요..." : "이야기 만들기"}
        </button>
      )}

      {error && (
        <div className="rounded-m3-md border p-3 text-sm" style={{ borderColor: "var(--md-error)", color: "var(--md-error)" }}>
          {error}
        </div>
      )}

      {story && (
        <div className="m3-card space-y-4">
          {/* 언어 토글 + 복사 */}
          <div className="flex items-center justify-between">
            <div className="flex rounded-m3-md border overflow-hidden" style={{ borderColor: "var(--md-outline)" }}>
              {([
                { key: "korean" as const, label: "한글" },
                { key: "englishEasy" as const, label: "Easy English" },
                { key: "englishNormal" as const, label: "English" },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setLang(t.key)}
                  className="px-4 py-2 text-sm font-medium transition"
                  style={{
                    background: lang === t.key ? "var(--md-primary)" : "var(--md-surface-container)",
                    color: lang === t.key ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={generate}
                disabled={loading}
                className="m3-btn-tonal flex items-center gap-1.5 text-xs disabled:opacity-50"
              >
                <span className="m3-icon-sm">refresh</span>
                다시 만들기
              </button>
              <button
                onClick={copyText}
                className="m3-btn-outlined flex items-center gap-1.5 text-xs"
              >
                <span className="m3-icon-sm">{copied ? "check" : "content_copy"}</span>
                {copied ? "복사됨" : "복사하기"}
              </button>
            </div>
          </div>

          {/* 이야기 본문 */}
          <article
            className="rounded-m3-md p-5"
            style={{
              background: "var(--md-surface-container-low)",
              lineHeight: 1.9,
            }}
          >
            <h4
              className="mb-3 text-lg font-bold"
              style={{ color: "var(--md-primary)" }}
            >
              {lang === "korean" ? story.koreanTitle : story.englishTitle}
            </h4>
            {lang !== "korean" && (
              <div className="mb-2 m3-body-sm" style={{ color: "var(--md-primary)" }}>
                {lang === "englishEasy" ? "Easy level — 초등 3-4학년 수준" : "Normal level — 초등 5-6학년 수준"}
              </div>
            )}
            <div
              className="whitespace-pre-line text-sm"
              style={{ color: "var(--md-on-surface)", lineHeight: lang === "korean" ? 1.9 : 1.8 }}
            >
              {stripMarkdown(
                lang === "korean" ? story.korean
                  : lang === "englishEasy" ? (story.englishEasy ?? story.englishNormal ?? "")
                  : (story.englishNormal ?? "")
              )}
            </div>
          </article>

          <p className="m3-body-sm text-center">
            이 글은 AI가 영상 분석 결과를 바탕으로 자동 생성한 것입니다.
          </p>
        </div>
      )}
    </section>
  );
}
