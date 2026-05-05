"use client";

import { useRef, useState } from "react";

interface Citation {
  label: string;
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
}

interface Props {
  text: string;
  citations?: Record<string, Citation>;
}

export function CitationText({ text, citations = {} }: Props) {
  const parts = text.split(/(\[(?:N|V|C|E)\d+(?:-\d+)?\])/g);
  return (
    <span>
      {parts.map((part, i) => {
        const match = part.match(/^\[((?:N|V|C|E)\d+(?:-\d+)?)\]$/);
        if (match) {
          return <CitationChip key={i} label={part} data={citations[match[1]]} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

const LABEL_MAP: Record<string, string> = { N: "뉴스", V: "유튜브", C: "댓글", E: "근거" };

function toKoreanLabel(raw: string): string {
  // [N3] → 뉴스3, [E1-2] → 근거1-2
  const m = raw.match(/^\[(N|V|C|E)(\d+(?:-\d+)?)\]$/);
  if (!m) return raw;
  return `${LABEL_MAP[m[1]] ?? m[1]}${m[2]}`;
}

function CitationChip({ label, data }: { label: string; data?: Citation }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  function show() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const rect = chipRef.current?.getBoundingClientRect();
    if (rect) setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setOpen(true);
  }

  function delayHide() {
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  }

  function keepOpen() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  return (
    <>
      <span
        ref={chipRef}
        className="inline-block cursor-help rounded px-1 py-0.5 text-[11px] font-mono font-semibold underline decoration-dotted"
        style={{
          color: "var(--md-primary)",
          background: "color-mix(in srgb, var(--md-primary) 8%, var(--md-surface-container))",
        }}
        onMouseEnter={show}
        onMouseLeave={delayHide}
        onClick={(e) => { e.stopPropagation(); show(); }}
      >
        {toKoreanLabel(label)}
      </span>

      {open && data && (
        <div
          className="fixed rounded-m3-md p-3 text-xs"
          style={{
            zIndex: 99999,
            left: Math.max(16, Math.min(pos.x - 160, (typeof window !== "undefined" ? window.innerWidth : 1000) - 336)),
            top: Math.max(8, pos.y - 8),
            transform: "translateY(-100%)",
            width: 320,
            background: "var(--md-surface-container)",
            boxShadow: "var(--md-elevation-3)",
            border: "1px solid var(--md-outline-variant)",
          }}
          onMouseEnter={keepOpen}
          onMouseLeave={delayHide}
        >
          {data.title && (
            <div className="font-semibold leading-snug" style={{ color: "var(--md-on-surface)" }}>
              {data.title}
            </div>
          )}
          {data.description && (
            <p className="mt-1 line-clamp-3 leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
              {data.description}
            </p>
          )}
          {data.pubDate && (
            <span className="mt-1 block" style={{ color: "var(--md-on-surface-variant)" }}>
              {data.pubDate.slice(0, 10)}
            </span>
          )}
          {data.link && (
            <a
              href={data.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 font-medium"
              style={{ color: "var(--md-primary)" }}
            >
              <span className="m3-icon-sm" style={{ fontSize: 12 }}>open_in_new</span>
              원문 보기
            </a>
          )}
          {!data.title && !data.description && (
            <span style={{ color: "var(--md-on-surface-variant)" }}>출처 정보를 불러올 수 없습니다</span>
          )}
        </div>
      )}
    </>
  );
}

export function buildCitationMap(evidence: {
  news?: Array<{ title: string; description?: string; link?: string; pubDate?: string }>;
  videos?: Array<{ title: string; channelTitle?: string; videoId?: string }>;
  comments?: Array<{ text: string; likeCount?: number }>;
}): Record<string, Citation> {
  const map: Record<string, Citation> = {};
  (evidence.news ?? []).forEach((n, i) => {
    map[`N${i + 1}`] = { label: `N${i + 1}`, title: n.title, description: n.description?.slice(0, 150), link: n.link, pubDate: n.pubDate };
  });
  (evidence.videos ?? []).forEach((v, i) => {
    map[`V${i + 1}`] = { label: `V${i + 1}`, title: v.title, description: v.channelTitle, link: v.videoId ? `https://youtu.be/${v.videoId}` : undefined };
  });
  (evidence.comments ?? []).forEach((c, i) => {
    map[`C${i + 1}`] = { label: `C${i + 1}`, title: c.text?.slice(0, 80), description: c.likeCount ? `좋아요 ${c.likeCount}` : undefined };
  });
  return map;
}
