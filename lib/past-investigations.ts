// 세션 내 이전 조사 결과를 저장해 "과거 유사 사건" 매칭에 활용.
// sessionStorage 사용 → 탭 유지 동안만. Vercel KV 등 영구 저장은 다음 단계.
//
// 데이터 크기 경량: 키워드 + 상위 급등 3개의 메타만.

import { detectSeasonal } from "./korean-seasonal";

const STORAGE_KEY = "datamining_past_investigations";
const MAX_STORE = 10;

export interface PastSpikeMeta {
  peakPeriod: string; // YYYY-MM-DD
  peakRatio: number;
  multiplier: number;
  month: number;
  seasonal: string[];
}

export interface PastInvestigation {
  keyword: string;
  fetchedAt: string;
  topSpikes: PastSpikeMeta[];
}

export function savePastInvestigation(entry: PastInvestigation): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list: PastInvestigation[] = raw ? JSON.parse(raw) : [];
    // 같은 키워드는 최신 것만 유지
    const filtered = list.filter((p) => p.keyword !== entry.keyword);
    filtered.unshift(entry);
    const trimmed = filtered.slice(0, MAX_STORE);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // sessionStorage 쿼터 초과 등 무시
  }
}

export function loadPastInvestigations(): PastInvestigation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PastInvestigation[];
  } catch {
    return [];
  }
}

export interface SimilarityMatch {
  currentPeak: { peakPeriod: string; multiplier: number; peakRatio: number };
  past: { keyword: string; peak: PastSpikeMeta };
  score: number;
  reasons: string[];
}

/**
 * 현재 조사의 피크와 과거 조사의 피크를 비교해 유사 패턴 찾기.
 * 규칙 기반 (진짜 임베딩은 다음 단계):
 *   +3: 같은 달 (±1개월)
 *   +2: 공통 시즌 키워드 (각 시즌당)
 *   +1: 배수 범위 유사 (둘 다 ×1.5~3 or 둘 다 ×3+)
 */
export function findSimilarPastSpikes(
  currentKeyword: string,
  currentPeaks: Array<{ peakPeriod: string; peakRatio: number; multiplier: number }>,
  pastInvestigations: PastInvestigation[]
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = [];

  for (const curr of currentPeaks) {
    const currMonth = Number(curr.peakPeriod.slice(5, 7));
    const currSeasonal = detectSeasonal(curr.peakPeriod);
    const currBand = bandOf(curr.multiplier);

    for (const past of pastInvestigations) {
      if (past.keyword === currentKeyword) continue; // 자기 자신 제외
      for (const pp of past.topSpikes) {
        const reasons: string[] = [];
        let score = 0;

        const monthDiff = Math.min(
          Math.abs(currMonth - pp.month),
          12 - Math.abs(currMonth - pp.month)
        );
        if (monthDiff <= 1) {
          score += 3;
          reasons.push(monthDiff === 0 ? "같은 달" : "1개월 이내");
        }

        const sharedSeasonal = currSeasonal.filter((s) => pp.seasonal.includes(s));
        if (sharedSeasonal.length > 0) {
          score += 2 * sharedSeasonal.length;
          reasons.push(`시즌 ${sharedSeasonal.join("·")}`);
        }

        if (currBand === bandOf(pp.multiplier)) {
          score += 1;
          reasons.push(`급등 강도 유사 (${currBand})`);
        }

        if (score >= 3) {
          matches.push({
            currentPeak: curr,
            past: { keyword: past.keyword, peak: pp },
            score,
            reasons,
          });
        }
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 5);
}

function bandOf(m: number): string {
  if (m >= 5) return "×5+";
  if (m >= 3) return "×3~5";
  if (m >= 1.5) return "×1.5~3";
  return "×1 근처";
}
