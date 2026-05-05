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
    <div className="relative rounded-2xl" style={{ border: "1px solid var(--md-outline-variant)", background: "var(--md-surface-container)" }}>
      <div ref={ref} className="h-[70vh] w-full" />
      {selected && (
        <aside className="absolute right-4 top-4 w-64 rounded-xl p-4 backdrop-blur" style={{ background: "color-mix(in srgb, var(--md-surface-container) 95%, transparent)", border: "1px solid var(--md-outline-variant)", boxShadow: "var(--md-elevation-2)" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--md-on-surface)" }}>#{selected.keyword}</h3>
          <dl className="mt-2 space-y-1 m3-body-sm">
            <div className="flex justify-between">
              <dt>언급</dt>
              <dd className="tabular-nums">{selected.count}</dd>
            </div>
            <div className="flex justify-between">
              <dt>급등</dt>
              <dd className="tabular-nums">x{selected.surgeScore.toFixed(2)}</dd>
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
    <div className="absolute bottom-4 left-4 rounded-xl p-3 text-xs" style={{ background: "color-mix(in srgb, var(--md-surface-container) 92%, transparent)", border: "1px solid var(--md-outline-variant)", boxShadow: "var(--md-elevation-1)" }}>
      <div className="font-medium" style={{ color: "var(--md-on-surface)" }}>범례</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--md-primary)" }} />
        <span style={{ color: "var(--md-on-surface-variant)" }}>긍정</span>
        <span className="ml-3 inline-block h-2 w-2 rounded-full" style={{ background: "var(--md-outline)" }} />
        <span style={{ color: "var(--md-on-surface-variant)" }}>중립</span>
        <span className="ml-3 inline-block h-2 w-2 rounded-full" style={{ background: "var(--md-error)" }} />
        <span style={{ color: "var(--md-on-surface-variant)" }}>부정</span>
      </div>
      <div className="mt-1" style={{ color: "var(--md-on-surface-variant)" }}>
        오렌지 테두리 = 급등 x2 이상 · 크기 = 언급량
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
