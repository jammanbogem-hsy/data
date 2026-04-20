// 네이버 검색 + DataLab API 클라이언트 (서버 전용)

const SEARCH_URL = "https://openapi.naver.com/v1/search";
const DATALAB_URL = "https://openapi.naver.com/v1/datalab/search";

function headers() {
  return {
    "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID!,
    "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET!,
    "Content-Type": "application/json",
  };
}

export interface NaverNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

export async function searchNaverNews(
  query: string,
  display = 30,
  sort: "date" | "sim" = "date"
): Promise<NaverNewsItem[]> {
  const url = `${SEARCH_URL}/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) {
    const body = await r.text();
    console.error(`[naver-news] HTTP ${r.status} for query="${query}" sort=${sort}: ${body.slice(0, 200)}`);
    throw new Error(`Naver news ${r.status}: ${body.slice(0, 100)}`);
  }
  const data = await r.json();
  return (data.items || []).map((it: any) => ({
    title: stripTags(it.title),
    link: it.originallink || it.link,
    description: stripTags(it.description),
    // pubDate: "Mon, 14 Oct 2024 15:30:00 +0900" → "2024-10-14"
    pubDate: normalizePubDate(it.pubDate),
  }));
}

export async function searchNaverBlog(
  query: string,
  display = 20,
  sort: "date" | "sim" = "date"
): Promise<NaverNewsItem[]> {
  const url = `${SEARCH_URL}/blog.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) {
    console.error(`[naver-blog] HTTP ${r.status} for query="${query}" sort=${sort}`);
    return [];
  }
  const data = await r.json();
  return (data.items || []).map((it: any) => ({
    title: stripTags(it.title),
    link: it.link,
    description: stripTags(it.description),
    // postdate: "20241014" → "2024-10-14"
    pubDate: normalizePubDate(it.postdate || ""),
  }));
}

export async function searchNaverCafe(
  query: string,
  display = 20,
  sort: "date" | "sim" = "sim"
): Promise<NaverNewsItem[]> {
  const url = `${SEARCH_URL}/cafearticle.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) {
    console.error(`[naver-cafe] HTTP ${r.status} for query="${query}"`);
    return [];
  }
  const data = await r.json();
  return (data.items || []).map((it: any) => ({
    title: stripTags(it.title),
    link: it.link,
    description: stripTags(it.description),
    pubDate: normalizePubDate(it.pubDate || ""),
  }));
}

export interface DataLabPoint {
  period: string;
  ratio: number;
}

/**
 * 네이버 DataLab 검색어 트렌드 (최대 1년)
 */
export async function fetchDataLabTrend(
  keyword: string,
  startDate: string,
  endDate: string,
  timeUnit: "date" | "week" | "month" = "date"
): Promise<DataLabPoint[]> {
  const body = {
    startDate,
    endDate,
    timeUnit,
    keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
  };
  const r = await fetch(DATALAB_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`DataLab ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const series = data.results?.[0]?.data ?? [];
  return series.map((d: any) => ({ period: d.period, ratio: d.ratio }));
}

/**
 * 다중 키워드 트렌드 (최대 5개). 여러 선을 한 차트에 비교.
 * Returns: [{ keyword, series: [{ period, ratio }] }]
 */
export async function fetchDataLabTrendMulti(
  keywords: string[],
  startDate: string,
  endDate: string,
  timeUnit: "date" | "week" | "month" = "date"
): Promise<Array<{ keyword: string; series: DataLabPoint[] }>> {
  const kws = keywords.slice(0, 5);
  if (kws.length === 0) return [];
  const body = {
    startDate,
    endDate,
    timeUnit,
    keywordGroups: kws.map((k) => ({ groupName: k, keywords: [k] })),
  };
  const r = await fetch(DATALAB_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`DataLab ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return (data.results || []).map((g: any) => ({
    keyword: g.title ?? "",
    series: (g.data || []).map((d: any) => ({ period: d.period, ratio: d.ratio })),
  }));
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/**
 * 네이버 API pubDate → "YYYY-MM-DD" 로 표준화.
 * - 뉴스 pubDate: "Mon, 14 Oct 2024 15:30:00 +0900" (RFC 2822)
 * - 블로그 postdate: "20241014" (YYYYMMDD)
 * - 이미 ISO("2024-10-14") → 그대로 유지
 */
function normalizePubDate(s: string): string {
  if (!s) return "";
  // 이미 YYYY-MM-DD 형식
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYYMMDD 형식 (블로그 postdate)
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  // RFC 2822 등 — Date로 파싱
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}
