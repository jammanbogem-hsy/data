// 키워드 공기(co-occurrence) 분석 — 같은 텍스트 문서에 함께 등장하는 키워드 쌍을 찾고
// PMI(Pointwise Mutual Information)로 연관 강도를 측정.
//
// 용도:
// - 댓글/뉴스 제목에서 키워드 클러스터 발견
// - 트렌드 분석 시 관련 키워드 그룹 식별

export interface CoOccurrenceResult {
  /** 키워드 A */
  a: string;
  /** 키워드 B */
  b: string;
  /** A와 B가 함께 등장한 문서 수 */
  coCount: number;
  /** A가 등장한 전체 문서 수 */
  totalA: number;
  /** B가 등장한 전체 문서 수 */
  totalB: number;
  /** PMI (Pointwise Mutual Information): log2(P(A,B) / (P(A)*P(B))) */
  pmi: number;
}

/**
 * 텍스트 문서 배열에서 키워드 공기 관계(co-occurrence)를 계산합니다.
 *
 * 각 문서에서 한글 키워드 토큰을 추출하고, 동일 문서 내 키워드 쌍의
 * 공동 출현 빈도 및 PMI를 계산합니다.
 *
 * @param documents 분석할 텍스트 배열 (댓글, 뉴스 제목 등)
 * @param opts.minCount 최소 공동 출현 횟수 (기본 2)
 * @param opts.minKeywordFreq 키워드 최소 등장 문서 수 (기본 2)
 * @param opts.topN 상위 N개 결과 반환 (기본 50)
 * @param opts.keywords 미리 추출된 키워드 목록 (미제공시 자동 추출)
 * @returns PMI 내림차순으로 정렬된 공기 관계 배열
 */
