import { NextResponse } from "next/server";
import {
  spikeInsightWithClaude,
  sentimentTimelineWithClaude,
  relatedKeywordsGraphWithClaude,
  type SentimentTimeline,
  type RelatedKeywordsGraph,
} from "@/lib/providers/claude";
import { searchYouTubeByDate, fetchComments } from "@/lib/providers/youtube";
import { searchNaverBlog, searchNaverNews } from "@/lib/providers/naver";
import { detectSeasonal, koreanWeekday } from "@/lib/korean-seasonal";

export const runtime = "nodejs";
export const maxDuration = 90;

function iso(d: Date): string {
  return d.toISOString();
}

function shiftDate(s: string, days: number): Date {
  const d = new Date(s.length === 7 ? s + "-01" : s);
  d.setDate(d.getDate() + days);
  return d;
}

function koreanPeriodHint(peakPeriod: string): string {
  const m = peakPeriod.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}년 ${parseInt(m[2], 10)}월 ${parseInt(m[3], 10)}일`;
  const mm = peakPeriod.match(/^(\d{4})-(\d{2})/);
  if (mm) return `${mm[1]}년 ${parseInt(mm[2], 10)}월`;
  return "";
}

function inDateWindow(pubDate: string | undefined, peakDay: string, bufferDays: number): boolean {
  const d = pubDate?.slice(0, 10);
  if (!d) return false;
  const lo = shiftDate(peakDay, -bufferDays).toISOString().slice(0, 10);
  const hi = shiftDate(peakDay, +bufferDays).toISOString().slice(0, 10);
  return d >= lo && d <= hi;
}

function uniqueBy<T>(arr: T[], keyFn: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      keyword,
      spike,
      news,
      videos,
      comments,
      includeSentiment = false,
      includeGraph = false,
    } = body as {
      keyword: string;
      spike: {
        startPeriod: string;
        endPeriod: string;
        peakPeriod: string;
        peakRatio: number;
        multiplier: number;
      };
      news: Array<{ title: string; description: string; link: string; pubDate: string }>;
      videos: Array<{ videoId?: string; title: string; description: string; channelTitle: string; viewCount: number; publishedAt?: string }>;
      comments: Array<{ text: string; likeCount: number; publishedAt?: string }>;
      includeSentiment?: boolean;
      includeGraph?: boolean;
    };

    if (!keyword || !spike?.startPeriod) {
      return NextResponse.json({ error: "keyword와 spike 필요" }, { status: 400 });
    }

    const peakDay = spike.peakPeriod.slice(0, 10);
    const periodHint = koreanPeriodHint(peakDay);
    const monthHint = periodHint.replace(/ \d+일$/, ""); // "2025년 10월 6일" → "2025년 10월"
    const seasonal = detectSeasonal(peakDay);
    const weekday = koreanWeekday(peakDay);

    // ── 쿼리 변주 — 쿼리 수 제한 (rate limit 회피): 기본 + 월 + 시즌 최대 2개 = 최대 4개
    const queries: string[] = Array.from(new Set([
      keyword,
      monthHint ? `${keyword} ${monthHint}` : "",
      ...seasonal.slice(0, 2).map((s) => `${keyword} ${s}`),
    ].filter(Boolean))).slice(0, 4);

    // 순차 실행으로 네이버 QPS 제한 회피 (초당 10 이하)
    async function sequentialMap<T, R>(arr: T[], fn: (x: T) => Promise<R>, delayMs = 120): Promise<R[]> {
      const out: R[] = [];
      for (const x of arr) {
        out.push(await fn(x).catch(() => ({} as R)));
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      }
      return out;
    }

    // ── 네이버 수집: date + sim 순차 실행
    const newsDate = await sequentialMap(queries, (q) => searchNaverNews(q, 40, "date").catch(() => [] as any[]));
    const newsSim = await sequentialMap(queries, (q) => searchNaverNews(q, 40, "sim").catch(() => [] as any[]));
    const blogDate = await sequentialMap(queries, (q) => searchNaverBlog(q, 30, "date").catch(() => [] as any[]));
    const blogSim = await sequentialMap(queries, (q) => searchNaverBlog(q, 30, "sim").catch(() => [] as any[]));
    const allNews = uniqueBy(
      [...newsDate.flat(), ...newsSim.flat()],
      (n) => n.link
    );
    const allBlogs = uniqueBy(
      [...blogDate.flat(), ...blogSim.flat()],
      (b) => b.link
    );

    console.log(
      `[spike-insight] keyword="${keyword}" peak=${peakDay}\n` +
      `  queries=${queries.length} (${queries.join(" | ")})\n` +
      `  raw news=${allNews.length}, raw blogs=${allBlogs.length}\n` +
      `  per-query news counts (date): ${newsDate.map((a) => a.length).join(",")}\n` +
      `  per-query news counts (sim):  ${newsSim.map((a) => a.length).join(",")}\n` +
      `  per-query blog counts (date): ${blogDate.map((a) => a.length).join(",")}\n` +
      `  per-query blog counts (sim):  ${blogSim.map((a) => a.length).join(",")}\n` +
      `  sample news pubDates: ${allNews.slice(0, 5).map((n) => n.pubDate).join(" | ")}\n` +
      `  sample blog pubDates: ${allBlogs.slice(0, 5).map((b) => b.pubDate).join(" | ")}`
    );

    // 날짜 필터 — 점진적 완화: ±7 → ±14 → ±30 → ±90 → 전체 상위 30개
    const expandFilter = (arr: any[]) => {
      for (const buf of [7, 14, 30, 90]) {
        const filtered = arr.filter((it) => inDateWindow(it.pubDate, peakDay, buf));
        if (filtered.length >= 3) return { items: filtered, bufferUsed: buf, fallback: false };
      }
      // fallback: pubDate 상관없이 상위 30개 (네이버는 최신 중심이라 과거 피크는 거의 못 잡음)
      return { items: arr.slice(0, 30), bufferUsed: -1, fallback: true };
    };
    const newsResult = expandFilter(allNews);
    const blogResult = expandFilter(allBlogs);
    const windowNews = newsResult.items;
    const windowBlogs = blogResult.items;

    console.log(
      `[spike-insight] filter result: newsWindow=${windowNews.length} (buf=${newsResult.bufferUsed} fallback=${newsResult.fallback}), blogWindow=${windowBlogs.length} (buf=${blogResult.bufferUsed} fallback=${blogResult.fallback})`
    );

    // 창 밖이라도 시즌 키워드 포함 기사는 "맥락 근거"로 살림
    const seasonalPattern = seasonal.length > 0 ? new RegExp(seasonal.join("|"), "i") : null;
    const contextNews = seasonalPattern
      ? allNews
          .filter((n) => seasonalPattern.test(n.title) || seasonalPattern.test(n.description))
          .filter((n) => !windowNews.find((w) => w.link === n.link))
          .slice(0, 10)
      : [];

    // ── YouTube 축소 (네이버 비중 증대)
    const afterDate = shiftDate(peakDay, -1);
    const beforeDate = shiftDate(peakDay, +1);
    afterDate.setHours(0, 0, 0, 0);
    beforeDate.setHours(23, 59, 59, 999);

    const peakVideos = await searchYouTubeByDate(
      keyword,
      iso(afterDate),
      iso(beforeDate),
      6
    ).catch(() => []);

    const peakCommentArrays = await Promise.all(
      peakVideos.slice(0, 3).map((v) => fetchComments(v.videoId, 8).catch(() => []))
    );
    const peakComments = peakCommentArrays.flat();

    // ── 최종 병합 (피크 근거 우선)
    const mergedNews = [...windowNews, ...contextNews, ...windowBlogs];
    const mergedVideos = [
      ...peakVideos,
      ...videos.filter((v: any) => v.videoId && !peakVideos.find((pv) => pv.videoId === v.videoId)),
    ];
    const mergedComments = [...peakComments, ...comments];

    // ── Claude 분석
    const insight = await spikeInsightWithClaude({
      keyword,
      spike,
      newsHeadlines: mergedNews,
      videos: mergedVideos,
      comments: mergedComments,
      contextHints: {
        peakDay,
        weekday,
        seasonal,
        monthHint,
      },
    });

    // ── 감정 시계열 (피크 -7 / 0 / +7 3구간) — lazy: 기본 skip, 요청 시만
    let sentimentTimeline: SentimentTimeline | null = null;
    if (includeSentiment) try {
      const inRange = <T extends { pubDate?: string }>(arr: T[], center: string, bufDays: number): T[] => {
        const lo = shiftDate(center, -bufDays).toISOString().slice(0, 10);
        const hi = shiftDate(center, +bufDays).toISOString().slice(0, 10);
        return arr.filter((it) => it.pubDate && it.pubDate >= lo && it.pubDate <= hi);
      };
      const inRangeTitles = (arr: any[], center: string, buf: number): string[] =>
        inRange(arr, center, buf).slice(0, 12).map((it: any) => it.title);
      const inRangeExcerpts = (arr: any[], center: string, buf: number): string[] =>
        inRange(arr, center, buf)
          .slice(0, 8)
          .map((it: any) => it.description)
          .filter((d: string) => d && d.length >= 20);
      const inRangeComments = (
        arr: Array<{ text: string; likeCount: number; publishedAt?: string }>,
        center: string,
        buf: number
      ) => {
        const lo = shiftDate(center, -buf).toISOString().slice(0, 10);
        const hi = shiftDate(center, +buf).toISOString().slice(0, 10);
        return arr
          .filter((c) => c.publishedAt && c.publishedAt.slice(0, 10) >= lo && c.publishedAt.slice(0, 10) <= hi)
          .filter((c) => c.text && c.text.length >= 12)
          .slice(0, 6)
          .map((c) => ({ text: c.text, likeCount: c.likeCount }));
      };

      const tMinus7 = shiftDate(peakDay, -7).toISOString().slice(0, 10);
      const tPlus7 = shiftDate(peakDay, +7).toISOString().slice(0, 10);

      const rangeDisplay = (c: string, buf: number): string => {
        const lo = shiftDate(c, -buf).toISOString().slice(0, 10);
        const hi = shiftDate(c, +buf).toISOString().slice(0, 10);
        return `${lo} ~ ${hi}`;
      };

      const commentsWithDate = [...peakComments, ...comments].filter((c: any) => c.publishedAt) as Array<{
        text: string;
        likeCount: number;
        publishedAt?: string;
      }>;

      const buckets = [
        {
          label: "T-7",
          dateRange: rangeDisplay(tMinus7, 3),
          headlines: inRangeTitles(allNews, tMinus7, 3).concat(inRangeTitles(allBlogs, tMinus7, 3)).slice(0, 15),
          excerpts: inRangeExcerpts(allBlogs, tMinus7, 3).concat(inRangeExcerpts(allNews, tMinus7, 3)).slice(0, 8),
          comments: inRangeComments(commentsWithDate, tMinus7, 3),
        },
        {
          label: "T",
          dateRange: rangeDisplay(peakDay, 2),
          headlines: inRangeTitles(allNews, peakDay, 2).concat(inRangeTitles(allBlogs, peakDay, 2)).slice(0, 15),
          excerpts: inRangeExcerpts(allBlogs, peakDay, 2).concat(inRangeExcerpts(allNews, peakDay, 2)).slice(0, 8),
          comments: inRangeComments(commentsWithDate, peakDay, 2),
        },
        {
          label: "T+7",
          dateRange: rangeDisplay(tPlus7, 3),
          headlines: inRangeTitles(allNews, tPlus7, 3).concat(inRangeTitles(allBlogs, tPlus7, 3)).slice(0, 15),
          excerpts: inRangeExcerpts(allBlogs, tPlus7, 3).concat(inRangeExcerpts(allNews, tPlus7, 3)).slice(0, 8),
          comments: inRangeComments(commentsWithDate, tPlus7, 3),
        },
      ];

      const hasAny = buckets.some(
        (b) => b.headlines.length > 0 || b.excerpts.length > 0 || b.comments.length > 0
      );
      if (hasAny) {
        sentimentTimeline = await sentimentTimelineWithClaude({
          keyword,
          peakDay,
          buckets,
        });
      }
    } catch (e) {
      console.warn("[spike-insight] sentiment timeline 실패", e);
    }

    // ── 연관어 그래프 (피크 구간) — lazy: 요청 시만
    let relatedGraph: RelatedKeywordsGraph | null = null;
    if (includeGraph) try {
      const newsTitles = [...windowNews, ...contextNews].slice(0, 25).map((n: any) => n.title);
      const blogTitles = windowBlogs.slice(0, 15).map((b: any) => b.title);
      const commentTexts = [...peakComments, ...comments]
        .slice(0, 15)
        .map((c: any) => c.text)
        .filter((t: string) => t && t.length >= 10);
      if (newsTitles.length + blogTitles.length + commentTexts.length >= 5) {
        relatedGraph = await relatedKeywordsGraphWithClaude({
          keyword,
          peakDay,
          newsTitles,
          blogTitles,
          commentTexts,
        });
      }
    } catch (e) {
      console.warn("[spike-insight] related graph 실패", e);
    }

    return NextResponse.json({
      insight,
      sentimentTimeline,
      relatedGraph,
      refetched: {
        peakDay,
        weekday,
        seasonal,
        queries,
        newsWindowCount: windowNews.length,
        newsContextCount: contextNews.length,
        blogsWindowCount: windowBlogs.length,
        newsTotal: allNews.length,
        blogsTotal: allBlogs.length,
        videosCount: peakVideos.length,
        commentsCount: peakComments.length,
        ratio: {
          naver: windowNews.length + contextNews.length + windowBlogs.length,
          youtube: peakVideos.length + peakComments.length,
        },
        debug: {
          newsBufferDays: newsResult.bufferUsed,
          blogsBufferDays: blogResult.bufferUsed,
          newsFallback: newsResult.fallback,
          blogsFallback: blogResult.fallback,
          firstNewsDate: allNews[0]?.pubDate ?? "",
          firstBlogDate: allBlogs[0]?.pubDate ?? "",
          newestInWindowNews: windowNews.map((n: any) => n.pubDate).sort().reverse()[0] ?? "",
          newestInWindowBlogs: windowBlogs.map((b: any) => b.pubDate).sort().reverse()[0] ?? "",
        },
      },
      evidence: {
        peakVideos,
        peakBlogs: windowBlogs,
        peakNews: [...windowNews, ...contextNews],
        peakComments,
      },
    });
  } catch (e: unknown) {
    console.error("[spike-insight]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
