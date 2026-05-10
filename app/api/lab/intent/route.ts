import { NextResponse } from "next/server";
import { searchNaverNews } from "@/lib/providers/naver";
import { collectVideosAndComments } from "@/lib/providers/youtube";
import { fetchAutoComplete } from "@/lib/providers/naver-ad";
import { fetchXOpinions } from "@/lib/providers/grok";
import { buildIntentClusters } from "@/lib/lab/intent-cluster";
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

    const cached = getCache<object>("lab-intent", keyword);
    if (cached) return NextResponse.json(cached);

    // 1. 병렬 데이터 수집 (X 여론 포함)
    const [news, yt, autocomplete, xOpinions] = await Promise.all([
      searchNaverNews(keyword, 30).catch(() => []),
      collectVideosAndComments(keyword, 6, 15).catch(() => ({ videos: [], comments: [] })),
      fetchAutoComplete(keyword, 15).catch(() => []),
      fetchXOpinions(keyword).catch(() => null),
    ]);

    // 2. 텍스트 문서 구성 (X 여론 포함)
    const docs = [
      ...news.map((n) => ({ text: `${n.title} ${n.description ?? ""}`, source: "news" as const })),
      ...yt.comments.map((c) => ({ text: c.text, source: "comment" as const })),
      ...autocomplete.map((ac) => ({ text: ac, source: "autocomplete" as const })),
      ...(xOpinions?.reactions ?? []).flatMap((r) => r.samplePosts.map((p) => ({ text: p, source: "comment" as const }))),
    ];

    if (docs.length < 5) {
      return NextResponse.json({ error: "데이터가 부족합니다. 다른 키워드를 시도해보세요." }, { status: 400 });
    }

    // 3. 클러스터링
    const { clusters, topKeywords } = buildIntentClusters(docs, keyword, 6);

    // 4. Claude 의도 해석
    const clusterDigest = clusters.length > 0
      ? clusters.map((c, i) =>
          `클러스터 ${i + 1}: [${c.keywords.join(", ")}]\n  샘플: ${c.sampleTexts.slice(0, 2).join(" / ")}`
        ).join("\n")
      : `주요 키워드: ${topKeywords.slice(0, 15).map((k) => k.word).join(", ")}`;

    const acDigest = autocomplete.length > 0
      ? `\n\n자동완성 검색어: ${autocomplete.join(", ")}`
      : "";

    const prompt = `당신은 한국어 검색 의도 분석 전문가입니다. 초등학교 선생님과 학생이 이해할 수 있는 쉬운 한국어로 답하세요.

키워드: "${keyword}"

이 키워드를 검색한 사람들의 뉴스, 댓글, 자동완성에서 아래 키워드 그룹이 발견되었습니다:

${clusterDigest}${acDigest}

## 지시사항
사람들이 "${keyword}"를 검색한 **의도(이유)**를 3~5개 그룹으로 분류하세요.

각 의도 그룹에 대해:
- name: 짧은 이름 (예: "야식 주문", "가격 비교")
- description: 한 문장 설명
- keywords: 관련 키워드 3~5개
- percentage: 추정 비율 (합계 100)

JSON으로 답하세요:
{
  "intents": [
    { "name": "...", "description": "...", "keywords": ["..."], "percentage": 30 },
    ...
  ],
  "summary": "전체 검색 의도를 한 문장으로 요약"
}`;

    const resp = await claude().messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (resp.content[0] as { text: string }).text;

    let intentResult: {
      intents: Array<{ name: string; description: string; keywords: string[]; percentage: number }>;
      summary: string;
    };

    try {
      intentResult = parseAiJson<typeof intentResult>(raw);
    } catch (parseErr) {
      console.error("[lab/intent] JSON 파싱 실패:", (parseErr as Error).message);
      return NextResponse.json({ error: "AI 분석 결과를 해석하지 못했습니다. 다시 시도해주세요." }, { status: 500 });
    }

    const response = {
      keyword,
      intents: intentResult.intents,
      summary: intentResult.summary,
      clusters,
      topKeywords,
      autocomplete,
      xOpinions: xOpinions ?? undefined,
      meta: {
        newsCount: news.length,
        commentCount: yt.comments.length,
        autocompleteCount: autocomplete.length,
        xAvailable: !!xOpinions,
      },
    };
    setCache("lab-intent", keyword, response);
    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("[lab/intent]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
