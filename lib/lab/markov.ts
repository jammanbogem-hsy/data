// 관심 이동 분석 (Markov Chain)
//
// 다중 키워드 트렌드 시계열의 교차상관(Cross-Correlation)을 기반으로
// 대중의 관심이 어떤 키워드에서 다른 키워드로 이동하는 흐름을 추적한다.
//
// 핵심 아이디어:
//   키워드 A가 피크를 찍은 뒤 N일 후 키워드 B가 피크를 찍으면,
//   사람들의 관심이 A → B로 이동했다고 해석할 수 있다.

import { crossCorrelation } from "@/lib/correlation";

export interface MarkovTransition {
  from: string;
  to: string;
  lagDays: number;
  correlation: number;
  probability: number;
}

export interface MarkovChain {
  transitions: MarkovTransition[];
  chain: string[]; // ordered keywords forming the interest flow
}

/**
 * 다중 키워드 시계열에서 관심 이동 체인을 구축한다.
 *
 * @param mainKeyword - 시작 키워드
 * @param series - 각 키워드의 일별 트렌드 데이터
 * @param maxLag - 교차상관 최대 lag (기본 14일)
 * @returns MarkovChain — 전이 목록 + 최적 체인 경로
 */
export function buildMarkovChain(
  mainKeyword: string,
  series: Array<{ keyword: string; data: Array<{ period: string; ratio: number }> }>,
  maxLag = 14
): MarkovChain {
  const keywords = series.map((s) => s.keyword);
  const dataMap = new Map<string, number[]>();

  for (const s of series) {
    dataMap.set(s.keyword, s.data.map((d) => d.ratio));
  }

  // 모든 키워드 쌍에 대해 교차상관 계산
  const allTransitions: MarkovTransition[] = [];

  for (const from of keywords) {
    for (const to of keywords) {
      if (from === to) continue;

      const seriesA = dataMap.get(from);
      const seriesB = dataMap.get(to);
      if (!seriesA || !seriesB) continue;

      // 길이 맞추기 (짧은 쪽에 맞춤)
      const len = Math.min(seriesA.length, seriesB.length);
      if (len < 5) continue;

      const a = seriesA.slice(0, len);
      const b = seriesB.slice(0, len);

      const cc = crossCorrelation(a, b, maxLag);

      // 양의 lag에서 가장 높은 상관을 가진 lag 찾기
      // lag > 0: A가 B에 선행 (A 후에 B가 따라옴)
      const positiveLags = cc.filter((c) => c.lag > 0 && c.r > 0.3);
      if (positiveLags.length === 0) continue;

      const best = positiveLags.reduce((max, c) => (c.r > max.r ? c : max));

      allTransitions.push({
        from,
        to,
        lagDays: best.lag,
        correlation: best.r,
        probability: 0, // 아래에서 정규화
      });
    }
  }

  // 확률 정규화: 각 노드에서 나가는 전이의 상관계수 합으로 나눔
  const outgoing = new Map<string, MarkovTransition[]>();
  for (const t of allTransitions) {
    if (!outgoing.has(t.from)) outgoing.set(t.from, []);
    outgoing.get(t.from)!.push(t);
  }

  for (const [, transitions] of outgoing) {
    const totalCorr = transitions.reduce((s, t) => s + t.correlation, 0);
    for (const t of transitions) {
      t.probability = totalCorr > 0 ? t.correlation / totalCorr : 0;
    }
  }

  // 그리디 워크: mainKeyword에서 시작, 가장 높은 확률의 전이를 따라감
  const chain: string[] = [mainKeyword];
  const visited = new Set<string>([mainKeyword]);

  let current = mainKeyword;
  const maxSteps = keywords.length; // 무한 루프 방지

  for (let step = 0; step < maxSteps; step++) {
    const candidates = (outgoing.get(current) ?? [])
      .filter((t) => !visited.has(t.to))
      .sort((a, b) => b.probability - a.probability);

    if (candidates.length === 0) break;

    const next = candidates[0];
    chain.push(next.to);
    visited.add(next.to);
    current = next.to;
  }

  return {
    transitions: allTransitions,
    chain,
  };
}
