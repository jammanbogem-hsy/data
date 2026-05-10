import { NextResponse } from "next/server";
import { searchNaverNews } from "@/lib/providers/naver";
import { collectVideosAndComments } from "@/lib/providers/youtube";
import { fetchXOpinions } from "@/lib/providers/grok";
import { buildEmotionBuckets } from "@/lib/lab/emotion-trajectory";
import { claude, CLAUDE_HAIKU } from "@/lib/providers/claude";
import { parseAiJson } from "@/lib/lab/parse-ai-json";
import { getCache, setCache } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: Request) {
  try {
    const { keyword } = (await req.json()) as { keyword: string };
    if (!keyword || keyword.length < 1 || keyword.length > 40) {
      return NextResponse.json({ error: "키워드를 입력해주세요." }, { status: 400 });
    }

    const cached = getCache<object>("lab-emotion", keyword);
    if (cached) return NextResponse.json(cached);

    // 1. 병렬 데이터 수집
    const [news, yt, xOpinions] = await Promise.all([
      searchNaverNews(keyword, 50).catch(() => []),
      collectVideosAndComments(keyword, 6, 15).catch(() => ({ videos: [], comments: [] })),
      fetchXOpinions(keyword).catch(() => null),
    ]);

    if (news.length + yt.comments.length < 3) {
      return NextResponse.json({ error: "데이터가 부족합니다. 다른 키워드를 시도해보세요." }, { status: 400 });
    }

    // 2. 최근 90일 범위 설정
    const now = new Date();
    const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const endDateStr = now.toISOString().slice(0, 10);
    const startDateStr = startDate.toISOString().slice(0, 10);

    // 3. 감정 버킷 생성
    const buckets = buildEmotionBuckets(
      news,
      yt.comments,
      startDateStr,
      endDateStr,
      5
    );

    // 4. Claude 감정 분류
    const bucketDigest = buckets.map((b, i) => {
      const sentimentSummary = `긍정${b.localSentiment.positive} 부정${b.localSentiment.negative} 중립${b.localSentiment.neutral}`;
      const sampleTexts = b.texts.length > 0
        ? b.texts.map((t) => `  - "${t.slice(0, 80)}"`).join("\n")
        : "  (텍스트 없음)";
      return `[${b.label}] ${b.startDate}~${b.endDate} (로컬감정: ${sentimentSummary})\n${sampleTexts}`;
    }).join("\n\n");

    const prompt = `당신은 한국 대중 감정 변화를 분석하는 전문가입니다. 초등학교 선생님과 학생이 이해할 수 있는 쉬운 한국어로 답하세요.

키워드: "${keyword}"

최근 90일간 뉴스와 댓글을 5개 시기로 나눈 결과입니다:

${bucketDigest}

## 지시사항
각 시기별 대중의 **감정**을 아래 8가지 중에서 분류하세요:
기대, 흥분, 걱정, 피곤, 만족, 실망, 무관심, 분노

각 시기별로:
1. 감정 비율을 백분율로 배분 (합계 100)
2. 가장 강한 감정(dominantEmotion)을 선정
3. 대표 인용문(quote)을 선택하거나 생성

그리고:
- 감정 변화의 전체 스토리(arc)를 2~3문장으로
- 감정이 크게 바뀐 "전환점"(turningPoint)을 한 문장으로

JSON으로만 답하세요:
{
  "timeline": [
    { "period": "4월 초", "dominantEmotion": "기대", "emotions": {"기대": 40, "흥분": 30, "걱정": 20, "무관심": 10}, "quote": "대표 인용문" }
  ],
  "arc": "감정 변화 스토리 2~3문장",
  "turningPoint": "전환점 설명"
}`;

    const resp = await claude().messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (resp.content[0] as { text: string }).text;

    let emotionResult: {
      timeline: Array<{
        period: string;
        dominantEmotion: string;
        emotions: Record<string, number>;
        quote: string;
      }>;
      arc: string;
      turningPoint: string;
    };

    try {
      emotionResult = parseAiJson<typeof emotionResult>(raw);
    } catch (parseErr) {
      console.error("[lab/emotion] JSON 파싱 실패:", (parseErr as Error).message);
      return NextResponse.json({ error: "AI 분석 결과를 해석하지 못했습니다. 다시 시도해주세요." }, { status: 500 });
    }

    const response = {
      keyword,
      ...emotionResult,
      xOpinions: xOpinions ?? undefined,
      meta: {
        newsCount: news.length,
        commentCount: yt.comments.length,
        xAvailable: !!xOpinions,
        buckets: buckets.map((b) => ({
          label: b.label,
          startDate: b.startDate,
          endDate: b.endDate,
          localSentiment: b.localSentiment,
        })),
      },
    };
    setCache("lab-emotion", keyword, response);
    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("[lab/emotion]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
