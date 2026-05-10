import { NextResponse } from "next/server";
import { fetchDataLabTrend } from "@/lib/providers/naver";
import { fetchXOpinions } from "@/lib/providers/grok";
import { analyzeSequentialPatterns } from "@/lib/lab/sequential-pattern";
import { claude, CLAUDE_HAIKU } from "@/lib/providers/claude";
import { parseAiJson } from "@/lib/lab/parse-ai-json";
import { getCache, setCache } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 30;

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(req: Request) {
  try {
    const { keyword } = (await req.json()) as { keyword: string };
    if (!keyword || keyword.length < 1 || keyword.length > 40) {
      return NextResponse.json({ error: "키워드를 입력해주세요." }, { status: 400 });
    }

    const cached = getCache<object>("lab-sequential", keyword);
    if (cached) return NextResponse.json(cached);

    // 3년 전부터 오늘까지
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 3);

    const [trend, xOpinions] = await Promise.all([
      fetchDataLabTrend(
        keyword,
        formatDate(startDate),
        formatDate(endDate),
        "week"
      ),
      fetchXOpinions(keyword).catch(() => null),
    ]);

    if (trend.length < 10) {
      return NextResponse.json(
        { error: "트렌드 데이터가 부족합니다. 다른 키워드를 시도해보세요." },
        { status: 400 }
      );
    }

    // 패턴 분석
    const result = analyzeSequentialPatterns(trend);

    // Claude 해석
    const patternDigest = result.patterns.length > 0
      ? result.patterns
          .map(
            (p) =>
              `- ${p.seasonLabel}(${p.months.map((m) => `${m}월`).join(", ")}): 반복 연도=${p.years.join(",")}, 평균 강도=${p.avgIntensity}, 일관성=${Math.round(p.consistency * 100)}%`
          )
          .join("\n")
      : "뚜렷한 반복 패턴이 발견되지 않음";

    const yearSeriesDigest = result.yearSeries
      .map(
        (ys) =>
          `${ys.year}년: ${ys.data.map((d) => `${d.month}월(${d.avg})`).join(", ")}`
      )
      .join("\n");

    const prompt = `당신은 한국어 사회 현상 분석 전문가입니다. 초등학교 선생님과 학생이 이해할 수 있는 쉬운 한국어로 답하세요.

키워드: "${keyword}"
분석 기간: 최근 3년

## 연도별 월간 검색량 (상대값)
${yearSeriesDigest}

## 발견된 반복 패턴
${patternDigest}

## 지시사항
이 데이터를 보고, "${keyword}"에 대한 사회적 반복 패턴을 설명해주세요.
- 왜 매년 같은 시기에 검색이 증가하는지 이유를 추론하세요.
- 일상생활/사회 현상과 연결지어 설명하세요.

JSON으로 답하세요:
{
  "patterns": [
    { "season": "여름", "description": "매년 7-8월에 검색이 증가하는데, 이는 ..." }
  ],
  "narrative": "전체 패턴을 한 문단으로 종합 설명 (3-4문장)"
}`;

    const resp = await claude().messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (resp.content[0] as { text: string }).text;

    let interpretation: {
      patterns: Array<{ season: string; description: string }>;
      narrative: string;
    };

    try {
      interpretation = parseAiJson<typeof interpretation>(raw);
    } catch (parseErr) {
      console.error("[lab/sequential] JSON 파싱 실패:", (parseErr as Error).message);
      return NextResponse.json({ error: "AI 분석 결과를 해석하지 못했습니다. 다시 시도해주세요." }, { status: 500 });
    }

    const response = {
      keyword,
      yearlyPeaks: result.yearlyPeaks,
      patterns: result.patterns,
      yearSeries: result.yearSeries,
      interpretation,
      xOpinions: xOpinions ?? undefined,
      meta: {
        xAvailable: !!xOpinions,
      },
    };
    setCache("lab-sequential", keyword, response);
    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("[lab/sequential]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
