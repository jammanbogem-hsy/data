"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type ElementDefinition } from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";

cytoscape.use(coseBilkent);

export interface RelatedGraphData {
  centerKeyword: string;
  nodes: Array<{ id: string; weight: number; category?: string }>;
  edges: Array<{ a: string; b: string; weight: number }>;
  commentary: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  인물: "#8B5CF6",
  제품: "#F59E0B",
  장소: "#0EA5E9",
  사건: "#EC4899",
  감정: "#10B981",
  기타: "#64748B",
};

export function RelatedKeywordsGraph({
  data,
  accentColor = "#F97316",
}: {
  data: RelatedGraphData;
  accentColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const elements: ElementDefinition[] = useMemo(() => {
    const nodeIds = new Set<string>([data.centerKeyword, ...data.nodes.map((n) => n.id)]);
    const nodes: ElementDefinition[] = [
      {
        data: {
          id: data.centerKeyword,
          label: data.centerKeyword,
          weight: 10,
          category: "center",
          isCenter: true,
        },
      },
      ...data.nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.id,
          weight: Math.max(1, Math.min(10, n.weight)),
          category: n.category ?? "기타",
          isCenter: false,
        },
      })),
    ];
    const edgeEls: ElementDefinition[] = [
      // 센터와 각 노드 연결 (약한 엣지) — 시각적 배치에만 사용
      ...data.nodes.map((n) => ({
        data: {
          id: `center-${n.id}`,
          source: data.centerKeyword,
          target: n.id,
          weight: n.weight,
          isCenter: true,
        },
      })),
      ...data.edges
        .filter((e) => nodeIds.has(e.a) && nodeIds.has(e.b))
        .map((e, i) => ({
          data: {
            id: `e${i}-${e.a}-${e.b}`,
            source: e.a,
            target: e.b,
            weight: e.weight,
            isCenter: false,
          },
        })),
    ];
    return [...nodes, ...edgeEls];
  }, [data]);

  useEffect(() => {
    if (!ref.current) return;
    const cy = cytoscape({
      container: ref.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (el: any) =>
              el.data("isCenter")
                ? accentColor
                : CATEGORY_COLOR[el.data("category")] ?? CATEGORY_COLOR.기타,
            label: "data(label)",
            "font-family": "Pretendard, system-ui, sans-serif",
            "font-size": (el: any) => (el.data("isCenter") ? 14 : 11),
            "font-weight": (el: any) => (el.data("isCenter") ? 700 : 500),
            color: "#0f172a",
            "text-outline-color": "#ffffff",
            "text-outline-width": 2,
            "text-valign": "center",
            "text-halign": "center",
            width: (el: any) =>
              el.data("isCenter") ? 70 : 18 + Math.log2(el.data("weight") + 1) * 10,
            height: (el: any) =>
              el.data("isCenter") ? 70 : 18 + Math.log2(el.data("weight") + 1) * 10,
            "border-width": (el: any) => (el.data("isCenter") ? 4 : 1),
            "border-color": (el: any) => (el.data("isCenter") ? "#fb923c" : "#cbd5e1"),
          },
        },
        {
          selector: "edge",
          style: {
            width: (el: any) =>
              el.data("isCenter")
                ? 1
                : Math.max(1.5, Math.min(5, 0.6 + Math.log2(el.data("weight") + 1) * 1.5)),
            "line-color": (el: any) => (el.data("isCenter") ? "#fed7aa" : "#94a3b8"),
            "line-style": (el: any) => (el.data("isCenter") ? "dashed" : "solid"),
            "curve-style": "bezier",
            opacity: (el: any) => (el.data("isCenter") ? 0.3 : 0.7),
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
        idealEdgeLength: 100,
        nodeRepulsion: 9000,
        edgeElasticity: 0.25,
        randomize: true,
      } as any,
      wheelSensitivity: 0.2,
    });

    cy.on("tap", "node", (evt) => {
      setSelected(evt.target.id() as string);
    });
    cy.on("tap", (evt) => {
      if (evt.target === cy) setSelected(null);
    });

    return () => cy.destroy();
  }, [elements, accentColor]);

  const selectedNode = useMemo(() => {
    if (!selected) return null;
    if (selected === data.centerKeyword) {
      return { id: data.centerKeyword, weight: 10, category: "center" as const };
    }
    return data.nodes.find((n) => n.id === selected) ?? null;
  }, [selected, data]);

  const selectedEdges = useMemo(() => {
    if (!selected) return [];
    return data.edges
      .filter((e) => e.a === selected || e.b === selected)
      .map((e) => ({
        other: e.a === selected ? e.b : e.a,
        weight: e.weight,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [selected, data.edges]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of data.nodes) {
      const c = n.category ?? "기타";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [data.nodes]);

  return (
    <div className="space-y-2">
      {data.commentary && (
        <p className="m3-body-sm italic flex items-center gap-1">
          <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>lightbulb</span>
          {data.commentary}
        </p>
      )}
      <div className="relative rounded-2xl" style={{ border: "1px solid var(--md-outline-variant)", background: "var(--md-surface-container)" }}>
        <div ref={ref} className="h-[400px] w-full" />
        {selectedNode && (
          <aside className="absolute right-3 top-3 w-56 rounded-xl p-3 backdrop-blur" style={{ background: "color-mix(in srgb, var(--md-surface-container) 95%, transparent)", border: "1px solid var(--md-outline-variant)", boxShadow: "var(--md-elevation-2)" }}>
            <h4 className="truncate text-sm font-bold" style={{ color: "var(--md-on-surface)" }}>
              {selectedNode.id}
            </h4>
            {selectedNode.category !== "center" && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: CATEGORY_COLOR[selectedNode.category ?? "기타"] }}
                />
                <span className="m3-body-sm">{selectedNode.category}</span>
                <span className="ml-auto font-mono m3-body-sm">w={selectedNode.weight}</span>
              </div>
            )}
            {selectedEdges.length > 0 && (
              <div className="mt-2 pt-1.5" style={{ borderTop: "1px solid var(--md-outline-variant)" }}>
                <div className="mb-1 m3-label-sm" style={{ fontSize: 9 }}>
                  연결된 키워드
                </div>
                <ul className="space-y-0.5 text-[11px]">
                  {selectedEdges.map((e, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="truncate" style={{ color: "var(--md-on-surface)" }}>{e.other}</span>
                      <span className="ml-2 font-mono" style={{ color: "var(--md-on-surface-variant)" }}>{e.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
        <div className="absolute bottom-3 left-3 rounded-xl p-2 text-[10px]" style={{ background: "color-mix(in srgb, var(--md-surface-container) 92%, transparent)", border: "1px solid var(--md-outline-variant)", boxShadow: "var(--md-elevation-1)" }}>
          <div className="font-semibold" style={{ color: "var(--md-on-surface)" }}>카테고리</div>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            {categoryCounts.map(([c, n]) => (
              <span key={c} className="flex items-center gap-1" style={{ color: "var(--md-on-surface-variant)" }}>
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: CATEGORY_COLOR[c] ?? CATEGORY_COLOR.기타 }}
                />
                {c} ({n})
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
