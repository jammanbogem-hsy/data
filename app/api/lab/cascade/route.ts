import { NextResponse } from "next/server";
import { searchNaverNews } from "@/lib/providers/naver";
import { searchYouTube } from "@/lib/providers/youtube";
import { fetchDataLabTrend } from "@/lib/providers/naver";
import { fetchXOpinions } from "@/lib/providers/grok";
import { detectCascade } from "@/lib/lab/cascade-detect";
import { claude, CLAUDE_HAIKU } from "@/lib/providers/claude";
import { parseAiJson } from "@/lib/lab/parse-ai-json";
import { getCache, setCache } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { keyword } = (await req.json()) as { keyword: string };
    if (!keyword || keyword.length < 1 || keyword.length > 40) {
      return NextResponse.json({ error: "키워드를 입력해주세요." }, { status: 400 });
    }

    const cached = getCache<object>("lab-cascade", keyword);
    if (cached) return NextResponse.json(cached);

    // 90일 범위 계산
    const now = new Date();
    const endDate = now.toISOString().slice(0, 10);
    const startDate = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);

    // 1. 병렬 데이터 수집
    const [news, videos, trend, xOpinions] = await Promise.all([
      searchNaverNews(keyword, 30).catch(() => []),
      searchYouTube(keyword, 8).catch(() => []),
      fetchDataLabTrend(keyword, startDate, endDate, "date").catch(() => []),
      fetchXOpinions(keyword).catch(() => null),
    ]);

    if (trend.length < 8) {
      return NextResponse.json(
        { error: "트렌드 데이터가 부족합니다. 다른 키워드를 시도해보세요." },
        { status: 400 },
      );
    }

    // 2. Cascade 탐지
    const cascade = detectCascade(videos, news, trend);

    if (!cascade) {
      return NextResponse.json(
        { error: "검색 급등이 감지되지 않았습니다. 최근 화제가 된 키워드를 시도해보세요." },
        { status: 400 },
      );
    }

    // 3. Claude Haiku로 내러티브 생성
    const eventsDigest = cascade.events
      .map(
        (e) =>
          `- [${e.platform}] ${e.date} (검색 급등 대비 ${e.lag > 0 ? "+" : ""}${e.lag}일): ${e.title}`,
      )
      .join("\n");

    const patternLabel =
      cascade.pattern === "youtube-first"
        ? "유튜브가 먼저 → 뉴스 → 검색"
        : cascade.pattern === "news-first"
          ? "뉴스가 먼저 → 검색"
          : cascade.pattern === "simultaneous"
            ? "유튜브와 뉴스가 동시에 → 검색"
            : "검색에서만 급등";

    const prompt = `당신은 한국어 미디어 확산 분석 전문가입니다. 초등학생도 이해할 수 있는 쉬운 한국어로 답하세요.

키워드: "${keyword}"
검색 급등일: ${cascade.spikePeak}
확산 패턴: ${patternLabel}

타임라인:
${eventsDigest}

## 지시사항
위 데이터를 바탕으로 "${keyword}"가 어떻게 사람들 사이에 퍼졌는지 이야기해주세요.
- 어떤 플랫폼에서 먼저 화제가 되었고, 이후 다른 플랫폼으로 어떻게 퍼졌는지
- 이 확산 패턴이 의미하는 것은 무엇인지

JSON으로 답하세요:
{
  "narrative": "2~3문장의 이야기 형식 설명",
  "insight": "한 문장으로 된 핵심 인사이트"
}`;

    const resp = await claude().messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (resp.content[0] as { text: string }).text;

    let aiResult: { narrative: string; insight: string };

    try {
      aiResult = parseAiJson<typeof aiResult>(raw);
    } catch (parseErr) {
      console.error("[lab/cascade] JSON 파싱 실패:", (parseErr as Error).message);
      return NextResponse.json({ error: "AI 분석 결과를 해석하지 못했습니다. 다시 시도해주세요." }, { status: 500 });
    }

    const response = {
      keyword,
      cascade,
      narrative: aiResult.narrative,
      insight: aiResult.insight,
      xOpinions: xOpinions ?? undefined,
      meta: {
        newsCount: news.length,
        videoCount: videos.length,
        trendDays: trend.length,
        xAvailable: !!xOpinions,
      },
    };
    setCache("lab-cascade", keyword, response);
    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("[lab/cascade]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
