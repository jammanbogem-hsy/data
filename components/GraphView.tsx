"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type ElementDefinition } from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import type { Edge, KeywordDaily } from "@shared/schema";

cytoscape.use(coseBilkent);

export function GraphView({
  keywords,
  edges,
}: {
  keywords: KeywordDaily[];
  edges: Edge[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<KeywordDaily | null>(null);
  const byKw = useMemo(() => {
    const m = new Map<string, KeywordDaily>();
    keywords.forEach((k) => m.set(k.keyword, k));
    return m;
  }, [keywords]);

  const elements: ElementDefinition[] = useMemo(() => {
    const kwSet = new Set(keywords.map((k) => k.keyword));
    const nodes: ElementDefinition[] = keywords.map((k) => ({
      data: {
        id: k.keyword,
        label: k.keyword,
        count: k.count,
        sentiment: k.sentimentAvg,
        surge: k.surgeScore,
      },
    }));
    const edgeEls: ElementDefinition[] = edges
      .filter((e) => kwSet.has(e.a) && kwSet.has(e.b))
      .slice(0, 800)
      .map((e) => ({
        data: { id: e.id, source: e.a, target: e.b, weight: e.weight },
      }));
    return [...nodes, ...edgeEls];
  }, [keywords, edges]);

  useEffect(() => {
    if (!ref.current) return;
    const cy = cytoscape({
      container: ref.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (el: any) => sentimentColor(el.data("sentiment")),
            label: "data(label)",
            "font-family": "Pretendard, system-ui, sans-serif",
            "font-size": 11,
            color: "#0f172a",
            "text-outline-color": "#ffffff",
            "text-outline-width": 2,
            width: (el: any) => 10 + Math.log2(el.data("count") + 1) * 6,
            height: (el: any) => 10 + Math.log2(el.data("count") + 1) * 6,
            "border-width": (el: any) =>
              el.data("surge") >= 2 ? 3 : 0,
            "border-color": "#f97316",
          },
        },
        {
          selector: "edge",
          style: {
            width: (el: any) => Math.min(4, 0.5 + Math.log2(el.data("weight") + 1)),
            "line-color": "#cbd5e1",
            "curve-style": "bezier",
            opacity: 0.6,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#2563eb",
          },
        },
      ],
      layout: {
        name: "cose-bilkent",
        animate: false,
        idealEdgeLength: 80,
        nodeRepulsion: 8000,
        edgeElasticity: 0.2,
      } as any,
      wheelSensitivity: 0.2,
    });

    cy.on("tap", "node", (evt) => {
      const kw = evt.target.id() as string;
      setSelected(byKw.get(kw) ?? null);
    });
    cy.on("tap", (evt) => {
      if (evt.target === cy) setSelected(null);
    });

    return () => cy.destroy();
  }, [elements, byKw]);

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div ref={ref} className="h-[70vh] w-full" />
      {selected && (
        <aside className="absolute right-4 top-4 w-64 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <h3 className="text-base font-semibold">#{selected.keyword}</h3>
          <dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <dt>언급</dt>
              <dd className="tabular-nums">{selected.count}</dd>
            </div>
            <div className="flex justify-between">
              <dt>급등</dt>
              <dd className="tabular-nums">×{selected.surgeScore.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>감정</dt>
              <dd className="tabular-nums">{selected.sentimentAvg.toFixed(2)}</dd>
            </div>
          </dl>
        </aside>
      )}
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white/90 p-3 text-xs shadow dark:border-slate-700 dark:bg-slate-900/90">
      <div className="font-medium text-slate-700 dark:text-slate-200">범례</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-slate-500">긍정</span>
        <span className="ml-3 inline-block h-2 w-2 rounded-full bg-slate-400" />
        <span className="text-slate-500">중립</span>
        <span className="ml-3 inline-block h-2 w-2 rounded-full bg-rose-400" />
        <span className="text-slate-500">부정</span>
      </div>
      <div className="mt-1 text-slate-500">
        오렌지 테두리 = 급등 ×2 이상 · 크기 = 언급량
      </div>
    </div>
  );
}

function sentimentColor(score: number): string {
  const s = Math.max(-1, Math.min(1, score));
  if (s > 0.15) {
    const t = Math.min(1, s);
    return `rgb(${Math.round(110 - 50 * t)}, ${Math.round(200 + 31 * t)}, ${Math.round(140)})`;
  }
  if (s < -0.15) {
    const t = Math.min(1, -s);
    return `rgb(${Math.round(248)}, ${Math.round(113 - 30 * t)}, ${Math.round(113 - 30 * t)})`;
  }
  return "#94a3b8";
}
