import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function claude(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
}

export const CLAUDE_HAIKU = "claude-haiku-4-5-20251001";

export interface Hypothesis {
  title: string;
  reasoning: string;
  evidence: string[]; // 인용 url 또는 short quote
  confidence: "high" | "medium" | "low";
}

export interface RelatedKeyword {
  keyword: string;
  category: string;
  strength: "strong" | "medium" | "weak";
  sentiment: "positive" | "negative" | "neutral";
  context: string;
}

export interface InsightResult {
  hypotheses: Hypothesis[];
  summary: string;
  mindset: string;
  relatedKeywords?: RelatedKeyword[];
}

/**
 * 뉴스·댓글·트렌드를 Claude 에게 던져서 가설 + 인사이트 추출.
 */
export async function investigateWithClaude(opts: {
  keyword: string;
  newsHeadlines: Array<{ title: string; description: string; link: string; pubDate: string }>;
  videos: Array<{ title: string; description: string; channelTitle: string; viewCount: number }>;
  comments: Array<{ text: string; likeCount: number }>;
  trend?: Array<{ period: string; ratio: number }>;
}): Promise<InsightResult> {
  const { keyword, newsHeadlines, videos, comments, trend } = opts;

  // 양을 다루기 좋게 압축
  // 네이버:YouTube 텍스트 비율 약 7:3 유지 (네이버 40, 영상 6, 댓글 10 × 길이 조절)
  const newsDigest = newsHeadlines
    .slice(0, 40)
    .map((n, i) => `[N${i + 1}] ${n.title} — ${n.description.slice(0, 130)}`)
    .join("\n");

  const videoDigest = videos
    .slice(0, 6)
    .map(
      (v, i) =>
        `[V${i + 1}] (${v.viewCount.toLocaleString()}회) ${v.title} — ${v.channelTitle}`
    )
    .join("\n");

  const commentDigest = comments
    .filter((c) => c.text.length >= 15)
    .slice(0, 10)
    .map((c, i) => `[C${i + 1}] (👍${c.likeCount}) ${c.text.slice(0, 150)}`)
    .join("\n");

  const trendDigest = trend && trend.length > 0
    ? `최근 검색 트렌드(상대치 0-100):\n${trend.slice(-30).map((p) => `${p.period}: ${p.ratio}`).join(", ")}`
    : "(검색 트렌드 데이터 없음)";

  const prompt = `당신은 한국어 소셜 데이터 분석관입니다. 주어진 키워드가 왜 지금 주목받고 있는지 뉴스·유튜브 영상·댓글·검색 트렌드를 근거로 조사하세요.

🎯 **근거 가중치**: 네이버 뉴스·블로그 = 주 근거 (70%), YouTube 영상·댓글 = 보조 (30%).
- 가설 reasoning에서 [N#] 인용이 [V#]+[C#] 합보다 2배 이상 많도록
- YouTube는 "대중 반응"의 예시 수준으로만 활용, 핵심 인과는 뉴스·블로그에서 찾기

키워드: "${keyword}"

${trendDigest}

## 네이버 뉴스·블로그 (${newsHeadlines.length}건) — 주 근거
${newsDigest || "(없음)"}

## 유튜브 영상 (${videos.length}건) — 보조
${videoDigest || "(없음)"}

## 유튜브 댓글 (${comments.length}건) — 보조
${commentDigest || "(없음)"}

## 요구 출력 (JSON)
{
  "hypotheses": [
    { "title": "가설 제목 (15자 내외)", "reasoning": "왜 이 가설인지 2-3문장", "evidence": ["[N3]", "[V1]", "원문 짧은 인용"], "confidence": "high|medium|low" },
    ...총 3개
  ],
  "summary": "종합 인사이트 2-4문장. 여러 가설을 엮어 큰 그림 설명.",
  "mindset": "사람들이 지금 어떤 마음으로 이 키워드를 검색하고 소비하는지 1-2문장",
  "relatedKeywords": [
    { "keyword": "연관어", "category": "인물|제품|장소|이벤트|감정|브랜드|기타", "strength": "strong|medium|weak", "sentiment": "positive|negative|neutral", "context": "왜 관련되는지 5자 이내" },
    ... 15-20개 (다양한 카테고리로)
  ]
}

규칙:
- 반드시 JSON 만 출력 (코드펜스 없이)
- 가설은 구체적이고 검증 가능해야 함 (예: "인플루언서 X의 영상 업로드", "기온 급상승으로 시즌성 수요", "신제품 출시 이벤트")
- evidence 에는 반드시 [N#], [V#], [C#] 라벨을 넣어 어느 근거에서 왔는지 표시
- relatedKeywords: 뉴스·영상·댓글에서 자주 등장하거나 키워드와 의미적으로 연관된 것. 인물·브랜드·제품·장소·감정·이벤트 카테고리 다양하게. 주 키워드 자체는 제외.`;

  const resp = await claude().messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 3500, // relatedKeywords 20개 포함
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (resp.content[0] as any).text?.trim() ?? "";
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned) as InsightResult;
  } catch {
    throw new Error(`Claude JSON 파싱 실패: ${cleaned.slice(0, 300)}`);
  }
}

// ─── 단일 가설 심화 (인터랙티브 마이닝) ──────────────────────────

