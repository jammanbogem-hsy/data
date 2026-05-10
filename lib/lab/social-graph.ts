// 사회 현상 연결망 — 키워드 동시출현(co-occurrence) + PMI 기반 네트워크 구축.

import { stripSuffix, STOPWORDS } from "@/lib/comment-analyze";

export interface GraphNode {
  id: string;
  label: string;
  count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  pmi: number;
}

export interface SocialGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * 뉴스·자동완성·연관키워드 텍스트에서 키워드 동시출현 네트워크를 구축한다.
 *
 * @param texts      뉴스 제목+설명 등 텍스트 배열 (문서 단위)
 * @param mainKeyword 분석 대상 핵심 키워드 (노드에서 제외)
 * @param seedKeywords 자동완성·연관 키워드 (보카에 우선 포함)
 */
export function buildSocialGraph(
  texts: string[],
  mainKeyword: string,
  seedKeywords?: string[],
): SocialGraphData {
  const N = texts.length;
  if (N === 0) return { nodes: [], edges: [] };

  const mainNorm = stripSuffix(mainKeyword);

  // --- 1. 문서별 키워드 집합 추출 ---
  const docKeywords: Set<string>[] = [];
  const globalCount = new Map<string, number>(); // 키워드 → 등장 문서 수

  // seed 키워드도 어휘에 포함되도록 세트화
  const seedSet = new Set<string>();
  if (seedKeywords) {
    for (const sk of seedKeywords) {
      const stripped = stripSuffix(sk.trim());
      if (stripped.length >= 2 && stripped !== mainNorm && !STOPWORDS.has(stripped)) {
        seedSet.add(stripped);
      }
    }
  }

  for (const text of texts) {
    const tokens = text.match(/[가-힣]{2,8}/g) ?? [];
    const kwSet = new Set<string>();

    for (const raw of tokens) {
      const stripped = stripSuffix(raw);
      if (stripped.length < 2) continue;
      if (STOPWORDS.has(stripped) || STOPWORDS.has(raw)) continue;
      if (stripped === mainNorm || stripped === mainKeyword) continue;
      kwSet.add(stripped);
    }

    // seed 키워드가 텍스트에 포함되면 추가
    for (const sk of seedSet) {
      if (text.includes(sk)) kwSet.add(sk);
    }

    docKeywords.push(kwSet);
    for (const kw of kwSet) {
      globalCount.set(kw, (globalCount.get(kw) ?? 0) + 1);
    }
  }

  // --- 2. 빈도 2 이상만 유지 (seed는 1 이상) ---
  const vocab = new Set<string>();
  for (const [kw, cnt] of globalCount) {
    if (cnt >= 2 || (seedSet.has(kw) && cnt >= 1)) {
      vocab.add(kw);
    }
  }

  if (vocab.size === 0) return { nodes: [], edges: [] };

  // --- 3. 동시출현 카운트 ---
  const coCount = new Map<string, number>(); // "a\0b" → 동시출현 문서 수
  const pairKey = (a: string, b: string) => (a < b ? `${a}\0${b}` : `${b}\0${a}`);

  for (const kwSet of docKeywords) {
    const arr = [...kwSet].filter((k) => vocab.has(k));
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = pairKey(arr[i], arr[j]);
        coCount.set(key, (coCount.get(key) ?? 0) + 1);
      }
    }
  }

  // --- 4. PMI 계산 ---
  const edges: GraphEdge[] = [];
  const nodeInEdge = new Set<string>();

  for (const [key, coFreq] of coCount) {
    if (coFreq < 2) continue;
    const [a, b] = key.split("\0");
    const pA = (globalCount.get(a) ?? 0) / N;
    const pB = (globalCount.get(b) ?? 0) / N;
    const pAB = coFreq / N;

    if (pA === 0 || pB === 0) continue;
    const pmi = Math.log2(pAB / (pA * pB));

    if (pmi > 0.5) {
      edges.push({ source: a, target: b, pmi: Math.round(pmi * 100) / 100 });
      nodeInEdge.add(a);
      nodeInEdge.add(b);
    }
  }

  // PMI 내림차순 정렬, 상위 연결만
  edges.sort((a, b) => b.pmi - a.pmi);
  const topEdges = edges.slice(0, 40);

  // --- 5. 노드 구성 — 엣지에 등장하는 노드만 ---
  const usedNodes = new Set<string>();
  for (const e of topEdges) {
    usedNodes.add(e.source);
    usedNodes.add(e.target);
  }

  const nodes: GraphNode[] = [...usedNodes]
    .map((id) => ({
      id,
      label: id,
      count: globalCount.get(id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // 노드 상위 20개에 포함된 것만 엣지에 남김
  const nodeIds = new Set(nodes.map((n) => n.id));
  const finalEdges = topEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return { nodes, edges: finalEdges };
}
