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
  evidence: Array<{
    query: string;
    newsCount: number;
    sample: Array<{ title: string; link: string; pubDate: string }>;
  }>;
}

const CONFIDENCE_LABEL: Record<string, { text: string; color: string }> = {
  high: { text: "확신↑", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  medium: { text: "보통", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  low: { text: "추측", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

export function HypothesisCard({
  index,
  hypothesis,
  keyword,
}: {
  index: number;
  hypothesis: Hypothesis;
  keyword: string;
}) {
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const confBadge = CONFIDENCE_LABEL[current.confidence] ?? CONFIDENCE_LABEL.medium;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400">
          가설 {index + 1}
          {deepened && <span className="ml-1 text-indigo-500">✨ refined</span>}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${confBadge.color}`}>
          {confBadge.text}
        </span>
      </div>
      <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">
        {current.title}
      </h4>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {current.reasoning}
      </p>
      {current.evidence?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {current.evidence.slice(0, 6).map((ev, j) => (
            <span
              key={j}
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            >
              {ev.slice(0, 60)}
            </span>
          ))}
        </div>
      )}

      {deepened && (
        <div className="mt-3 rounded-md bg-indigo-50 p-2.5 text-xs text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
          <div className="font-semibold">🧠 refine 이유</div>
          <p className="mt-0.5">{deepened.rationale}</p>
          {deepened.evidence?.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                검증 쿼리
              </div>
              {deepened.evidence.map((ev, i) => (
                <details key={i} className="text-[11px]">
                  <summary className="cursor-pointer">
                    <span className="font-mono text-indigo-700 dark:text-indigo-300">
                      &quot;{ev.query}&quot;
                    </span>{" "}
                    <span className="text-slate-500">({ev.newsCount}건)</span>
                  </summary>
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {ev.sample.slice(0, 4).map((s, k) => (
                      <li key={k} className="truncate">
                        <a
                          href={s.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                          title={s.title}
                        >
                          [E{i + 1}-{k + 1}] {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <button
        onClick={doDeepen}
        disabled={loading}
        className="mt-3 self-start rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
      >
        {loading ? "🔎 더 파보는 중…" : deepened ? "🔬 다시 파보기" : "🔬 더 파보기"}
      </button>
    </article>
  );
}