export interface DeepenedHypothesis {
  refined: Hypothesis;
  rationale: string; // 왜 confidence를 올리거나 내렸는지
  queries: string[]; // 검증에 사용한 쿼리
}

export async function deepenSingleHypothesis(opts: {
  keyword: string;
  hypothesis: Hypothesis;
  verifyEvidence: Array<{ query: string; news: Array<{ title: string; description: string; pubDate: string }> }>;
}): Promise<DeepenedHypothesis> {
  const { keyword, hypothesis, verifyEvidence } = opts;

  const evDigest = verifyEvidence
    .map((v, i) => {
      const ns = v.news
        .slice(0, 8)
        .map((n, j) => `  [E${i + 1}-${j + 1}] (${n.pubDate?.slice(0, 10)}) ${n.title} — ${n.description.slice(0, 100)}`)
        .join("\n");
      return `## 쿼리 "${v.query}" (${v.news.length}건)\n${ns || "  (결과 없음)"}`;
    })
    .join("\n\n");

  const prompt = `당신은 한국어 마이닝 분석관입니다. 아래 **단일 가설**을 더 깊이 검증하고 refine 하세요.

주 키워드: "${keyword}"

## 초기 가설
제목: ${hypothesis.title}
내용: ${hypothesis.reasoning}
기존 confidence: ${hypothesis.confidence}

## 검증 수집 결과
${evDigest}

## 출력 JSON (반드시 이 구조)
{
  "refined": {
    "title": "업데이트된 가설 제목 (기존 유지 or 보완)",
    "reasoning": "추가 근거 반영한 2-4문장, 반드시 [E#-#] 인용",
    "evidence": ["[E1-3]", "[E2-1]"],
    "confidence": "high|medium|low"
  },
  "rationale": "왜 confidence를 올렸는지/내렸는지/유지했는지 1-2문장"
}

규칙:
- 검증 근거가 강하면 confidence=high로 상승
- 근거가 반박하면 confidence=low + reasoning에 반박 요소 명시
- JSON만 출력`;

  const resp = await claude().messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const data = JSON.parse(cleaned);
    return {
      refined: data.refined,
      rationale: data.rationale,
      queries: verifyEvidence.map((v) => v.query),
    };
  } catch {
    throw new Error(`Claude(deepen) JSON 파싱 실패: ${cleaned.slice(0, 300)}`);
  }
}

// ─── 감정 시계열 (피크 전/중/후 감정 변화) ─────────────────────────

export interface SentimentBucket {
  label: string; // "T-7" | "T" | "T+7"
  dateRange: string; // "2025-09-29 ~ 2025-10-05"
  itemCount: number;
  positive: number; // 0-100 %
  negative: number;
  neutral: number;
  dominantNote: string; // 한 줄 요약
  voiceQuotes?: Array<{
    text: string; // 원문 인용 (60자 내)
    source: "news" | "blog" | "comment"; // 출처 유형
    sourceLabel: string; // "[N3]" 등 입력 라벨
    sentiment: "positive" | "negative" | "neutral";
  }>;
}

export interface SentimentTimeline {
  buckets: SentimentBucket[];
  narrative: string; // 전체 흐름 요약 2-3문장
}

export async function sentimentTimelineWithClaude(opts: {
  keyword: string;
  peakDay: string;
  buckets: Array<{
    label: string;
    dateRange: string;
    headlines: string[]; // 이 구간 네이버 뉴스/블로그 제목 (최대 15개)
    excerpts?: string[]; // 블로그/뉴스 description 발췌 (VoC용, 최대 8개)
    comments?: Array<{ text: string; likeCount: number }>; // YouTube 댓글 (VoC용, 최대 8개)
  }>;
}): Promise<SentimentTimeline> {
  const { keyword, peakDay, buckets } = opts;

  const bucketDigest = buckets
    .map((b) => {
      const hs = b.headlines.slice(0, 12).map((h, i) => `  [N${i + 1}] ${h}`).join("\n");
      const ex = (b.excerpts ?? []).slice(0, 6).map((e, i) => `  [B${i + 1}] ${e.slice(0, 130)}`).join("\n");
      const cm = (b.comments ?? [])
        .filter((c) => c.text.length >= 12)
        .slice(0, 6)
        .map((c, i) => `  [C${i + 1}] (👍${c.likeCount}) ${c.text.slice(0, 140)}`)
        .join("\n");
      const sections = [
        `### 뉴스/블로그 제목\n${hs || "  (없음)"}`,
        ex ? `### 블로그 본문 발췌\n${ex}` : "",
        cm ? `### 댓글\n${cm}` : "",
      ].filter(Boolean).join("\n");
      const totalCount = b.headlines.length + (b.excerpts?.length ?? 0) + (b.comments?.length ?? 0);
      return `## ${b.label} (${b.dateRange}) — 총 ${totalCount}건\n${sections}`;
    })
    .join("\n\n");

  const prompt = `당신은 한국어 감정 분석관입니다. 키워드 "${keyword}"의 피크일 ${peakDay} 전·중·후 3구간 소셜 데이터를 분석해 각 구간 감정 분포를 계산하고, **사람들의 실제 목소리(VoC)**를 인용하세요.

${bucketDigest}

## 출력 JSON
{
  "buckets": [
    {
      "label": "T-7",
      "dateRange": "입력 그대로",
      "itemCount": 해당 구간 제목/본문/댓글 총 개수,
      "positive": 0-100 %,
      "negative": 0-100 %,
      "neutral": 0-100 %,
      "dominantNote": "이 구간의 감정/주제 한 줄 요약",
      "voiceQuotes": [
        { "text": "원문 그대로 (60자 내)", "source": "news|blog|comment", "sourceLabel": "[N3] 또는 [B1] 또는 [C2]", "sentiment": "positive|negative|neutral" }
      ]
    }
    ... 모든 입력 버킷
  ],
  "narrative": "피크 전 → 피크 → 피크 후의 감정 변화 흐름 2-3문장"
}

규칙:
- positive + negative + neutral = 100 (반올림 오차 OK)
- voiceQuotes: 각 버킷에서 그 구간의 정서를 가장 잘 대변하는 **실제 원문** 2-3개 (없으면 빈 배열). 긍정/부정/중립이 섞여 있으면 다양성 있게 골라라.
- 제목/본문/댓글 라벨(N#, B#, C#)을 sourceLabel에 정확히 넣어라.
- **창작 절대 금지**: voiceQuotes.text는 반드시 입력으로 준 원문 그대로 (길면 앞쪽 60자 발췌 OK).
- JSON만 출력, 코드펜스 금지`;

  const resp = await claude().messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 2200,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned) as SentimentTimeline;
  } catch {
    throw new Error(`Claude(sentiment-timeline) JSON 파싱 실패: ${cleaned.slice(0, 300)}`);
  }
}

