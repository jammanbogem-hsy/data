/**
 * 검색 의도 분석 — Intent Clustering
 * 뉴스/댓글/자동완성에서 키워드를 추출하고,
 * PMI 기반으로 클러스터링한 뒤 Claude가 의도를 명명한다.
 */

import { stripSuffix, STOPWORDS } from "@/lib/comment-analyze";

interface TextDoc {
  text: string;
  source: "news" | "comment" | "autocomplete";
}

export interface KeywordCluster {
  keywords: string[];
  sampleTexts: string[];
}

/**
 * 텍스트에서 한글 키워드를 추출하고 조사/불용어를 제거한다.
 */
function extractKeywords(text: string, mainKeyword: string): string[] {
  const tokens = text.match(/[가-힣]{2,8}/g) ?? [];
  const norm = mainKeyword.toLowerCase();
  const result: string[] = [];
  for (const raw of tokens) {
    const stripped = stripSuffix(raw);
    if (stripped.length < 2) continue;
    if (STOPWORDS.has(stripped) || STOPWORDS.has(raw)) continue;
    if (stripped.toLowerCase() === norm || stripped === mainKeyword) continue;
    result.push(stripped);
  }
  return result;
}

/**
 * 문서 집합에서 키워드 동시 출현 기반 클러스터를 생성한다.
 */
export function buildIntentClusters(
  docs: TextDoc[],
  mainKeyword: string,
  maxClusters = 6
): { clusters: KeywordCluster[]; topKeywords: Array<{ word: string; count: number }> } {
  // 1. 문서별 키워드 추출
  const docKeywords: string[][] = docs.map((d) => extractKeywords(d.text, mainKeyword));

  // 2. 전체 빈도 카운팅
  const freq = new Map<string, number>();
  for (const kws of docKeywords) {
    const unique = new Set(kws);
    for (const w of unique) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }

  // 상위 키워드 (빈도 2 이상, 최대 60개)
  const topKeywords = Array.from(freq.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60);

  const topSet = new Set(topKeywords.map(([w]) => w));

  // 3. 동시 출현 행렬 (PMI)
  const N = docs.length;
  const coOccur = new Map<string, number>();
  for (const kws of docKeywords) {
    const unique = [...new Set(kws)].filter((w) => topSet.has(w));
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = [unique[i], unique[j]].sort().join("||");
        coOccur.set(key, (coOccur.get(key) ?? 0) + 1);
      }
    }
  }

  // 4. PMI 계산 + 높은 PMI 쌍으로 클러스터링 (greedy)
  const edges: Array<{ a: string; b: string; pmi: number }> = [];
  for (const [key, count] of coOccur) {
    if (count < 2) continue;
    const [a, b] = key.split("||");
    const pA = (freq.get(a) ?? 0) / N;
    const pB = (freq.get(b) ?? 0) / N;
    const pAB = count / N;
    if (pA > 0 && pB > 0) {
      const pmi = Math.log2(pAB / (pA * pB));
      if (pmi > 0.5) edges.push({ a, b, pmi });
    }
  }
  edges.sort((x, y) => y.pmi - x.pmi);

  // Greedy 클러스터링: 강한 연결부터 같은 클러스터로
  const clusterMap = new Map<string, number>();
  const clusters: Map<number, Set<string>> = new Map();
  let nextId = 0;

  for (const { a, b } of edges) {
    const cA = clusterMap.get(a);
    const cB = clusterMap.get(b);
    if (cA === undefined && cB === undefined) {
      const id = nextId++;
      clusterMap.set(a, id);
      clusterMap.set(b, id);
      clusters.set(id, new Set([a, b]));
    } else if (cA !== undefined && cB === undefined) {
      clusterMap.set(b, cA);
      clusters.get(cA)!.add(b);
    } else if (cA === undefined && cB !== undefined) {
      clusterMap.set(a, cB);
      clusters.get(cB)!.add(a);
    }
    // 이미 둘 다 클러스터에 있으면 무시 (과도한 병합 방지)
  }

  // 5. 클러스터별 대표 텍스트 매칭
  const result: KeywordCluster[] = [];
  for (const [, members] of clusters) {
    if (members.size < 2) continue;
    const kwArr = [...members].slice(0, 8);
    const samples: string[] = [];
    for (const doc of docs) {
      if (samples.length >= 3) break;
      const text = doc.text;
      if (kwArr.some((w) => text.includes(w))) {
        samples.push(text.slice(0, 120));
      }
    }
    result.push({ keywords: kwArr, sampleTexts: samples });
  }

  // 빈도순 정렬 (키워드 수가 많은 것 우선)
  result.sort((a, b) => b.keywords.length - a.keywords.length);

  return {
    clusters: result.slice(0, maxClusters),
    topKeywords: topKeywords.slice(0, 20).map(([word, count]) => ({ word, count })),
  };
}
