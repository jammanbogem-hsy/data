import { NextResponse } from "next/server";
import { fetchComments } from "@/lib/providers/youtube";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const YT_BASE = "https://www.googleapis.com/youtube/v3";

function extractVideoId(input: string): string | null {
  // youtu.be/xxx, youtube.com/watch?v=xxx, youtube.com/shorts/xxx 등
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.trim().match(p);
    if (m) return m[1];
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { videoUrl } = await req.json();
    if (!videoUrl) return NextResponse.json({ error: "유튜브 링크를 입력해주세요" }, { status: 400 });

    const videoId = extractVideoId(videoUrl);
    if (!videoId) return NextResponse.json({ error: "올바른 유튜브 링크가 아닙니다" }, { status: 400 });

    const key = process.env.YOUTUBE_API_KEY!;

    // 1. 영상 상세 정보
    const videoRes = await fetch(`${YT_BASE}/videos?part=snippet,statistics&id=${videoId}&key=${key}`);
    if (!videoRes.ok) throw new Error(`YouTube API 오류: ${videoRes.status}`);
    const videoData = await videoRes.json();
    const item = videoData.items?.[0];
    if (!item) return NextResponse.json({ error: "영상을 찾을 수 없습니다" }, { status: 404 });

    const video = {
      videoId,
      title: item.snippet.title,
      description: item.snippet.description?.slice(0, 1000) ?? "",
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      viewCount: Number(item.statistics.viewCount ?? 0),
      likeCount: Number(item.statistics.likeCount ?? 0),
      commentCount: Number(item.statistics.commentCount ?? 0),
      thumbnail: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? "",
      tags: (item.snippet.tags ?? []).slice(0, 15),
    };

    // 2. 댓글 수집 (페이지네이션으로 최대 300개)
    const comments = await fetchComments(videoId, 300).catch(() => []);

    // 3. Claude 분석
    const commentDigest = comments
      .filter((c) => c.text.length >= 5)
      .slice(0, 60)
      .map((c, i) => `[C${i + 1}] (좋아요 ${c.likeCount}) ${c.text.slice(0, 200)}`)
      .join("\n");

    const prompt = `당신은 YouTube 영상 분석 전문가입니다. 아래 영상의 내용을 요약하고, 감정 분석을 수행하세요.

## 영상 정보
- 제목: ${video.title}
- 채널: ${video.channelTitle}
- 조회수: ${video.viewCount.toLocaleString()}회
- 좋아요: ${video.likeCount.toLocaleString()}
- 설명: ${video.description.slice(0, 500)}
- 태그: ${video.tags.join(", ")}

## 댓글 ${comments.length}개 (상위 인기순)
${commentDigest || "(댓글 없음)"}

## 출력 JSON
{
  "summary": "영상 내용 요약 3-5문장. 영상이 무엇에 대한 것인지, 핵심 메시지는 무엇인지.",
  "videoPosition": {
    "positive": 0-100,
    "negative": 0-100,
    "neutral": 0-100,
    "reasoning": "이 영상이 왜 이런 포지션인지 1-2문장"
  },
  "commentSentiment": {
    "positive": 0-100,
    "negative": 0-100,
    "neutral": 0-100,
    "summary": "댓글의 전반적 분위기 1-2문장"
  },
  "topKeywords": [
    { "keyword": "의미있는 명사/형용사", "count": 실제등장횟수, "sentiment": "positive|negative|neutral", "emotion": "기대|감동|분노|실망|유머|응원|궁금|기타" },
    ... 20-25개 (실제 댓글에 3번 이상 등장한 것만, 불용어·조사·어미 제외)
  ],
  "notableComments": [
    { "index": 1, "text": "원문 50자 이내", "likeCount": 숫자, "sentiment": "positive|negative|neutral", "insight": "이 댓글이 시사하는 바 한 줄" },
    ... 5개
  ]
}

규칙:
- positive + negative + neutral = 100 (videoPosition과 commentSentiment 각각)
- topKeywords는 댓글에서 자주 등장하는 명사·형용사 위주
- notableComments는 [C#] 인덱스 참조, 실제 원문만
- JSON만 출력`;

    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const resp = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
    let cleaned = raw;
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: `AI 분석 파싱 실패: ${cleaned.slice(0, 200)}` }, { status: 500 });
    }

    return NextResponse.json({
      video,
      analysis,
      commentsCollected: comments.length,
      // 프론트에서 직접 빈도 분석할 수 있도록 원문 포함
      rawComments: comments.slice(0, 100).map((c) => ({
        text: c.text,
        likeCount: c.likeCount,
      })),
    });
  } catch (e: unknown) {
    console.error("[youtube-analyze]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