// ─── 2-step 에이전트 체인: 가설 → 검증 쿼리 → 재수집 → 가설 refine ──

export interface HypothesisVerifyPlan {
  hypothesisTitle: string;
  verifyQueries: string[]; // 이 가설을 검증하기 위한 네이버 추가 검색어 1-3개
}

/**
 * 초기 가설들을 보고 각각을 **검증할 수 있는 네이버 검색 쿼리** 제안.
 */
export async function planHypothesisVerification(
  keyword: string,
  hypotheses: Hypothesis[]
): Promise<HypothesisVerifyPlan[]> {
  const digest = hypotheses
    .map((h, i) => `[H${i + 1}] ${h.title} (${h.confidence}): ${h.reasoning}`)
    .join("\n");

  const prompt = `당신은 데이터 조사관입니다. 아래 가설들을 검증하기 위해 네이버 뉴스·블로그에서 추가 검색할 **구체적 쿼리**를 제안하세요.

주 키워드: "${keyword}"

## 현재 가설
${digest}

## 출력 JSON
{
  "plans": [
    {
      "hypothesisTitle": "가설 제목 그대로",
      "verifyQueries": ["구체적 검증 쿼리 1", "쿼리 2"]
    }
    ... 모든 가설에 대해
  ]
}

쿼리 작성 규칙:
- 각 가설당 1-2개 쿼리 (고유명사·사건·인물·상품명이 있으면 그것 활용)
- 주 키워드와 연결: "${keyword} + 구체적 엔티티"
- 예: 가설이 "BTS 컴백"이면 쿼리는 "BTS 컴백 싱글", "방탄소년단 앨범 발매"
- JSON만 출력 (코드펜스 없이)`;

  const resp = await claude().messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const data = JSON.parse(cleaned);
    return (data.plans ?? []) as HypothesisVerifyPlan[];
  } catch {
    return [];
  }
}

/**
 * 추가 수집된 근거를 바탕으로 가설을 refine.
 * 기존 가설의 confidence를 재평가하고 근거를 보강.
 */
export async function refineHypothesesWithClaude(opts: {
  keyword: string;
  initialHypotheses: Hypothesis[];
  verificationEvidence: Array<{
    hypothesisTitle: string;
    query: string;
    news: Array<{ title: string; description: string; pubDate: string }>;
  }>;
}): Promise<InsightResult> {
  const { keyword, initialHypotheses, verificationEvidence } = opts;

  const hypoDigest = initialHypotheses
    .map((h, i) => `[H${i + 1}] ${h.title} (${h.confidence}): ${h.reasoning}`)
    .join("\n");

  const evidenceDigest = verificationEvidence
    .map((v, i) => {
      const newsStr = v.news
        .slice(0, 6)
        .map((n, j) => `  [E${i + 1}-${j + 1}] (${n.pubDate?.slice(0, 10)}) ${n.title} — ${n.description.slice(0, 100)}`)
        .join("\n");
      return `## 가설 "${v.hypothesisTitle}" 검증 (쿼리: "${v.query}")\n${newsStr || "  (결과 없음)"}`;
    })
    .join("\n\n");

  const prompt = `당신은 한국어 데이터 분석관입니다. 초기 가설 + 각 가설의 검증용 추가 수집 결과를 보고 **가설을 refine**하세요.

주 키워드: "${keyword}"

## 초기 가설
${hypoDigest}

## 각 가설별 검증 수집 결과
${evidenceDigest}

## 출력 JSON
{
  "hypotheses": [
    {
      "title": "가설 제목 (refine 됐으면 업데이트)",
      "reasoning": "2-3문장, 반드시 [E#-#] 형식으로 검증 근거 인용, 근거가 강하면 confidence up",
      "evidence": ["[E1-3]", "[E2-1]"],
      "confidence": "high|medium|low"
    }
    ... 가설 3개
  ],
  "summary": "2-step 검증 후 종합 인사이트 2-4문장",
  "mindset": "사람들이 지금 어떤 마음으로 검색하는지 1-2문장"
}

규칙:
- 검증 근거가 강한 가설은 confidence=high로 올리고, 반대면 low로 내림
- 새 가설이 추가로 필요하면 기존 중 하나와 교체 (최대 3개 유지)
- JSON만 출력`;

  const resp = await claude().messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned) as InsightResult;
  } catch {
    throw new Error(`Claude(refine) JSON 파싱 실패: ${cleaned.slice(0, 300)}`);
  }
}