export function computeCoOccurrence(
  documents: string[],
  opts: {
    minCount?: number;
    minKeywordFreq?: number;
    topN?: number;
    keywords?: string[];
  } = {}
): CoOccurrenceResult[] {
  const minCount = opts.minCount ?? 2;
  const minKeywordFreq = opts.minKeywordFreq ?? 2;
  const topN = opts.topN ?? 50;
  const totalDocs = documents.length;

  if (totalDocs < 2) return [];

  // 각 문서에서 키워드 집합 추출
  const docKeywordSets: Set<string>[] = [];
  const keywordDocCount = new Map<string, number>(); // 키워드 → 등장 문서 수

  for (const doc of documents) {
    const tokens = extractKeywords(doc);
    const uniqueTokens = new Set(tokens);
    docKeywordSets.push(uniqueTokens);

    for (const t of uniqueTokens) {
      keywordDocCount.set(t, (keywordDocCount.get(t) ?? 0) + 1);
    }
  }

  // 사전 제공된 키워드가 있으면 필터링, 없으면 빈도 기준 필터링
  let validKeywords: Set<string>;
  if (opts.keywords && opts.keywords.length > 0) {
    validKeywords = new Set(opts.keywords);
  } else {
    validKeywords = new Set<string>();
    for (const [kw, count] of keywordDocCount) {
      if (count >= minKeywordFreq) {
        validKeywords.add(kw);
      }
    }
  }

  // 공동 출현 쌍 카운팅
  const pairCount = new Map<string, number>(); // "a|||b" → count

  for (const kwSet of docKeywordSets) {
    const filtered = [...kwSet].filter((k) => validKeywords.has(k));
    // 쌍 조합 (정렬해서 중복 방지)
    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        const [a, b] = filtered[i] < filtered[j]
          ? [filtered[i], filtered[j]]
          : [filtered[j], filtered[i]];
        const key = `${a}|||${b}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  // PMI 계산 및 결과 생성
  const results: CoOccurrenceResult[] = [];

  for (const [key, coCount] of pairCount) {
    if (coCount < minCount) continue;

    const [a, b] = key.split("|||");
    const totalA = keywordDocCount.get(a) ?? 0;
    const totalB = keywordDocCount.get(b) ?? 0;

    if (totalA === 0 || totalB === 0) continue;

    // PMI = log2( P(A,B) / (P(A) * P(B)) )
    // P(A,B) = coCount / totalDocs
    // P(A) = totalA / totalDocs
    // P(B) = totalB / totalDocs
    const pAB = coCount / totalDocs;
    const pA = totalA / totalDocs;
    const pB = totalB / totalDocs;
    const pmi = Math.log2(pAB / (pA * pB));

    results.push({ a, b, coCount, totalA, totalB, pmi: Math.round(pmi * 1000) / 1000 });
  }

  // PMI 내림차순 정렬, 동률이면 coCount 내림차순
  results.sort((x, y) => y.pmi - x.pmi || y.coCount - x.coCount);

  return results.slice(0, topN);
}

/**
 * 키워드 네트워크 클러스터링 — 높은 PMI를 가진 키워드끼리 그룹으로 묶습니다.
 * 단순 연결 컴포넌트(connected component) 방식.
 *
 * @param coResults computeCoOccurrence 결과
 * @param pmiThreshold PMI 이 값 이상인 쌍만 연결 (기본 1.0)
 * @returns 키워드 클러스터 배열 (크기 내림차순)
 */
export function clusterKeywords(
  coResults: CoOccurrenceResult[],
  pmiThreshold: number = 1.0
): string[][] {
  // 그래프 생성 (인접 리스트)
  const adj = new Map<string, Set<string>>();

  for (const r of coResults) {
    if (r.pmi < pmiThreshold) continue;
    if (!adj.has(r.a)) adj.set(r.a, new Set());
    if (!adj.has(r.b)) adj.set(r.b, new Set());
    adj.get(r.a)!.add(r.b);
    adj.get(r.b)!.add(r.a);
  }

  // BFS로 연결 컴포넌트 탐색
  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const node of adj.keys()) {
    if (visited.has(node)) continue;

    const cluster: string[] = [];
    const queue = [node];
    visited.add(node);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    clusters.push(cluster);
  }

  // 크기 내림차순 정렬
  clusters.sort((a, b) => b.length - a.length);

  return clusters;
}

// ─── 내부 유틸 ───

/** 조사 접미사 (간략 버전 — comment-analyze.ts 와 동일 로직) */
const JOSA_SIMPLE = [
  "에서는", "으로는", "에서도", "으로도", "이라는", "이라고",
  "에서", "으로", "에게", "한테", "까지", "부터", "보다", "처럼", "만큼", "밖에",
  "로서", "로써", "마저", "조차", "이나", "대로", "같이", "마다",
  "은", "는", "이", "가", "을", "를", "의", "에", "로", "도", "만",
  "와", "과", "며", "고", "서", "라", "요",
];

const STOP_SIMPLE = new Set([
  "있다", "없다", "하다", "되다", "같다", "보다", "가다", "오다",
  "그냥", "진짜", "정말", "완전", "너무", "아주", "매우",
  "것", "거", "수", "줄", "때", "곳", "뿐",
  "우리", "저희", "사람", "다들", "모두",
  "ㅋㅋ", "ㅎㅎ", "ㅠㅠ", "ㅜㅜ",
]);

function stripSuffixSimple(word: string): string {
  for (const s of JOSA_SIMPLE) {
    if (word.endsWith(s) && word.length - s.length >= 2) return word.slice(0, -s.length);
  }
  return word;
}

/**
 * 텍스트에서 한글 키워드 토큰 추출 (2-8글자).
 * 조사 제거 + 불용어 필터링.
 */
function extractKeywords(text: string): string[] {
  const tokens = text.match(/[가-힣]{2,8}/g) ?? [];
  const result: string[] = [];

  for (const raw of tokens) {
    const stripped = stripSuffixSimple(raw);
    if (stripped.length < 2) continue;
    if (STOP_SIMPLE.has(stripped)) continue;
    if (STOP_SIMPLE.has(raw)) continue;
    result.push(stripped);
  }

  return result;
}
