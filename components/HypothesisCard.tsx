"use client";

import { useState } from "react";

interface Hypothesis {
  title: string;
  reasoning: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
}

interface DeepenResult {
  refined: Hypothesis;
  rationale: string;
  queries: string[];
  evidence: Array<{ query: string; newsCount: number; sample: Array<{ title: string; link: string; pubDate: string }> }>;
}

const CONF = {
  high: { text: "높음", bg: "var(--md-primary)", color: "var(--md-on-primary)" },
  medium: { text: "보통", bg: "#1565C0", color: "white" },
  low: { text: "낮음", bg: "var(--md-outline)", color: "var(--md-on-surface)" },
};

export function HypothesisCard({ index, hypothesis, keyword }: { index: number; hypothesis: Hypothesis; keyword: string }) {
  const [deepened, setDeepened] = useState<DeepenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = deepened?.refined ?? hypothesis;

  async function doDeepen() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deepen-hypothesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, hypothesis: current }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `오류 ${res.status}`);
      setDeepened(j);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  const conf = CONF[current.confidence] ?? CONF.medium;

  return (
    <article className="m3-card flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <span className="m3-label-sm">가설 {index + 1}{deepened && <span className="ml-1" style={{ color: "var(--md-primary)" }}>검증됨</span>}</span>
        <span className="rounded-m3-sm px-2 py-0.5 text-[11px] font-semibold" style={{ background: conf.bg, color: conf.color }}>{conf.text}</span>
      </div>
      <h4 className="mt-2 text-sm font-bold" style={{ color: "var(--md-on-surface)" }}>{current.title}</h4>
      <p className="mt-1.5 flex-1 m3-body-sm leading-relaxed">{current.reasoning}</p>
      {current.evidence?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {current.evidence.slice(0, 6).map((ev, j) => (
            <span key={j} className="rounded-m3-sm px-1.5 py-0.5 font-mono text-[10px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>
              {ev.slice(0, 60)}
            </span>
          ))}
        </div>
      )}
      {deepened && (
        <div className="mt-3 rounded-m3-md p-2.5 m3-body-sm" style={{ background: "var(--md-surface-container-low)", color: "var(--md-on-surface-variant)" }}>
          <div className="font-medium" style={{ color: "var(--md-primary)" }}>검증 결과</div>
          <p className="mt-0.5">{deepened.rationale}</p>
          {deepened.evidence?.length > 0 && (
            <div className="mt-2 space-y-1">
              {deepened.evidence.map((ev, i) => (
                <details key={i} className="text-[11px]">
                  <summary className="cursor-pointer"><span className="font-mono">&quot;{ev.query}&quot;</span> ({ev.newsCount}건)</summary>
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {ev.sample.slice(0, 4).map((s, k) => (
                      <li key={k} className="truncate"><a href={s.link} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "var(--md-primary)" }}>{s.title}</a></li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <div className="mt-2 rounded-m3-sm p-2 text-xs" style={{ color: "var(--md-error)" }}>{error}</div>}
      <button onClick={doDeepen} disabled={loading} className="m3-btn-tonal mt-3 flex items-center gap-1.5 self-start text-xs disabled:opacity-50">
        <span className="m3-icon-sm">{loading ? "hourglass_top" : "science"}</span>
        {loading ? "검증 중..." : deepened ? "다시 검증" : "더 파보기"}
      </button>
    </article>
  );
}
