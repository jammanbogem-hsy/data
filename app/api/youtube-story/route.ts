import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { title, channelTitle, summary, keywords, sentiment, videoPosition } = await req.json();

    if (!summary) return NextResponse.json({ error: "분석 데이터 필요" }, { status: 400 });

    const keywordList = (keywords ?? []).slice(0, 10).map((k: any) => k.keyword ?? k).join(", ");
    const posLabel = videoPosition?.positive >= 60 ? "긍정적" : videoPosition?.negative >= 40 ? "부정적" : "중립적";

    const prompt = `당신은 초등학교 5-6학년 학생이 읽을 수 있는 쉬운 글을 쓰는 작가입니다.

아래 YouTube 영상 분석 결과를 바탕으로 학생용 읽기 자료를 한글과 영어로 작성하세요.

## 영상 정보
- 제목: ${title}
- 채널: ${channelTitle}
- AI 요약: ${summary}
- 핵심 키워드: ${keywordList}
- 전체 분위기: ${posLabel}
${sentiment?.summary ? `- 댓글 반응: ${sentiment.summary}` : ""}

## 출력 JSON
{
  "korean": "한글 이야기 본문",
  "englishEasy": "쉬운 영어 (초등 3-4학년, 기초 단어만, 짧은 문장 3-5 words, 현재형 위주)",
  "englishNormal": "보통 영어 (초등 5-6학년, CEFR A2-B1, 다양한 시제 OK)",
  "koreanTitle": "한글 제목",
  "englishTitle": "English Title"
}

핵심 작성 규칙:
1. **하나의 이어지는 스토리로** 써주세요. 분절된 섹션(##, ### 등)이 아니라 자연스럽게 흐르는 글.
2. **마크다운 기호 절대 금지** — #, ##, **, -, * 같은 기호를 쓰지 마세요. 순수한 글만.
3. 문단은 빈 줄(\\n\\n)로만 구분. 소제목 없이 문단의 첫 문장이 자연스럽게 주제를 전환.
4. 500-800자 (한글), 300-500 words (영어).
5. 존댓말 해요체. 어려운 단어는 괄호로 쉬운 뜻 설명.
6. 마치 선생님이 학생 앞에서 이야기하듯 친근하고 흥미롭게.
7. 데이터 마이닝 관점: "사람들이 이 영상을 보고 어떤 마음이었는지" 자연스럽게 녹이기.
8. 글 마지막에 "여러분은 어떻게 생각하나요?" 식 질문 2개를 문단 속에 자연스럽게.
9. englishEasy: 초등 3-4학년 수준. I, you, he, she 주어 + 현재형 위주. 한 문장 3-7 단어. big/small/good/bad 같은 기초 단어만. 200-300 words.
   englishNormal: 초등 5-6학년 수준 CEFR A2-B1. 과거형, 접속사 OK. 좀 더 풍부한 표현. 300-500 words.
10. JSON만 출력. 코드펜스 없이.`;

    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const resp = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
    let cleaned = raw;
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    const story = JSON.parse(cleaned);
    return NextResponse.json(story);
  } catch (e: unknown) {
    console.error("[youtube-story]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