// ─── 다중 키워드 비교 분석 ──────────────────────────────────────────────

export interface ComparisonInsight {
  summary: string; // 2~4문장 종합
  peakComparison: Array<{
    keyword: string;
    peakPeriod: string; // "2025-07-15" 형식
    peakRatio: number;
    avgRatio: number;
    dominantSeason: string; // "여름" | "겨울" | "봄" | "가을" | "연중" | "없음"
  }>;
  commonThemes: string[]; // 공통 주제 3-5개
  differences: Array<{ aspect: string; description: string }>; // 차이 차원 3-4개
  recommendation: string; // 어떤 상황에 어느 쪽이 더 맞는가 한 줄
}

function simpleStats(series: Array<{ period: string; ratio: number }>) {
  if (!series || series.length === 0) return { peak: { period: "", ratio: 0 }, avg: 0 };
  let peak = series[0];
  let sum = 0;
  for (const p of series) {
    sum += p.ratio;
    if (p.ratio > peak.ratio) peak = p;
  }
  return { peak, avg: sum / series.length };
}

export async function compareKeywordsWithClaude(opts: {
  keywords: string[];
  multiTrend: Array<{ keyword: string; series: Array<{ period: string; ratio: number }> }>;
  perKeywordNews?: Array<{ keyword: string; titles: string[] }>;
}): Promise<ComparisonInsight> {
  const { keywords, multiTrend, perKeywordNews = [] } = opts;

  // 각 키워드 통계 요약
  const statsDigest = multiTrend
    .map((t) => {
      const s = simpleStats(t.series);
      return `- ${t.keyword}: 평균 ${s.avg.toFixed(1)}, 최고 ${s.peak.ratio}(${s.peak.period})`;
    })
    .join("\n");

  const newsDigest = perKeywordNews
    .map((n) => `## ${n.keyword} 관련 뉴스 헤드라인 (${n.titles.length})\n${n.titles.slice(0, 8).map((t, i) => `  [${n.keyword}-N${i + 1}] ${t}`).join("\n")}`)
    .join("\n\n");

  const prompt = `당신은 한국어 데이터 비교 분석관입니다. 여러 키워드의 네이버 검색 트렌드 시계열을 비교해 공통점·차이점을 정리하세요.

## 키워드 (${keywords.length}개)
${keywords.map((k, i) => `${i === 0 ? "(주)" : "(비교)"} ${k}`).join(" | ")}

## 트렌드 통계 (기간 내 ratio 0-100 정규화)
${statsDigest}

${newsDigest ? `## 참고 뉴스\n${newsDigest}\n` : ""}

## 출력 JSON (반드시 이 구조)
{
  "summary": "키워드들 간의 핵심 비교 2-4문장. 누가 더 크고, 언제 역전되는지 등",
  "peakComparison": [
    { "keyword": "이름", "peakPeriod": "YYYY-MM-DD", "peakRatio": 숫자, "avgRatio": 숫자, "dominantSeason": "여름|겨울|봄|가을|연중|없음" }
  ],
  "commonThemes": ["공통점 3~5개", "예: 둘 다 여름 수요"],
  "differences": [
    { "aspect": "계절성", "description": "구체 차이 한 줄" },
    { "aspect": "소비자층", "description": "..." },
    { "aspect": "가격·프로모션", "description": "..." }
  ],
  "recommendation": "어떤 상황/때에 어느 쪽이 더 적합한지 한 줄"
}

규칙:
- JSON만 출력 (코드펜스 없이)
- peakComparison은 입력 키워드 전원 포함, 통계값 정확히 반영
- differences는 관측 가능한 근거 있는 것만, 추측이면 "추측" 표시
- 한국어로 작성`;

  const resp = await claude().messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned) as ComparisonInsight;
  } catch {
    throw new Error(`Claude(compare) JSON 파싱 실패: ${cleaned.slice(0, 300)}`);
  }
}

// ─── 급등 구간 한정 분석 ─────────────────────────────────────────────────

export interface SpikeInsight {
  hypotheses: Hypothesis[];
  summary: string;
  topKeywords: string[]; // 이 구간에 자주 언급된 핵심 키워드 5~8개
  topComments: Array<{ text: string; likeCount: number; reason: string }>; // 가장 시사적인 댓글 3~5개
  /** 전날(D-1) 발생한 사건 (근거 인용) */
  prevDayEvents?: Array<{ event: string; evidence: string }>;
  /** 당일(D) 발생한 사건 (근거 인용) */
  sameDayEvents?: Array<{ event: string; evidence: string }>;
}

function isWithin(d: string, start: string, end: string): boolean {
  // d, start, end 모두 ISO date 비슷한 string. 문자열 비교로 충분.
  return d >= start && d <= end;
}

export async function spikeInsightWithClaude(opts: {
  keyword: string;
  spike: { startPeriod: string; endPeriod: string; peakPeriod: string; peakRatio: number; multiplier: number };
  newsHeadlines: Array<{ title: string; description: string; link: string; pubDate: string }>;
  videos: Array<{ title: string; description: string; channelTitle: string; viewCount: number; publishedAt?: string }>;
  comments: Array<{ text: string; likeCount: number; publishedAt?: string }>;
  contextHints?: {
    peakDay: string;
    weekday: string;
    seasonal: string[];
    monthHint: string;
  };
}): Promise<SpikeInsight> {
  const { keyword, spike, newsHeadlines, videos, comments, contextHints } = opts;

  // 피크 **당일 ±1일**만 대상. 넓은 기간 분석 금지 (교안의 "전날·당일 사건" 취지)
  const peakDay = spike.peakPeriod.slice(0, 10);
  const prev = new Date(peakDay);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(peakDay);
  next.setDate(next.getDate() + 1);
  const prevDay = prev.toISOString().slice(0, 10);
  const nextDay = next.toISOString().slice(0, 10);

  const koDate = (s: string) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${parseInt(m[2], 10)}월 ${parseInt(m[3], 10)}일` : s;
  };

  // 네이버 비중 확대: ±3일로 약간 넓게 + 최대 40개
  const wideLo = new Date(peakDay);
  wideLo.setDate(wideLo.getDate() - 3);
  const wideHi = new Date(peakDay);
  wideHi.setDate(wideHi.getDate() + 3);
  const wideLoStr = wideLo.toISOString().slice(0, 10);
  const wideHiStr = wideHi.toISOString().slice(0, 10);

  const inWindowNews = newsHeadlines.filter((n) => {
    const d = (n.pubDate ?? "").slice(0, 10);
    return d && isWithin(d, wideLoStr, wideHiStr);
  });
  // 시즌 맥락 기사가 섞여 있으면 그것도 포함 (seasonal 키워드 매칭)
  const seasonal = contextHints?.seasonal ?? [];
  const seasonalPattern = seasonal.length > 0 ? new RegExp(seasonal.join("|"), "i") : null;
  const seasonalNews = seasonalPattern
    ? newsHeadlines
        .filter((n) => seasonalPattern.test(n.title) || seasonalPattern.test(n.description))
        .filter((n) => !inWindowNews.find((w) => w.link === n.link))
        .slice(0, 10)
    : [];
  const newsForPrompt = [...inWindowNews, ...seasonalNews].slice(0, 40);
  const newsDigest = newsForPrompt
    .map((n, i) => `[N${i + 1}] (${n.pubDate?.slice(0, 10) ?? ""}) ${n.title} — ${n.description.slice(0, 120)}`)
    .join("\n");

  const inWindowVideos = videos.filter((v) => {
    const d = (v.publishedAt ?? "").slice(0, 10);
    return d && isWithin(d, prevDay, nextDay);
  });
  const videosForPrompt = inWindowVideos.length > 0 ? inWindowVideos : videos.slice(0, 5);
  const videoDigest = videosForPrompt
    .slice(0, 10)
    .map(
      (v, i) =>
        `[V${i + 1}] (${v.publishedAt?.slice(0, 10) ?? "?"} · ${v.viewCount.toLocaleString()}회) ${v.title} — ${v.channelTitle}`
    )
    .join("\n");

  const inWindowComments = comments.filter((c) => {
    const d = (c.publishedAt ?? "").slice(0, 10);
    return d && isWithin(d, prevDay, nextDay);
  });
  const commentsForPrompt = (inWindowComments.length > 0 ? inWindowComments : comments).filter(
    (c) => c.text.length >= 12
  );
  const commentDigest = commentsForPrompt
    .slice(0, 25)
    .map((c, i) => `[C${i + 1}] (${c.publishedAt?.slice(0, 10) ?? "?"} · 👍${c.likeCount}) ${c.text.slice(0, 200)}`)
    .join("\n");

  const contextLine = contextHints
    ? `\n\n📌 **맥락 힌트** (반드시 활용): ${peakDay}은 ${contextHints.weekday}요일.${
        contextHints.seasonal.length > 0
          ? ` 이 날짜는 한국 시즌/공휴일 "${contextHints.seasonal.join(", ")}"과 근접합니다.`
          : ""
      } 시즌 요인과 일회성 사건을 함께 고려하세요.`
    : "";

  const prompt = `당신은 한국어 데이터 분석관입니다. 키워드 "${keyword}"의 검색량이 **${peakDay} (${koDate(peakDay)})** 하루에 피크(ratio ${spike.peakRatio.toFixed(1)}, 평균의 ×${spike.multiplier.toFixed(1)})를 찍었습니다.${contextLine}

**임무**: 이 **하루의 이상치**의 원인을 **전날~당일(${prevDay}~${nextDay})** 발생한 사건 또는 **시즌 요인**으로 설명하세요. 네이버 뉴스·블로그를 **주 근거**로 삼고, YouTube는 보조로만.

## 네이버 뉴스·블로그 (${newsForPrompt.length}건) — 주 근거
${newsDigest || "(해당 날짜 범위 내 뉴스 없음)"}

## YouTube 영상 (${videosForPrompt.length}건) — 보조
${videoDigest || "(없음)"}

## 댓글 (${commentsForPrompt.length}건) — 보조
${commentDigest || "(없음)"}

## 출력 JSON (반드시 이 구조)
{
  "hypotheses": [
    { "title": "하루의 원인 (15자 내)", "reasoning": "이 가설의 근거 2-3문장. 반드시 [N#]/[V#]/[C#] 인용, 날짜 명시", "evidence": ["[N3]"], "confidence": "high|medium|low" },
    ... 정확히 3개
  ],
  "summary": "이 하루에 무슨 일이 있었는지 2-3문장 요약",
  "prevDayEvents": [
    { "event": "전날(${prevDay}) 발생한 구체적 사건 한 줄", "evidence": "[N5] 또는 [V2] 라벨" }
  ],
  "sameDayEvents": [
    { "event": "당일(${peakDay}) 발생한 구체적 사건 한 줄", "evidence": "[N3] 또는 [C4] 라벨" }
  ],
  "topKeywords": ["근거에서 자주 등장한 5~8개, 키워드 자체(${keyword}) 제외"],
  "topComments": [
    { "text": "원문 그대로 (50자 내)", "likeCount": 좋아요수, "reason": "이 댓글이 왜 이 하루를 설명하는지 한 줄" }
  ]
}

엄격 규칙:
- 뉴스 근거는 날짜가 ${wideLoStr}~${wideHiStr} 범위 또는 시즌 키워드("${seasonal.join(", ")}") 매칭인 것만 사용
- YouTube/댓글은 보조 — 뉴스만으로 설명 가능하면 YouTube 인용 안 해도 됨
- 시즌/공휴일이 힌트로 주어지면 가설 중 최소 1개는 시즌 요인 포함
- prevDayEvents/sameDayEvents: 근거 있을 때만, 없으면 빈 배열
- topComments: 실제 원문만, 지어내지 말 것
- JSON 외 텍스트/코드펜스 금지`;

  // Prompt caching: 고정 시스템 프롬프트를 분리해 병렬 호출 시 90% input 비용 절감
  const resp = await claude().messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 2500,
    system: [
      {
        type: "text",
        text: SPIKE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      } as any,
    ] as any,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned) as SpikeInsight;
  } catch {
    throw new Error(`Claude(spike) JSON 파싱 실패: ${cleaned.slice(0, 300)}`);
  }
}

