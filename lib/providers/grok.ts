/**
 * xAI (Grok) API — X/Twitter 실시간 반응 수집
 *
 * Grok은 실시간 X 데이터에 접근 가능.
 * 직접 트윗을 반환하지는 않지만, X에서의 반응을 요약·분석할 수 있다.
 *
 * 주의: X는 전체 사회 여론을 대표하지 않음.
 * "실시간 담론 감지 센서"로 활용하며, 참고 자료로만 제공.
 */

const XAI_BASE = "https://api.x.ai/v1";

function apiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY가 설정되지 않았습니다");
  return key;
}

export interface XReaction {
  theme: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  summary: string;
  samplePosts: string[];
}

export interface XOpinionResult {
  keyword: string;
  overview: string;
  reactions: XReaction[];
  dominantSentiment: string;
  gap: string;
}

/**
 * Grok에게 특정 키워드에 대한 X/Twitter 반응을 요약 요청.
 */
export async function fetchXOpinions(keyword: string): Promise<XOpinionResult | null> {
  try {
    const resp = await fetch(`${XAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [
          {
            role: "system",
            content: `당신은 X(Twitter) 실시간 반응 분석가입니다. 사용자가 키워드를 주면, 최근 X/Twitter에서 해당 키워드에 대한 반응과 담론을 분석해주세요.
주의: X 반응은 전체 사회 여론을 대표하지 않습니다. 빠르게 확산되는 실시간 담론과 감정 흐름을 관찰하는 것이 목적입니다.
한국어 게시글 중심으로 분석하되, 영어 게시글도 포함하세요.
반드시 JSON만 출력하세요.`,
          },
          {
            role: "user",
            content: `키워드: "${keyword}"

최근 X/Twitter에서 이 키워드에 대한 반응을 분석해주세요.

JSON으로만 답하세요:
{"overview":"X에서 관찰된 주요 반응 2~3문장 (여론이 아닌 반응/담론 관점으로)","reactions":[{"theme":"반응 주제","sentiment":"positive|negative|neutral|mixed","summary":"이 주제의 반응 요약","samplePosts":["실제 게시글 느낌의 예시 1","예시 2"]}],"dominantSentiment":"전반적 감정 한 단어","gap":"뉴스 보도와 X 반응 사이 온도 차이 1~2문장"}`,
          },
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[grok] HTTP ${resp.status}: ${body.slice(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    const { parseAiJson } = await import("@/lib/lab/parse-ai-json");
    const parsed = parseAiJson<Omit<XOpinionResult, "keyword">>(raw);

    return { keyword, ...parsed };
  } catch (e) {
    console.error("[grok] X 반응 수집 실패:", e);
    return null;
  }
}
