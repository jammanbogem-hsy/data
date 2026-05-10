/**
 * 감정 흐름 분석 — Emotion Trajectory
 * 뉴스/댓글을 시간 구간(버킷)별로 분류하고
 * 간단한 키워드 기반 감정 분석을 수행한다.
 */

export interface EmotionBucket {
  startDate: string;
  endDate: string;
  label: string; // "1월 초", "1월 말" etc
  texts: string[]; // sample texts for Claude
  localSentiment: { positive: number; negative: number; neutral: number };
}

// 긍정 키워드
const POSITIVE_WORDS = [
  "좋다", "좋아", "좋은", "최고", "훌륭", "대박", "멋지", "멋진", "감사",
  "행복", "기쁘", "기대", "흥미", "사랑", "응원", "성공", "축하", "만족",
  "편리", "감동", "뿌듯", "재밌", "재미있", "잘했", "잘된", "희망", "긍정",
  "발전", "개선", "환영", "칭찬", "놀라", "신기", "기분좋",
];

// 부정 키워드
const NEGATIVE_WORDS = [
  "싫다", "싫어", "최악", "별로", "실망", "화나", "짜증", "문제", "걱정",
  "불안", "위험", "안타", "슬프", "힘들", "어렵", "피곤", "지친", "분노",
  "비판", "논란", "사고", "피해", "불만", "혐오", "반대", "거부", "우려",
  "부정", "악화", "심각", "충격", "황당", "답답", "못하", "안되",
];

function analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
  let posCount = 0;
  let negCount = 0;
  for (const w of POSITIVE_WORDS) {
    if (text.includes(w)) posCount++;
  }
  for (const w of NEGATIVE_WORDS) {
    if (text.includes(w)) negCount++;
  }
  if (posCount > negCount) return "positive";
  if (negCount > posCount) return "negative";
  return "neutral";
}

/**
 * 월과 시기(초/중순/말)를 기반으로 라벨 생성
 */
function makeBucketLabel(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  let suffix: string;
  if (day <= 10) suffix = "초";
  else if (day <= 20) suffix = "중순";
  else suffix = "말";
  return `${month}월 ${suffix}`;
}

/**
 * 시간 범위를 bucketCount개의 동일한 기간으로 나누고
 * 뉴스/댓글을 해당 버킷에 분류한 뒤 간단한 감정 분석을 수행한다.
 */
export function buildEmotionBuckets(
  news: Array<{ title: string; description?: string; pubDate: string }>,
  comments: Array<{ text: string; publishedAt?: string }>,
  startDate: string,
  endDate: string,
  bucketCount = 5
): EmotionBucket[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalMs = end.getTime() - start.getTime();
  const bucketMs = totalMs / bucketCount;

  const buckets: EmotionBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bStart = new Date(start.getTime() + bucketMs * i);
    const bEnd = new Date(start.getTime() + bucketMs * (i + 1));

    // 라벨 — 버킷 시작일 기준
    const label = makeBucketLabel(bStart);

    buckets.push({
      startDate: bStart.toISOString().slice(0, 10),
      endDate: bEnd.toISOString().slice(0, 10),
      label,
      texts: [],
      localSentiment: { positive: 0, negative: 0, neutral: 0 },
    });
  }

  // 뉴스 분류
  for (const item of news) {
    if (!item.pubDate) continue;
    const d = new Date(item.pubDate);
    if (isNaN(d.getTime())) continue;
    const idx = Math.min(
      Math.floor((d.getTime() - start.getTime()) / bucketMs),
      bucketCount - 1
    );
    if (idx < 0) continue;
    const text = `${item.title} ${item.description ?? ""}`.trim();
    if (text) {
      const bucket = buckets[idx];
      if (bucket.texts.length < 5) bucket.texts.push(text);
      const s = analyzeSentiment(text);
      bucket.localSentiment[s]++;
    }
  }

  // 댓글 분류
  for (const c of comments) {
    if (!c.publishedAt) continue;
    const d = new Date(c.publishedAt);
    if (isNaN(d.getTime())) continue;
    const idx = Math.min(
      Math.floor((d.getTime() - start.getTime()) / bucketMs),
      bucketCount - 1
    );
    if (idx < 0) continue;
    if (c.text) {
      const bucket = buckets[idx];
      if (bucket.texts.length < 5) bucket.texts.push(c.text);
      const s = analyzeSentiment(c.text);
      bucket.localSentiment[s]++;
    }
  }

  return buckets;
}