// 캐시 대상 시스템 프롬프트 — 2048+ tokens 확보로 Haiku 캐시 조건 충족.
// 병렬 호출 시 첫 write 이후 cache hit으로 input 비용 ~90% 절감.
const SPIKE_SYSTEM_PROMPT = `당신은 한국어 소셜·검색 데이터 분석 전문가입니다. 특정 키워드의 일일 검색량이 평소 대비 급등한 구간의 **원인**을 뉴스·블로그·YouTube·댓글·시즌 맥락을 근거로 추리하는 것이 당신의 임무입니다.

## 분석 철학
- 이상치는 **우연이 아니다**. 반드시 어떤 사건·맥락·트리거가 있습니다.
- 좋은 가설은 ① 구체적 엔티티(인물·상품·이벤트) ② 시점 근거 ③ 여러 소스 교차 확인 을 갖춘다.
- 일반적 계절성도 유효하지만, 한 날짜만 튄 경우엔 당일·전날 특정 사건을 우선 찾습니다.
- 표면적 상관관계를 인과로 비약하지 말고, 근거 부족 시 confidence=low로 정직하게 표시합니다.

## 근거 가중치 (매우 중요)
- 네이버 뉴스·블로그 = **주 근거 (70%)**. 팩트·수치·공식 발표.
- YouTube 영상 제목·채널 = **보조 (20%)**. 대중 관심의 신호.
- YouTube 댓글 = **보조 (10%)**. 정서적 힌트.
- 가설 reasoning 안의 [N#] 인용 수 > [V#]+[C#] 합 × 2 를 목표로 합니다.

## 가설 3개 구조 원칙
1. 가장 구체적이고 확증 가능한 가설을 #1로 배치합니다.
2. 서로 다른 축을 다룹니다 (인물/이벤트/시즌/정책/유행/신제품).
3. 각각 confidence를 정직하게 부여합니다: 강한 근거(high) / 정황 근거(medium) / 추측(low).
4. 한 가설에 여러 근거를 인용할 때는 가장 결정적인 것 3개까지만.

## 시즌/공휴일 맥락 규칙
- 힌트로 시즌/공휴일 키워드가 주어지면 가설 중 최소 1개는 그 시즌 요인을 포함합니다.
- 시즌 + 구체 사건 결합이 강력합니다 (예: "추석 연휴 + 아이돌 컴백 MV 공개").
- 복날·수능·선거일·명절처럼 반복되는 시즌 이벤트는 별도 언급할 가치가 있습니다.

## 한국 특수 맥락 (참고)
- 삼복(초·중·말복): 치킨·삼계탕 등 여름 보양식 급등.
- 수능 전후: 간식·찹쌀떡·엿·카페 등 입시 관련 수요.
- 추석·설: 명절 선물·한복·고속도로·여행·배달 음식.
- 아이돌 컴백 (보통 화·수 오후 6시): 음원·MV·굿즈 관련 폭증.
- 스포츠 빅경기 (K리그·KBO·월드컵): 치킨·맥주·TV·응원 용품.

## 출력 JSON 스키마 (엄격)
{
  "hypotheses": [
    {
      "title": "가설 제목 (15자 내외, 임팩트)",
      "reasoning": "2-3문장. 반드시 [N#]/[V#]/[C#] 인용. 구체 엔티티·수치 포함.",
      "evidence": ["[N3]", "[N7]", "[V1]"],
      "confidence": "high|medium|low"
    }
    // 정확히 3개
  ],
  "summary": "이 급등이 무엇 때문이었는지 종합 2-3문장",
  "prevDayEvents": [
    { "event": "전날(D-1) 발생한 구체적 사건 한 줄", "evidence": "[N5]" }
  ],
  "sameDayEvents": [
    { "event": "당일(D) 발생한 구체적 사건 한 줄", "evidence": "[N3]" }
  ],
  "topKeywords": ["근거에 자주 등장한 핵심 5-8개, 일반명사 위주, 주 키워드 제외"],
  "topComments": [
    { "text": "실제 댓글 원문 (지어내지 말 것, 50자 내)", "likeCount": 숫자, "reason": "이 댓글이 시사하는 바 한 줄" }
    // 3-5개
  ]
}

## 엄격 규칙
- 제공된 근거 날짜 범위 밖 사건은 인용하지 말 것.
- prevDayEvents / sameDayEvents 는 근거 있을 때만 채움, 없으면 빈 배열.
- topComments 는 실제 제공된 댓글 원문 그대로. 창작 절대 금지.
- JSON 외 텍스트·코드펜스·주석 금지. 첫 글자 { 마지막 } 여야 함.
- 한국어 작성. 고유명사는 원 표기 유지.
- 근거가 빈약해도 세 가설은 반드시 채움 (그럴 때 모두 confidence=low).

## 좋은/나쁜 가설 예시 (참고)
✅ 좋은 예:
{ "title": "한화 이글스 홈런쇼 후폭풍", "reasoning": "한화가 2025-07-30 16-5 대승을 거뒀다는 [N4] 기사와, 경기 직후 올라온 응원 영상 [V1]이 저녁 검색을 폭증시켰다. 댓글 [C3]도 '어제 경기 대박'으로 호응.", "evidence": ["[N4]", "[V1]", "[C3]"], "confidence": "high" }

❌ 나쁜 예 (피할 것):
{ "title": "여름이라 그런 듯", "reasoning": "여름이면 원래 오른다.", "evidence": [], "confidence": "low" }
— 구체성 0, 근거 0, 검증 불가능.`;

