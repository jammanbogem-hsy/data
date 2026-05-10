import { NextResponse } from "next/server";
import { searchNaverNews } from "@/lib/providers/naver";
import { collectVideosAndComments } from "@/lib/providers/youtube";
import { fetchAutoComplete } from "@/lib/providers/naver-ad";
import { fetchXOpinions } from "@/lib/providers/grok";
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

    const cached = getCache<object>("social-interpret", keyword);
    if (cached) return NextResponse.json(cached);

    // 병렬 데이터 수집 (Grok X 여론 포함)
    const [news, yt, autocomplete, xOpinions] = await Promise.all([
      searchNaverNews(keyword, 40).catch(() => []),
      collectVideosAndComments(keyword, 6, 15).catch(() => ({ videos: [], comments: [] })),
      fetchAutoComplete(keyword, 10).catch(() => []),
      fetchXOpinions(keyword).catch(() => null),
    ]);

    const newsDigest = news
      .slice(0, 25)
      .map((n) => `- ${n.title} (${n.description?.slice(0, 80) ?? ""})`)
      .join("\n");

    const commentDigest = yt.comments
      .filter((c) => c.text.length >= 10)
      .slice(0, 15)
      .map((c) => `- ${c.text.slice(0, 100)}`)
      .join("\n");

    const acDigest = autocomplete.length > 0
      ? `사람들이 함께 검색하는 것: ${autocomplete.join(", ")}`
      : "";

    // X/Twitter 실시간 반응 (참고용 — 전체 여론을 대표하지 않음)
    const xDigest = xOpinions
      ? `X(Twitter) 실시간 반응 (참고용):\n${xOpinions.overview}\n주요 담론:\n${xOpinions.reactions.map((r) => `- [${r.sentiment}] ${r.theme}: ${r.summary}`).join("\n")}\n뉴스와의 온도 차이: ${xOpinions.gap}`
      : "";

    const prompt = `AI 사회학자로서 "${keyword}" 키워드를 둘러싼 사회 현상을 해석하세요.
쉬운 한국어, 따뜻한 시선으로 작성. JSON만 출력하세요.

뉴스(${news.length}건):
${newsDigest || "(없음)"}

댓글(${yt.comments.length}건):
${commentDigest || "(없음)"}

${acDigest}

${xDigest}

아래 JSON 형식으로만 답하세요. 설명 텍스트 없이 JSON만:
{"interpretation":"왜 사람들이 이것에 관심을 갖는가, 사회 분위기는 무엇인가를 3~5문장으로 해석","mood":{"title":"사회 분위기 제목","signals":["분위기1","분위기2","분위기3"]},"hearts":{"title":"사람들의 마음 제목","desires":["심리1","심리2","심리3"]},"changes":{"title":"변화 신호 제목","signals":["변화1","변화2","변화3"]},"labBriefings":[{"lab":"intent","title":"검색 의도 브리핑 제목","briefing":"이 키워드를 검색한 사람들의 의도를 2~3문장으로 미리보기"},{"lab":"social-graph","title":"사회 연결망 브리핑 제목","briefing":"이 키워드의 사회적 연결 관계 미리보기"},{"lab":"cascade","title":"유행 확산 브리핑 제목","briefing":"유행 확산 경로 미리보기"},{"lab":"sequential","title":"반복 패턴 브리핑 제목","briefing":"반복 패턴 미리보기"},{"lab":"markov","title":"관심 이동 브리핑 제목","briefing":"관심 이동 흐름 미리보기"},{"lab":"emotion","title":"감정 흐름 브리핑 제목","briefing":"감정 변화 흐름 미리보기"}]}`;

    const resp = await claude().messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (resp.content[0] as { text: string }).text;

    let result: {
      interpretation: string;
      mood: { title: string; signals: string[] };
      hearts: { title: string; desires: string[] };
      changes: { title: string; signals: string[] };
      labBriefings: Array<{ lab: string; title: string; briefing: string }>;
    };

    try {
      result = parseAiJson<typeof result>(raw);
    } catch (parseErr) {
      console.error("[lab/social-interpret] JSON 파싱 실패:", (parseErr as Error).message, "raw:", raw.slice(0, 500));
      // 폴백: raw 텍스트를 해석으로 사용
      result = {
        interpretation: raw.replace(/[{}[\]"]/g, "").slice(0, 500),
        mood: { title: "분석 중", signals: ["데이터 수집 완료", "패턴 분석 진행 중", "재시도를 권장합니다"] },
        hearts: { title: "사람들의 관심", desires: ["이 키워드에 대한 관심 증가", "다양한 맥락에서 검색", "사회적 관심 반영"] },
        changes: { title: "변화 감지", signals: ["검색량 변동 감지", "뉴스 보도 증가", "댓글 반응 활발"] },
        labBriefings: [
          { lab: "intent", title: "검색 의도", briefing: "사람들이 왜 이 키워드를 검색하는지 확인해보세요." },
          { lab: "emotion", title: "감정 흐름", briefing: "시간에 따른 감정 변화를 확인해보세요." },
          { lab: "cascade", title: "유행 확산", briefing: "어느 플랫폼에서 먼저 화제가 되었는지 확인해보세요." },
          { lab: "sequential", title: "반복 패턴", briefing: "매년 반복되는 패턴이 있는지 확인해보세요." },
          { lab: "markov", title: "관심 이동", briefing: "관심이 어디로 이동하는지 확인해보세요." },
          { lab: "social-graph", title: "사회 연결망", briefing: "어떤 사회 현상과 연결되는지 확인해보세요." },
        ],
      };
    }

    const response = {
      keyword,
      ...result,
      xOpinions: xOpinions ?? undefined,
      meta: {
        newsCount: news.length,
        commentCount: yt.comments.length,
        videoCount: yt.videos.length,
        xAvailable: !!xOpinions,
      },
    };
    setCache("social-interpret", keyword, response);
    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("[lab/social-interpret]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
