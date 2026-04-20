import { NextResponse } from "next/server";
import { searchNaverNews, searchNaverBlog } from "@/lib/providers/naver";
import { planHypothesisVerification, deepenSingleHypothesis } from "@/lib/providers/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { keyword, hypothesis } = body as {
      keyword: string;
      hypothesis: {
        title: string;
        reasoning: string;
        evidence: string[];
        confidence: "high" | "medium" | "low";
      };
    };

    if (!keyword || !hypothesis?.title) {
      return NextResponse.json({ error: "keyword와 hypothesis 필요" }, { status: 400 });
    }

    // 1) Claude에게 이 가설 검증용 쿼리 제안받기
    const plans = await planHypothesisVerification(keyword, [hypothesis]);
    const queries = plans[0]?.verifyQueries?.slice(0, 3) ?? [
      `${keyword} ${hypothesis.title}`,
    ];

    // 2) 각 쿼리로 네이버 뉴스 + 블로그 병렬 수집
    const evidence = await Promise.all(
      queries.map(async (q) => {
        const [news, blog] = await Promise.all([
          searchNaverNews(q, 10).catch(() => []),
          searchNaverBlog(q, 8).catch(() => []),
        ]);
        return { query: q, news: [...news, ...blog] };
      })
    );

    // 3) Claude로 단일 가설 refine
    const result = await deepenSingleHypothesis({
      keyword,
      hypothesis,
      verifyEvidence: evidence,
    });

    return NextResponse.json({
      ...result,
      evidence: evidence.map((e) => ({
        query: e.query,
        newsCount: e.news.length,
        sample: e.news.slice(0, 6).map((n: any) => ({
          title: n.title,
          link: n.link,
          pubDate: n.pubDate,
        })),
      })),
    });
  } catch (e: unknown) {
    console.error("[deepen-hypothesis]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
