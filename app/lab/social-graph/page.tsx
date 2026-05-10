"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LabKeywordInput } from "@/components/lab/LabKeywordInput";
import { LabResultCard, LabErrorCard, LabEmptyCard } from "@/components/lab/LabResultCard";

interface GraphNode {
  id: string;
  label: string;
  count: number;
}

interface GraphEdge {
  source: string;
  target: string;
  pmi: number;
}

interface Phenomenon {
  name: string;
  keywords: string[];
  description: string;
}

interface NewsItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

interface SocialGraphResult {
  keyword: string;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  phenomena: Phenomenon[];
  narrative: string;
  news: NewsItem[];
  meta: {
    newsCount: number;
    autocompleteCount: number;
    relatedCount: number;
    nodeCount: number;
    edgeCount: number;
  };
}

const PHENOM_COLORS = [
  "var(--md-primary)",
  "#1565C0",
  "#F57F17",
  "#E65100",
  "#6A1B9A",
];

const CLUSTER_COLORS = ["#00897B", "#1565C0", "#E65100", "#6A1B9A", "#2E7D32", "#C62828"];

// Union-Find로 연결 컴포넌트(군집) 찾기
function findClusters(nodeIds: string[], edgeList: GraphEdge[]): Map<string, number> {
  const parent = new Map<string, string>();
  nodeIds.forEach((id) => parent.set(id, id));
  function find(x: string): string {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; }
    return x;
  }
  function union(a: string, b: string) { parent.set(find(a), find(b)); }
  edgeList.forEach((e) => { if (parent.has(e.source) && parent.has(e.target)) union(e.source, e.target); });
  const clusterMap = new Map<string, number>();
  const rootToId = new Map<string, number>();
  let nextId = 0;
  nodeIds.forEach((id) => {
    const root = find(id);
    if (!rootToId.has(root)) rootToId.set(root, nextId++);
    clusterMap.set(id, rootToId.get(root)!);
  });
  return clusterMap;
}

