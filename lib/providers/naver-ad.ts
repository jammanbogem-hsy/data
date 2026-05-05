// 네이버 검색광고 API — 키워드 도구
// DataLab(상대치 0-100)과 달리 실제 월간 검색량 수치를 제공.
//
// 제공 정보:
// - 월간 PC 검색량
// - 월간 모바일 검색량
// - 연관 키워드 목록
// - 광고 경쟁 정도 (compIdx)

import crypto from "crypto";

const BASE_URL = "https://api.naver.com";

function getTimestamp(): string {
  return String(Date.now());
}

function generateSignature(timestamp: string, method: string, uri: string): string {
  const secretKey = process.env.NAVER_AD_SECRET_KEY!;
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac("sha256", secretKey).update(message).digest("base64");
}

function headers(method: string, uri: string): Record<string, string> {
  const timestamp = getTimestamp();
  return {
    "X-Timestamp": timestamp,
    "X-API-KEY": process.env.NAVER_AD_API_KEY!,
    "X-Customer": process.env.NAVER_AD_CUSTOMER_ID!,
    "X-Signature": generateSignature(timestamp, method, uri),
    "Content-Type": "application/json",
  };
}

export interface KeywordResult {
  relKeyword: string;
  monthlyPcQcCnt: number;    // 월간 PC 검색량 (< 10이면 "< 10")
  monthlyMobileQcCnt: number; // 월간 모바일 검색량
  monthlyAvePcClkCnt: number; // 월간 PC 평균 클릭
  monthlyAveMobileClkCnt: number;
  monthlyAvePcCtr: number;    // PC CTR
  monthlyAveMobileCtr: number;
  plAvgDepth: number;         // 광고 경쟁 깊이
  compIdx: string;            // "높음" | "보통" | "낮음"
  totalQcCnt: number;         // 계산: PC + 모바일 합산
}

/**
 * 키워드 검색량 + 연관 키워드 조회.
 * 한 번에 최대 5개 키워드 입력 가능.
 */
export async function fetchKeywordStats(
  keywords: string[]
): Promise<KeywordResult[]> {
  if (!process.env.NAVER_AD_API_KEY || !process.env.NAVER_AD_SECRET_KEY) {
    console.warn("[naver-ad] API 키가 설정되지 않았습니다");
    return [];
  }

  const uri = "/keywordstool";
  const method = "GET";
  const params = new URLSearchParams({
    hintKeywords: keywords.slice(0, 5).join(","),
    showDetail: "1",
  });

  try {
    const r = await fetch(`${BASE_URL}${uri}?${params}`, {
      method,
      headers: headers(method, uri),
    });

    if (!r.ok) {
      const body = await r.text();
      console.error(`[naver-ad] HTTP ${r.status}: ${body.slice(0, 200)}`);
      return [];
    }

    const data = await r.json();
    console.log(`[naver-ad] keyword="${keywords.join(",")}" → keywordList ${(data.keywordList ?? []).length}건, 샘플:`, (data.keywordList ?? []).slice(0, 3).map((k: any) => k.relKeyword));
    const items: KeywordResult[] = (data.keywordList ?? []).map((k: any) => {
      const pc = typeof k.monthlyPcQcCnt === "number" ? k.monthlyPcQcCnt : 0;
      const mo = typeof k.monthlyMobileQcCnt === "number" ? k.monthlyMobileQcCnt : 0;
      return {
        relKeyword: k.relKeyword ?? "",
        monthlyPcQcCnt: pc,
        monthlyMobileQcCnt: mo,
        monthlyAvePcClkCnt: k.monthlyAvePcClkCnt ?? 0,
        monthlyAveMobileClkCnt: k.monthlyAveMobileClkCnt ?? 0,
        monthlyAvePcCtr: k.monthlyAvePcCtr ?? 0,
        monthlyAveMobileCtr: k.monthlyAveMobileCtr ?? 0,
        plAvgDepth: k.plAvgDepth ?? 0,
        compIdx: k.compIdx ?? "보통",
        totalQcCnt: pc + mo,
      };
    });

    // 검색량 내림차순 정렬
    items.sort((a, b) => b.totalQcCnt - a.totalQcCnt);
    return items;
  } catch (e) {
    console.error("[naver-ad] 오류:", e);
    return [];
  }
}

/**
 * 네이버 자동완성 API — 실제 사용자들이 함께 검색하는 키워드.
 * API 키 불필요, 모든 키워드에서 작동.
 */
export async function fetchAutoComplete(keyword: string, limit = 15): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      q: keyword,
      con: "1",
      frm: "nv",
      ans: "2",
      t_koreng: "1",
      q_enc: "UTF-8",
      st: "100",
      r_lt: "100",
      r_format: "json",
    });
    const r = await fetch(`https://ac.search.naver.com/nx/ac?${params}`);
    if (!r.ok) return [];
    const data = await r.json();
    const suggestions: string[] = [];
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
    const kw = norm(keyword);
    for (const group of data.items ?? []) {
      for (const item of group) {
        if (Array.isArray(item) && item.length > 0) {
          const text = String(item[0]).trim();
          if (text && norm(text) !== kw) suggestions.push(text);
        }
      }
    }
    return suggestions.slice(0, limit);
  } catch (e) {
    console.warn("[naver-ac] 자동완성 실패:", e);
    return [];
  }
}

/**
 * 주 키워드의 실제 검색량 + 상위 연관 키워드 N개.
 * 검색광고 API에 연관 키워드가 없으면 자동완성 API로 폴백.
 */
export async function getKeywordInsight(keyword: string, relatedLimit = 20): Promise<{
  keyword: string;
  totalMonthly: number;
  pcMonthly: number;
  mobileMonthly: number;
  mobileRatio: number;
  compIdx: string;
  relatedKeywords: KeywordResult[];
  autoCompleteKeywords?: string[];
} | null> {
  const results = await fetchKeywordStats([keyword]);
  if (results.length === 0) {
    // 검색량 없어도 자동완성이라도 가져옴
    const ac = await fetchAutoComplete(keyword, relatedLimit);
    return {
      keyword,
      totalMonthly: 0,
      pcMonthly: 0,
      mobileMonthly: 0,
      mobileRatio: 0,
      compIdx: "보통",
      relatedKeywords: [],
      autoCompleteKeywords: ac.length > 0 ? ac : undefined,
    };
  }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const kw = norm(keyword);
  const main = results.find((r) => norm(r.relKeyword) === kw) ?? results[0];
  const related = results
    .filter((r) => norm(r.relKeyword) !== kw)
    .slice(0, relatedLimit);

  const total = main.monthlyPcQcCnt + main.monthlyMobileQcCnt;

  // 항상 자동완성도 함께 가져옴
  const ac = await fetchAutoComplete(keyword, relatedLimit);
  const autoCompleteKeywords = ac.length > 0 ? ac : undefined;

  return {
    keyword: main.relKeyword,
    totalMonthly: total,
    pcMonthly: main.monthlyPcQcCnt,
    mobileMonthly: main.monthlyMobileQcCnt,
    mobileRatio: total > 0 ? Math.round((main.monthlyMobileQcCnt / total) * 100) : 0,
    compIdx: main.compIdx,
    relatedKeywords: related,
    autoCompleteKeywords,
  };
}
