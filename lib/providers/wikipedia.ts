// Wikipedia Pageviews API (공식, 무료, 2015년부터 역사 데이터)
// DataLab(최근 편중)의 보조 소스로 오래된 기간도 안정적으로 수집.
//
// endpoint: https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/...

export interface WikipediaPoint {
  period: string; // YYYY-MM-DD
  views: number;
  ratio: number; // 0-100 자체 정규화 (차트 비교용)
}

const UA = "datamining-edu/0.1 (contact: jammanbogem@gmail.com)";

function yyyymmdd(iso: string): string {
  return iso.replace(/-/g, "");
}

function parseTs(ts: string): string {
  // "2025100600" → "2025-10-06"
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}

export async function fetchWikipediaPageviews(
  title: string,
  startDate: string,
  endDate: string,
  lang: "ko" | "en" = "ko"
): Promise<WikipediaPoint[]> {
  if (!title || !startDate || !endDate) return [];
  // 특수문자 공백 → 언더스코어 (Wikipedia 관행)
  const wikiTitle = title.trim().replace(/\s+/g, "_");
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/all-agents/${encodeURIComponent(wikiTitle)}/daily/${yyyymmdd(startDate)}/${yyyymmdd(endDate)}`;

  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) return [];
  const data = await r.json();
  const items: Array<{ timestamp: string; views: number }> = data.items ?? [];
  if (items.length === 0) return [];

  // 자체 정규화 (0-100) — DataLab과 함께 표시할 수 있게
  const maxViews = items.reduce((m, it) => Math.max(m, it.views), 0);
  return items.map((it) => ({
    period: parseTs(it.timestamp),
    views: it.views,
    ratio: maxViews > 0 ? (it.views / maxViews) * 100 : 0,
  }));
}

/**
 * 여러 keyword 각각에 대해 pageviews 수집.
 * 한 키워드에서 위키 문서가 없으면 빈 배열 리턴 (에러 X).
 */
export async function fetchWikipediaMulti(
  keywords: string[],
  startDate: string,
  endDate: string,
  lang: "ko" | "en" = "ko"
): Promise<Array<{ keyword: string; series: WikipediaPoint[] }>> {
  const results = await Promise.all(
    keywords.map((k) =>
      fetchWikipediaPageviews(k, startDate, endDate, lang)
        .then((series) => ({ keyword: k, series }))
        .catch(() => ({ keyword: k, series: [] as WikipediaPoint[] }))
    )
  );
  return results.filter((r) => r.series.length > 0);
}