// --- 인터랙티브 네트워크 시각화 (군집 기반 포스 레이아웃) ---
function NetworkGraph({ graph, keyword, onSelectNode }: { graph: SocialGraphResult["graph"]; keyword: string; onSelectNode?: (nodeId: string) => void }) {
  const { nodes, edges } = graph;
  const [hovered, setHovered] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [clusters, setClusters] = useState<Map<string, number>>(new Map());
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 750;
  const height = 560;
  const cx = width / 2;
  const cy = height / 2;

  const maxCount = Math.max(...nodes.map((n) => n.count), 1);
  const maxPmi = edges.length > 0 ? Math.max(...edges.map((e) => e.pmi)) : 1;

  // 군집 탐지 + 포스 시뮬레이션
  useEffect(() => {
    if (nodes.length === 0) return;

    // 1. 군집 찾기
    const clusterMap = findClusters(nodes.map((n) => n.id), edges);
    setClusters(clusterMap);

    // 군집별 노드 그룹
    const clusterGroups = new Map<number, string[]>();
    clusterMap.forEach((cId, nodeId) => {
      if (!clusterGroups.has(cId)) clusterGroups.set(cId, []);
      clusterGroups.get(cId)!.push(nodeId);
    });

    // 군집별 중심 앵글 할당 (큰 군집부터)
    const sortedClusters = [...clusterGroups.entries()].sort((a, b) => b[1].length - a[1].length);
    const clusterAngle = new Map<number, number>();
    sortedClusters.forEach(([cId], i) => {
      clusterAngle.set(cId, (2 * Math.PI * i) / sortedClusters.length - Math.PI / 2);
    });

    // 2. 초기 위치: 군집 중심 주변에 배치
    const pos = new Map<string, { x: number; y: number }>();
    const clusterRadius = Math.min(width, height) * 0.28;

    for (const [cId, members] of clusterGroups) {
      const angle = clusterAngle.get(cId) ?? 0;
      const groupCx = cx + clusterRadius * Math.cos(angle);
      const groupCy = cy + clusterRadius * Math.sin(angle);

      members.forEach((nodeId, j) => {
        const subAngle = (2 * Math.PI * j) / members.length;
        const subRadius = 30 + members.length * 8;
        pos.set(nodeId, {
          x: groupCx + subRadius * Math.cos(subAngle) + (Math.random() - 0.5) * 15,
          y: groupCy + subRadius * Math.sin(subAngle) + (Math.random() - 0.5) * 15,
        });
      });
    }

    // 3. 포스 시뮬레이션: 인력(연결) + 반발력(겹침 방지) + 중력(중심)
    for (let iter = 0; iter < 120; iter++) {
      // 인력: 연결된 노드끼리 당김
      for (const edge of edges) {
        const pa = pos.get(edge.source);
        const pb = pos.get(edge.target);
        if (!pa || !pb) continue;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = 80;
        if (dist > idealDist) {
          const force = (dist - idealDist) * 0.015;
          pa.x += (dx / dist) * force;
          pa.y += (dy / dist) * force;
          pb.x -= (dx / dist) * force;
          pb.y -= (dy / dist) * force;
        }
      }

      // 반발력: 모든 노드 쌍 (겹침 방지 — 중앙 키워드 포함)
      const allIds = [...nodes.map((n) => n.id)];
      for (let i = 0; i < allIds.length; i++) {
        const pa = pos.get(allIds[i]);
        if (!pa) continue;
        // 중앙 키워드와도 반발
        const dxC = pa.x - cx;
        const dyC = pa.y - cy;
        const distC = Math.sqrt(dxC * dxC + dyC * dyC) || 1;
        if (distC < 80) {
          const f = (80 - distC) * 0.5;
          pa.x += (dxC / distC) * f;
          pa.y += (dyC / distC) * f;
        }
        for (let j = i + 1; j < allIds.length; j++) {
          const pb = pos.get(allIds[j]);
          if (!pb) continue;
          const dx = pb.x - pa.x;
          const dy = pb.y - pa.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = 85;
          if (dist < minDist) {
            const force = (minDist - dist) * 0.5;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            pa.x -= fx; pa.y -= fy;
            pb.x += fx; pb.y += fy;
          }
        }
      }

      // 약한 중력
      for (const n of nodes) {
        const p = pos.get(n.id)!;
        p.x += (cx - p.x) * 0.003;
        p.y += (cy - p.y) * 0.003;
        p.x = Math.max(60, Math.min(width - 60, p.x));
        p.y = Math.max(50, Math.min(height - 50, p.y));
      }
    }

    setPositions(pos);
  }, [nodes, edges, cx, cy, width, height]);

  if (nodes.length === 0) return null;

  // 호버된 노드와 연결된 엣지/노드 하이라이트
  const connectedNodes = new Set<string>();
  if (hovered) {
    connectedNodes.add(hovered);
    edges.forEach((e) => {
      if (e.source === hovered) connectedNodes.add(e.target);
      if (e.target === hovered) connectedNodes.add(e.source);
    });
  }

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  function handleMouseDown(nodeId: string, e: React.MouseEvent) {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setDragging(nodeId);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !svgRef.current) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());
    setPositions((prev) => {
      const next = new Map(prev);
      next.set(dragging, { x: svgPt.x, y: svgPt.y });
      return next;
    });
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (dragging && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      // 거의 움직이지 않았으면 클릭으로 처리
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        onSelectNode?.(dragging);
      }
    }
    setDragging(null);
    dragStartRef.current = null;
  }

  const nodeRadius = (count: number) => 18 + 14 * (count / maxCount);

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto w-full max-w-[700px] cursor-grab"
        style={{ minHeight: 420 }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 엣지 */}
        {edges.map((edge, i) => {
          const from = positions.get(edge.source);
          const to = positions.get(edge.target);
          if (!from || !to) return null;
          const isHighlighted = hovered && (edge.source === hovered || edge.target === hovered);
          const opacity = isHighlighted ? 0.8 : hovered ? 0.08 : 0.15 + 0.4 * (edge.pmi / maxPmi);
          return (
            <line
              key={`e-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={isHighlighted ? "#00897B" : "#90A4AE"}
              strokeWidth={isHighlighted ? 2.5 : 1}
              strokeOpacity={opacity}
            />
          );
        })}

        {/* 중앙 메인 키워드 */}
        <circle cx={cx} cy={cy} r={30} fill="#00897B" fillOpacity={0.12} stroke="#00897B" strokeWidth={2.5} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="bold" fill="#00897B">
          {keyword}
        </text>

        {/* 노드 (군집별 색상) */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const r = nodeRadius(node.count);
          const isActive = !hovered || connectedNodes.has(node.id);
          const isHoveredNode = hovered === node.id;
          const cId = clusters.get(node.id) ?? 0;
          const clusterColor = CLUSTER_COLORS[cId % CLUSTER_COLORS.length];
          return (
            <g
              key={node.id}
              style={{ cursor: "pointer", transition: "opacity 0.2s" }}
              opacity={isActive ? 1 : 0.2}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => { if (!dragging) setHovered(null); }}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
            >
              <circle
                cx={pos.x} cy={pos.y} r={r}
                fill={isHoveredNode ? `${clusterColor}22` : "#FAFAF5"}
                stroke={isHoveredNode ? clusterColor : `${clusterColor}88`}
                strokeWidth={isHoveredNode ? 2.5 : 1.5}
              />
              <text
                x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={node.label.length > 4 ? 10 : 12}
                fontWeight={isHoveredNode ? 700 : 500}
                fill={isHoveredNode ? clusterColor : "#37474F"}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center m3-body-sm">노드를 드래그하여 이동할 수 있습니다. 호버하면 연결 관계가 강조됩니다.</p>
    </div>
  );
}

export default function SocialGraphPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SocialGraphResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  async function handleSubmit(keyword: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lab/social-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `오류 ${res.status}`);
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/lab" className="m3-icon-sm no-underline" style={{ color: "var(--md-on-surface-variant)" }}>
          arrow_back
        </Link>
        <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>hub</span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>
            사회 현상 연결망
          </h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Graph Embedding</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Knowledge Graph</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Semantic Relation Mapping</span>
          </div>
          <p className="mt-1 m3-body-sm">키워드를 단순 단어가 아니라 사회적 의미 관계로 연결합니다. AI가 뉴스, 검색, 댓글 속 관계를 읽고 어떤 사회 현상과 연결되는지 보여줍니다.</p>
          <p className="mt-0.5 text-xs italic" style={{ color: "var(--md-primary)" }}>&ldquo;이 키워드는 사회와 어떻게 연결될까요?&rdquo;</p>
        </div>
      </div>

      {/* 입력 */}
      <LabKeywordInput onSubmit={handleSubmit} loading={loading} placeholder="분석할 키워드 입력 (예: 물가, AI, 저출산)" />

      {/* 에러 */}
      {error && <LabErrorCard message={error} />}

      {/* 결과 */}
      {result ? (
        <div className="space-y-4">
          {/* 수집 메타 */}
          <LabResultCard icon="hub" title={`"${result.keyword}" 사회 현상 연결망`} subtitle={`${result.meta.nodeCount}개 키워드, ${result.meta.edgeCount}개 연결`}>
            <div className="flex flex-wrap gap-3 m3-body-sm">
              <span className="flex items-center gap-1">
                <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>newspaper</span>
                뉴스 {result.meta.newsCount}건
              </span>
              <span className="flex items-center gap-1">
                <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>search</span>
                자동완성 {result.meta.autocompleteCount}건
              </span>
              <span className="flex items-center gap-1">
                <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>link</span>
                연관어 {result.meta.relatedCount}건
              </span>
            </div>
          </LabResultCard>

          {/* 네트워크 그래프 */}
          <section className="m3-card">
            <h3 className="m3-section-title mb-3">
              <span className="m3-icon" style={{ color: "var(--md-primary)" }}>scatter_plot</span>
              키워드 연결망
            </h3>
            <NetworkGraph graph={result.graph} keyword={result.keyword} onSelectNode={setSelectedNode} />
          </section>

          {/* 선택된 노드 관련 뉴스 */}
          {selectedNode && result.news && (
            <section className="m3-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="m3-section-title">
                  <span className="m3-icon" style={{ color: "var(--md-primary)" }}>article</span>
                  &ldquo;{selectedNode}&rdquo; 관련 뉴스
                </h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="m3-icon-sm rounded-full p-1 transition hover:bg-black/5"
                  style={{ color: "var(--md-on-surface-variant)" }}
                >
                  close
                </button>
              </div>
              {(() => {
                const matched = result.news.filter(
                  (n) => n.title.includes(selectedNode) || (n.description ?? "").includes(selectedNode)
                );
                if (matched.length === 0) {
                  return <p className="m3-body-sm py-2">이 키워드가 포함된 뉴스를 찾지 못했습니다.</p>;
                }
                return (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {matched.slice(0, 8).map((n, i) => (
                      <a
                        key={i}
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="m3-card-outlined block transition hover:shadow-sm no-underline"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold" style={{ color: "var(--md-on-surface)" }}>
                            {n.title}
                          </h4>
                          <span className="shrink-0 m3-body-sm">{n.pubDate?.slice(0, 10)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 m3-body-sm">{n.description}</p>
                      </a>
                    ))}
                  </div>
                );
              })()}
            </section>
          )}

          {/* 사회 현상 카드 */}
          {(result.phenomena ?? []).length > 0 && <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(result.phenomena ?? []).map((phenom, i) => {
              const color = PHENOM_COLORS[i % PHENOM_COLORS.length];
              return (
                <div key={i} className="m3-card space-y-3">
                  <h4 className="text-sm font-bold" style={{ color }}>
                    {phenom.name}
                  </h4>
                  <p className="m3-body-sm">{phenom.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {phenom.keywords.map((kw, j) => (
                      <span
                        key={j}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: `color-mix(in srgb, ${color} 10%, var(--md-surface-container))`,
                          color: "var(--md-on-surface)",
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>}

          {/* 내러티브 스토리 */}
          {result.narrative && (
            <LabResultCard icon="auto_stories" title="사회 현상 이야기" subtitle="키워드들이 만들어내는 사회적 맥락">
              <p className="m3-body-sm leading-relaxed" style={{ color: "var(--md-on-surface)" }}>
                {result.narrative}
              </p>
            </LabResultCard>
          )}
        </div>
      ) : (
        !loading && !error && <LabEmptyCard />
      )}
    </div>
  );
}