// ─── 연관어 그래프 (피크 구간 내 키워드 네트워크) ─────────────────────────

export interface RelatedKeywordsGraph {
  nodes: Array<{ id: string; weight: number; category?: string }>;
  edges: Array<{ a: string; b: string; weight: number }>;
  centerKeyword: string;
  commentary: string; // 이 네트워크가 의미하는 바 1-2문장
}

export async function relatedKeywordsGraphWithClaude(opts: {
  keyword: string;
  peakDay: string;
  newsTitles: string[];
  blogTitles: string[];
  commentTexts: string[];
}): Promise<RelatedKeywordsGraph> {
  const { keyword, peakDay, newsTitles, blogTitles, commentTexts } = opts;

  const newsDigest = newsTitles.slice(0, 25).map((t, i) => `  [N${i + 1}] ${t}`).join("\n");
  const blogDigest = blogTitles.slice(0, 15).map((t, i) => `  [B${i + 1}] ${t}`).join("\n");
  const commentDigest = commentTexts
    .filter((t) => t.length >= 10)
    .slice(0, 15)
    .map((t, i) => `  [C${i + 1}] ${t.slice(0, 120)}`)
    .join("\n");

  const prompt = `당신은 한국어 텍스트 네트워크 분석관입니다. 키워드 "${keyword}" (피크 ${peakDay}) 주변에서 수집한 텍스트에서 **연관어 네트워크**를 추출하세요.

## 뉴스 제목 (${newsTitles.length}건)
${newsDigest || "(없음)"}

## 블로그 제목 (${blogTitles.length}건)
${blogDigest || "(없음)"}

## 댓글 (${commentTexts.length}건)
${commentDigest || "(없음)"}

## 출력 JSON (엄격)
{
  "centerKeyword": "${keyword}",
  "nodes": [
    { "id": "핵심 연관어", "weight": 언급빈도 상대값 1-10, "category": "인물|제품|장소|사건|감정|기타" }
    ... 10~15개 (주 키워드 "${keyword}"는 제외)
  ],
  "edges": [
    { "a": "키워드1", "b": "키워드2", "weight": 1-10 }
    ... 같은 문장/제목에 함께 등장한 연관어 쌍. nodes에 있는 id만 연결. 15~25개
  ],
  "commentary": "이 네트워크가 시사하는 바 1-2문장 — 예: '주요 연관어는 [A]/[B]로 2그룹 분리, [A]는 인물 중심·[B]는 시즌 중심'"
}

규칙:
- nodes는 실제 텍스트에 등장한 **구체 명사** (일반어 '것', '수', '때' 같은 추상어 금지).
- edges는 반드시 **nodes 안의 id** 끼리만 연결.
- weight는 언급 빈도와 중요도를 반영한 정수 (1~10).
- category 값은 반드시 ["인물","제품","장소","사건","감정","기타"] 중 하나.
- 주 키워드 "${keyword}" 자체는 nodes에 포함하지 마세요 (센터는 암시적).
- JSON만 출력, 코드펜스 금지.`;

  const resp = await claude().messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const data = JSON.parse(cleaned);
    // 방어: edges가 nodes에 없는 id 참조하는 경우 제거
    const nodeIds = new Set((data.nodes ?? []).map((n: any) => n.id));
    const validEdges = (data.edges ?? []).filter((e: any) => nodeIds.has(e.a) && nodeIds.has(e.b));
    return {
      centerKeyword: data.centerKeyword ?? keyword,
      nodes: data.nodes ?? [],
      edges: validEdges,
      commentary: data.commentary ?? "",
    } as RelatedKeywordsGraph;
  } catch {
    throw new Error(`Claude(related-graph) JSON 파싱 실패: ${cleaned.slice(0, 300)}`);
  }
}

