import { NextResponse } from "next/server";
import { fetchAutoComplete } from "@/lib/providers/naver-ad";
import { fetchDataLabTrendMulti } from "@/lib/providers/naver";
import { fetchXOpinions } from "@/lib/providers/grok";
import { buildMarkovChain } from "@/lib/lab/markov";
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

    const cached = getCache<object>("lab-markov", keyword);
    if (cached) return NextResponse.json(cached);

    // 1. 연관 키워드 탐색 (자동완성) + X 여론 병렬 수집
    const [suggestions, xOpinions] = await Promise.all([
      fetchAutoComplete(keyword, 10),
      fetchXOpinions(keyword).catch(() => null),
    ]);

    // 2. 상위 4개 선택 (단순 접미사 키워드 필터)
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
    const kwNorm = norm(keyword);
    const filtered = suggestions.filter((s) => {
      const sNorm = norm(s);
      // keyword + 1~2글자 접미사인 것은 제외 (예: "치킨집", "치킨배달")
      if (sNorm.startsWith(kwNorm) && sNorm.length - kwNorm.length <= 2) return false;
      if (sNorm.endsWith(kwNorm) && sNorm.length - kwNorm.length <= 2) return false;
      return true;
    });
    const relatedKeywords = filtered.slice(0, 4);

    if (relatedKeywords.length < 2) {
      return NextResponse.json(
        { error: "연관 키워드가 부족합니다. 다른 키워드를 시도해보세요." },
        { status: 400 }
      );
    }

    // 3. DataLab 다중 키워드 트렌드 (90일)
    const allKeywords = [keyword, ...relatedKeywords];
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const trendData = await fetchDataLabTrendMulti(allKeywords, startDate, endDate, "date");

    if (trendData.length < 2) {
      return NextResponse.json(
        { error: "트렌드 데이터가 부족합니다. 다른 키워드를 시도해보세요." },
        { status: 400 }
      );
    }

    // 4. Markov Chain 구축
    const seriesInput = trendData.map((t) => ({
      keyword: t.keyword,
      data: t.series,
    }));

    const markovResult = buildMarkovChain(keyword, seriesInput);

    // 5. Claude 해석
    const chainStr = markovResult.chain.join(" → ");
    const transitionsStr = markovResult.transitions
      .filter((t) => t.probability > 0.1)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10)
      .map((t) => `${t.from} → ${t.to} (${t.lagDays}일 후, 상관 ${t.correlation.toFixed(2)})`)
      .join("\n");

    const prompt = `당신은 한국어 트렌드 분석 전문가입니다. 초등학교 선생님과 학생도 이해할 수 있는 쉬운 한국어로 답하세요.

키워드 "${keyword}"에서 시작해 대중의 관심이 어떻게 이동하는지 분석했습니다.

관심 이동 체인: ${chainStr}

주요 전이:
${transitionsStr}

## 지시사항
위 데이터를 바탕으로 대중의 관심이 어떻게 한 주제에서 다른 주제로 흘러가는지 이야기로 설명해주세요.

JSON으로 답하세요:
{
  "story": "관심 이동 흐름을 2~3문장으로 자연스럽게 설명",
  "insight": "이 이동 패턴에서 발견할 수 있는 의미있는 인사이트 1문장"
}`;

    const resp = await claude().messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (resp.content[0] as { text: string }).text;

    let claudeResult: { story: string; insight: string };

    try {
      claudeResult = parseAiJson<typeof claudeResult>(raw);
    } catch (parseErr) {
      console.error("[lab/markov] JSON 파싱 실패:", (parseErr as Error).message);
      return NextResponse.json({ error: "AI 분석 결과를 해석하지 못했습니다. 다시 시도해주세요." }, { status: 500 });
    }

    const response = {
      keyword,
      relatedKeywords,
      chain: markovResult.chain,
      transitions: markovResult.transitions,
      story: claudeResult.story,
      insight: claudeResult.insight,
      xOpinions: xOpinions ?? undefined,
      meta: {
        xAvailable: !!xOpinions,
      },
    };
    setCache("lab-markov", keyword, response);
    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("[lab/markov]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
