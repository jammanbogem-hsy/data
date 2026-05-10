// 유행 확산 분석 (Cascade Detection)
//
// 트렌드가 플랫폼 간에 어떻게 퍼지는지 탐지한다.
// YouTube → News → Search 순서로 확산되는 패턴을 찾는다.
//
// 알고리즘:
//   1. DataLab 트렌드에서 검색 급등(spike)을 탐지
//   2. 각 급등 시점 기준 [-14, +3]일 범위에서 YouTube/뉴스의 최초 언급을 찾음
//   3. lag(일수 차이)를 계산해 어떤 플랫폼이 선행했는지 판별

import { detectSpikes } from "@/lib/spike";

export interface CascadeEvent {
  platform: "youtube" | "news" | "search";
  date: string;
  title: string;
  lag: number; // days relative to search spike (negative = before)
}

export interface CascadeResult {
  events: CascadeEvent[];
  pattern: "youtube-first" | "news-first" | "simultaneous" | "search-only";
  spikePeak: string;
}

/**
 * 두 날짜 사이의 일수 차이를 계산한다.
 * dateA - dateB (일 단위, 소수점 반올림)
 */
function dayDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((a - b) / 86_400_000);
}

/**
 * ISO 날짜 문자열에서 YYYY-MM-DD 부분만 추출
 */
function toDateStr(iso: string): string {
  if (!iso) return "";
  // "2024-10-14T09:30:00Z" → "2024-10-14"
  return iso.slice(0, 10);
}

export function detectCascade(
  videos: Array<{ title: string; publishedAt?: string; videoId: string }>,
  news: Array<{ title: string; pubDate: string }>,
  trend: Array<{ period: string; ratio: number }>,
): CascadeResult | null {
  if (trend.length < 8) return null;

  // 1. 검색 급등 탐지
  const spikes = detectSpikes(trend, { multiplierThreshold: 1.3, minAbs: 15 });
  if (spikes.length === 0) return null;

  const spike = spikes[0]; // 가장 강한 급등
  const spikePeak = spike.peakPeriod;

  const events: CascadeEvent[] = [];

  // 검색 급등 이벤트 추가
  events.push({
    platform: "search",
    date: spikePeak,
    title: `검색 급등 (${spike.peakRatio}점)`,
    lag: 0,
  });

  // 2. YouTube: 급등일 기준 [-14, +3]일 범위에서 가장 이른 영상 찾기
  const validVideos = videos
    .filter((v) => v.publishedAt)
    .map((v) => ({
      ...v,
      dateStr: toDateStr(v.publishedAt!),
      lag: dayDiff(toDateStr(v.publishedAt!), spikePeak),
    }))
    .filter((v) => v.lag >= -14 && v.lag <= 3)
    .sort((a, b) => a.lag - b.lag); // 가장 이른 것 먼저

  if (validVideos.length > 0) {
    const earliest = validVideos[0];
    events.push({
      platform: "youtube",
      date: earliest.dateStr,
      title: earliest.title,
      lag: earliest.lag,
    });
  }

  // 3. News: 급등일 기준 [-14, +3]일 범위에서 가장 이른 기사 찾기
  const validNews = news
    .filter((n) => n.pubDate)
    .map((n) => ({
      ...n,
      lag: dayDiff(n.pubDate, spikePeak),
    }))
    .filter((n) => n.lag >= -14 && n.lag <= 3)
    .sort((a, b) => a.lag - b.lag);

  if (validNews.length > 0) {
    const earliest = validNews[0];
    events.push({
      platform: "news",
      date: earliest.pubDate,
      title: earliest.title,
      lag: earliest.lag,
    });
  }

  // 4. 확산 패턴 결정
  const ytEvent = events.find((e) => e.platform === "youtube");
  const newsEvent = events.find((e) => e.platform === "news");

  let pattern: CascadeResult["pattern"];

  if (!ytEvent && !newsEvent) {
    pattern = "search-only";
  } else if (ytEvent && newsEvent) {
    const diff = Math.abs(ytEvent.lag - newsEvent.lag);
    if (diff <= 1) {
      pattern = "simultaneous";
    } else if (ytEvent.lag < newsEvent.lag) {
      pattern = "youtube-first";
    } else {
      pattern = "news-first";
    }
  } else if (ytEvent) {
    pattern = "youtube-first";
  } else {
    pattern = "news-first";
  }

  // 이벤트를 날짜순으로 정렬
  events.sort((a, b) => dayDiff(a.date, b.date));

  return { events, pattern, spikePeak };
}