// ─── 커뮤니티별 반응 비교 (네이버 뉴스 vs 블로그 vs YouTube 댓글) ────────

export interface CommunityInsight {
  platform: "naver_news" | "naver_blog" | "youtube_comments";
  platformLabel: string; // "네이버 뉴스" 등
  sampleSize: number;
  sentiment: { positive: number; negative: number; neutral: number }; // 합 100
  dominantTone: string; // 플랫폼의 전반적 톤 한 줄
  keyTerms: string[]; // 해당 플랫폼에서 유독 튀는 워딩 5~8개
  representativeQuotes: Array<{ text: string; sentiment: "positive" | "negative" | "neutral" }>;
  uniqueAngle: string; // 다른 플랫폼과 다른 독특한 관점 한 줄
}

export interface CommunityComparison {
  platforms: CommunityInsight[];
  comparison: string; // 플랫폼 간 차이 종합 2-3문장
  divergence: "high" | "medium" | "low"; // 플랫폼 간 온도차
}

export async function communityComparisonWithClaude(opts: {
  keyword: string;
  news: Array<{ title: string; description: string }>;
  blogs: Array<{ title: string; description: string }>;
  comments: Array<{ text: string; likeCount: number }>;
}): Promise<CommunityComparison> {
  const { keyword, news, blogs, comments } = opts;

  const newsDigest = news
    .slice(0, 20)
    .map((n, i) => `  [NEWS-${i + 1}] ${n.title} — ${n.description.slice(0, 100)}`)
    .join("\n");
  const blogDigest = blogs
    .slice(0, 15)
    .map((b, i) => `  [BLOG-${i + 1}] ${b.title} — ${b.description.slice(0, 100)}`)
    .join("\n");
  const commentDigest = comments
    .filter((c) => c.text.length >= 15)
    .slice(0, 20)
    .map((c, i) => `  [YT-${i + 1}] (👍${c.likeCount}) ${c.text.slice(0, 140)}`)
    .join("\n");

  const prompt = `당신은 한국어 크로스-플랫폼 소셜 분석관입니다. 키워드 "${keyword}"에 대한 **3개 플랫폼**(네이버 뉴스, 네이버 블로그, YouTube 댓글)의 **반응 차이**를 분석하세요.

같은 주제라도 플랫폼마다 톤·관점·핵심 워딩이 다를 수 있습니다. 그 차이를 포착하는 것이 목표입니다.

## 📰 네이버 뉴스 (${news.length}건) — 언론사·공식 발표 톤
${newsDigest || "(없음)"}

## ✍️ 네이버 블로그 (${blogs.length}건) — 개인 후기·리뷰·정보 공유
${blogDigest || "(없음)"}

## 💬 YouTube 댓글 (${comments.length}건) — 실시간 대중 반응·감정
${commentDigest || "(없음)"}

## 출력 JSON
{
  "platforms": [
    {
      "platform": "naver_news",
      "platformLabel": "네이버 뉴스",
      "sampleSize": 분석한 개수,
      "sentiment": { "positive": 0-100, "negative": 0-100, "neutral": 0-100 },
      "dominantTone": "언론사들의 전반적 톤 한 줄 (예: '공식 발표 중심 중립적 보도')",
      "keyTerms": ["이 플랫폼에서 유독 많이 쓰인 워딩 5-8개"],
      "representativeQuotes": [
        { "text": "실제 원문 (60자 내)", "sentiment": "positive|negative|neutral" }
      ],
      "uniqueAngle": "다른 플랫폼과 달리 이 플랫폼만 강조한 관점 한 줄"
    },
    { "platform": "naver_blog", ... },
    { "platform": "youtube_comments", ... }
  ],
  "comparison": "세 플랫폼의 톤·관점 차이 종합 2-3문장. 누가 가장 부정/긍정인지, 누가 가장 깊이 다루는지 등.",
  "divergence": "high|medium|low"
}

규칙:
- 플랫폼이 빈 값(0건)이면 sentiment 모두 0, quotes 빈 배열, dominantTone="데이터 부족"
- representativeQuotes는 실제 원문만 (창작 금지)
- keyTerms는 일반어("것","수") 금지, 구체 명사 위주
- divergence: 플랫폼 간 sentiment/tone 차이 큰지 (high: 한쪽만 부정적 등)
- JSON만 출력, 코드펜스 금지`;

  const resp = await claude().messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (resp.content[0] as { text?: string }).text?.trim() ?? "";
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned) as CommunityComparison;
  } catch {
    throw new Error(`Claude(community) JSON 파싱 실패: ${cleaned.slice(0, 300)}`);
  }
}

