import { NextResponse } from "next/server";
import { searchNaverNews } from "@/lib/providers/naver";
import { fetchAutoComplete, getKeywordInsight } from "@/lib/providers/naver-ad";
import { claude, CLAUDE_HAIKU } from "@/lib/providers/claude";
import { fetchXOpinions } from "@/lib/providers/grok";
import { buildSocialGraph } from "@/lib/lab/social-graph";
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

    const cached = getCache<object>("lab-social-graph", keyword);
    if (cached) return NextResponse.json(cached);

    // 1. 병렬 데이터 수집
    const [news, autocomplete, insight, xOpinions] = await Promise.all([
      searchNaverNews(keyword, 50).catch(() => []),
      fetchAutoComplete(keyword, 15).catch(() => []),
      getKeywordInsight(keyword, 15).catch(() => null),
      fetchXOpinions(keyword).catch(() => null),
    ]);

    // 연관 키워드 추출
    const relatedKeywords = insight?.relatedKeywords?.map((r) => r.relKeyword) ?? [];
    const seedKeywords = [...autocomplete, ...relatedKeywords];

    // 2. 텍스트 문서 구성
    const texts = [
      ...news.map((n) => `${n.title} ${n.description ?? ""}`),
      ...seedKeywords.map((kw) => kw), // seed도 단일 문서로 포함
    ];

    if (texts.length < 5) {
      return NextResponse.json({ error: "데이터가 부족합니다. 다른 키워드를 시도해보세요." }, { status: 400 });
    }

    // 3. 사회 현상 연결망 구축
    const graph = buildSocialGraph(texts, keyword, seedKeywords);

    if (graph.nodes.length < 2) {
      return NextResponse.json({ error: "연결망을 구성할 키워드가 부족합니다." }, { status: 400 });
    }

    // 4. Claude 사회 현상 해석
    const nodeDigest = graph.nodes.map((n) => `${n.label}(${n.count})`).join(", ");
    const edgeDigest = graph.edges
      .slice(0, 15)
      .map((e) => `${e.source}—${e.target}(PMI:${e.pmi})`)
      .join(", ");

    const prompt = `당신은 한국 사회 현상 분석 전문가입니다. 초등학교 선생님과 학생이 이해할 수 있는 쉬운 한국어로 답하세요.

키워드: "${keyword}"

이 키워드의 뉴스·자동완성·연관어에서 동시출현 네트워크를 구축했습니다.

주요 노드(빈도): ${nodeDigest}
주요 연결(PMI): ${edgeDigest}

## 지시사항
이 키워드 연결망에서 보이는 **사회 현상(social phenomena)**을 3~5개 찾아주세요.

각 현상에 대해:
- name: 현상의 짧은 이름 (예: "건강 관심 증가", "가격 불안")
- keywords: 이 현상에 해당하는 키워드 2~4개 (위 노드에서 선택)
- description: 이 현상이 왜 사회적으로 중요한지 2~3문장으로 설명

그리고 전체를 연결하는 **내러티브(이야기)**를 한 문단(3~5문장)으로 작성하세요.
"${keyword}"을(를) 둘러싼 사회 현상들이 어떻게 서로 연결되는지 이야기하듯 설명합니다.

JSON으로 답하세요:
{
  "phenomena": [
    { "name": "...", "keywords": ["..."], "description": "..." }
  ],
  "narrative": "..."
}`;

    const resp = await claude().messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (resp.content[0] as { text: string }).text;

    let aiResult: {
      phenomena: Array<{ name: string; keywords: string[]; description: string }>;
      narrative: string;
    };

    try {
      aiResult = parseAiJson<typeof aiResult>(raw);
    } catch (parseErr) {
      console.error("[lab/social-graph] JSON 파싱 실패:", (parseErr as Error).message);
      return NextResponse.json({ error: "AI 분석 결과를 해석하지 못했습니다. 다시 시도해주세요." }, { status: 500 });
    }

    const response = {
      keyword,
      graph,
      phenomena: aiResult.phenomena,
      narrative: aiResult.narrative,
      news: news.slice(0, 50).map((n) => ({ title: n.title, description: n.description, link: n.link, pubDate: n.pubDate })),
      xOpinions: xOpinions ?? undefined,
      meta: {
        newsCount: news.length,
        autocompleteCount: autocomplete.length,
        relatedCount: relatedKeywords.length,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        xAvailable: !!xOpinions,
      },
    };
    setCache("lab-social-graph", keyword, response);
    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("[lab/social-graph]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
