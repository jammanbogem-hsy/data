import { NextResponse } from "next/server";
import { searchNaverNews, searchNaverBlog, searchNaverCafe, fetchDataLabTrend, fetchDataLabTrendMulti } from "@/lib/providers/naver";
import { collectVideosAndComments } from "@/lib/providers/youtube";
import { fetchWikipediaMulti } from "@/lib/providers/wikipedia";
import { getKeywordInsight } from "@/lib/providers/naver-ad";
import {
  investigateWithClaude,
  compareKeywordsWithClaude,
  planHypothesisVerification,
  refineHypothesesWithClaude,
} from "@/lib/providers/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

function dateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isValidISO(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { keyword, keywords, startDate, endDate, timeUnit, deep, gender, ages, device, compareGender } = body as {
    keyword?: string;
    keywords?: string[];
    startDate?: string;
    endDate?: string;
    timeUnit?: "date" | "week" | "month";
    deep?: boolean;
    gender?: string;
    ages?: string[];
    device?: string;
    compareGender?: boolean;
  };

  // keywords 배열 우선, 없으면 keyword (문자열) → 배열화
  let kwList: string[] = [];
  if (Array.isArray(keywords)) {
    kwList = keywords.map((k) => String(k).trim()).filter(Boolean);
  } else if (typeof keyword === "string") {
    // 쉼표/세미콜론 구분자 허용
    kwList = keyword.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  kwList = Array.from(new Set(kwList)).slice(0, 5);

  if (kwList.length === 0) {
    return NextResponse.json({ error: "keyword 필요" }, { status: 400 });
  }
  if (kwList.some((k) => k.length < 1 || k.length > 40)) {
    return NextResponse.json({ error: "키워드 길이 1~40자" }, { status: 400 });
  }

  const primary = kwList[0];
  const today = dateISO(new Date());
  const defaultStart = dateISO(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
  const startD = isValidISO(startDate) ? startDate : defaultStart;
  const endD = isValidISO(endDate) ? endDate : today;
  const unit: "date" | "week" | "month" = timeUnit ?? "date";

  try {
    // 네이버 수집량 증가 + 카페 추가
    const [newsRecent, newsSim, blog1, blog2, cafe1, yt, multiTrend, wikipediaTrend, keywordInsight] = await Promise.all([
      searchNaverNews(primary, 50).catch(() => []),
      searchNaverNews(`${primary}`, 50, "sim").catch(() => []),
      searchNaverBlog(primary, 30).catch(() => []),
      searchNaverBlog(primary, 30).catch(() => []),
      searchNaverCafe(primary, 40, "sim").catch(() => []), // 커뮤니티 여론
      collectVideosAndComments(primary, 8, 20).catch(() => ({ videos: [], comments: [] })),
      kwList.length > 1
        ? fetchDataLabTrendMulti(kwList, startD, endD, unit).catch(() => [])
        : fetchDataLabTrend(primary, startD, endD, unit, { gender: gender ?? "", ages: ages ?? [], device: device ?? "" })
            .then((series) => [{ keyword: primary, series }])
            .catch(() => []),
      // Wikipedia 한국어 pageviews (2015+, 역사 데이터 보강)
      fetchWikipediaMulti(kwList, startD, endD, "ko").catch(() => []),
      // 네이버 검색광고 API — 실제 월간 검색량 + 연관 키워드
      getKeywordInsight(primary, 20).catch(() => null),
    ]);

    // 뉴스·블로그·카페 중복 제거 (link 기준)
    const seen = new Set<string>();
    const allNews = [...newsRecent, ...newsSim, ...blog1, ...blog2, ...cafe1].filter((n) => {
      if (!n?.link || seen.has(n.link)) return false;
      seen.add(n.link);
      return true;
    });

    // 주 키워드 단일 시계열 (기존 UI 호환)
    const primarySeries = multiTrend.find((t) => t.keyword === primary)?.series ?? multiTrend[0]?.series ?? [];

    // 남녀 비교 모드: multiTrend에 남/여 시리즈 추가
    if (compareGender && kwList.length === 1) {
      try {
        const [maleSeries, femaleSeries] = await Promise.all([
          fetchDataLabTrend(primary, startD, endD, unit, { gender: "m", ages: ages ?? [], device: device ?? "" }),
          fetchDataLabTrend(primary, startD, endD, unit, { gender: "f", ages: ages ?? [], device: device ?? "" }),
        ]);
        multiTrend.push(
          { keyword: `${primary} (남성)`, series: maleSeries },
          { keyword: `${primary} (여성)`, series: femaleSeries }
        );
      } catch (e) {
        console.warn("[investigate] gender compare failed", e);
      }
    }

    // 주 키워드 Claude 1차 분석
    let insight = await investigateWithClaude({
      keyword: primary,
      newsHeadlines: allNews,
      videos: yt.videos,
      comments: yt.comments,
      trend: primarySeries,
    });

    // deep 모드: 가설 → 검증 쿼리 → 재수집 → refine
    let verificationTrace: any = null;
    if (deep) {
      try {
        const plans = await planHypothesisVerification(primary, insight.hypotheses);
        // 각 plan의 verifyQueries 네이버 재검색 (가설당 1-2개 쿼리 × 뉴스 10)
        const verifyBatches = await Promise.all(
          plans.flatMap((p) =>
            p.verifyQueries.slice(0, 2).map((q) =>
              searchNaverNews(q, 10).then((news) => ({
                hypothesisTitle: p.hypothesisTitle,
                query: q,
                news,
              })).catch(() => ({ hypothesisTitle: p.hypothesisTitle, query: q, news: [] }))
            )
          )
        );
        verificationTrace = {
          plans,
          batches: verifyBatches.map((b) => ({
            hypothesisTitle: b.hypothesisTitle,
            query: b.query,
            newsCount: b.news.length,
          })),
        };
        // 충분한 추가 근거가 있을 때만 refine
        const totalVerifyNews = verifyBatches.reduce((s, b) => s + b.news.length, 0);
        if (totalVerifyNews >= 3) {
          insight = await refineHypothesesWithClaude({
            keyword: primary,
            initialHypotheses: insight.hypotheses,
            verificationEvidence: verifyBatches,
          });
          verificationTrace.refined = true;
        }
      } catch (e) {
        console.warn("[investigate] deep chain 실패", e);
      }
    }

    // 다중이면 비교 분석도 병행
    let compareInsight = null;
    if (kwList.length >= 2 && multiTrend.length >= 2) {
      try {
        // 각 키워드의 간단 뉴스 헤드라인 (비교 인사이트 보조)
        const perKwNews = await Promise.all(
          kwList.map((k) =>
            searchNaverNews(k, 8)
              .then((ns) => ({ keyword: k, titles: ns.map((n) => n.title) }))
              .catch(() => ({ keyword: k, titles: [] as string[] }))
          )
        );
        compareInsight = await compareKeywordsWithClaude({
          keywords: kwList,
          multiTrend,
          perKeywordNews: perKwNews,
        });
      } catch (e) {
        console.warn("[investigate] compare 실패", e);
      }
    }

    return NextResponse.json({
      keyword: primary,
      keywords: kwList,
      fetchedAt: new Date().toISOString(),
      range: { startDate: startD, endDate: endD, timeUnit: unit },
      insight,
      compareInsight,
      verificationTrace,
      keywordInsight: keywordInsight ?? null,
      evidence: {
        news: allNews.slice(0, 100),
        videos: yt.videos,
        comments: yt.comments.slice(0, 60),
        trend: primarySeries,
        multiTrend,
        wikipediaTrend,
      },
    });
  } catch (e: unknown) {
    console.error("[investigate]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
