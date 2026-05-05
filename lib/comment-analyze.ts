// 댓글 텍스트에서 키워드를 직접 추출 + 빈도 카운팅.
// 조사·어미 제거 + 어간 정규화 + 같은 어간 병합.

// 조사 접미사 — 긴 것부터 시도 (순서 중요)
const JOSA = [
  "에서는", "으로는", "에서도", "으로도", "이라는", "이라고", "이라서",
  "에서", "으로", "에게", "한테", "까지", "부터", "보다", "처럼", "만큼", "밖에",
  "은", "는", "이", "가", "을", "를", "의", "에", "로", "도", "만",
  "와", "과", "며", "고", "서", "라", "요",
];

// 어미 접미사
const EOMI = [
  "하기", "하면", "하는", "하고", "해서", "했다", "한다", "합니다",
  "되기", "되면", "되는", "되고", "됩니다",
  "있는", "없는", "있다", "없다",
  "인데", "는데", "은데", "지만", "거든", "니까",
  "네요", "에요", "해요", "죠", "다고", "라고",
];

function stripSuffix(word: string): string {
  // 어미 먼저 (더 긴 패턴)
  for (const s of EOMI) {
    if (word.endsWith(s) && word.length - s.length >= 2) return word.slice(0, -s.length);
  }
  // 조사
  for (const s of JOSA) {
    if (word.endsWith(s) && word.length - s.length >= 2) return word.slice(0, -s.length);
  }
  return word;
}

const STOPWORDS = new Set([
  // 기능어·접속사·부사
  "있으면", "없으면", "그리고", "그런데", "하지만", "그래서", "그러면",
  "진짜", "정말", "완전", "그냥", "너무", "아주", "매우", "약간", "조금",
  "이런", "저런", "그런", "어떤", "무슨", "이거", "저거", "그거",
  "오늘", "내일", "어제", "요즘", "지금", "다음", "이번", "이제",
  "우리", "저희", "자기", "본인", "여러분", "나는", "저는",
  "하나", "혼자", "모두", "전부", "아니", "아니라", "없는데",
  // 유튜브 상용어
  "영상", "댓글", "구독", "알림", "채널", "유튜브", "좋아요",
  "다들", "사람", "정도", "때문", "경우", "부분",
  "ㅋㅋ", "ㅎㅎ", "ㅠㅠ", "ㅜㅜ", "ㄷㄷ", "ㅇㅇ",
  // 일반 동사/형용사 잔재
  "있다", "없다", "하다", "되다", "같다", "보다", "가다", "오다",
  "좋겠다", "싶다", "알다", "모르다",
  // 관형/의존
  "것", "거", "수", "줄", "때", "곳", "뿐",
]);

const POS_WORDS = new Set([
  "좋다", "최고", "대박", "인기", "사랑", "추천", "감동", "행복", "축하",
  "멋지", "예쁘", "귀엽", "기대", "응원", "화이팅", "훌륭", "미쳤",
  "감사", "고마", "좋아", "최애", "레전드", "존경", "재밌", "재미",
]);

const NEG_WORDS = new Set([
  "별로", "싫다", "실망", "논란", "문제", "불만", "짜증", "화나",
  "걱정", "불안", "힘들", "아쉬", "안타깝", "슬프", "우울",
  "비싼", "불편", "최악", "쓰레기", "거짓",
]);

export interface CommentKeyword {
  keyword: string;
  count: number;
  sentiment: "positive" | "negative" | "neutral";
}

export interface CommentAnalysisResult {
  topKeywords: CommentKeyword[];
  sentimentDist: { positive: number; negative: number; neutral: number };
  totalComments: number;
  avgLength: number;
}

export function analyzeComments(comments: Array<{ text: string; likeCount?: number }>): CommentAnalysisResult {
  const counts = new Map<string, number>();
  let posCount = 0, negCount = 0, neuCount = 0, totalLen = 0;

  for (const c of comments) {
    const text = c.text || "";
    totalLen += text.length;

    const hasPos = [...POS_WORDS].some((w) => text.includes(w));
    const hasNeg = [...NEG_WORDS].some((w) => text.includes(w));
    if (hasPos && !hasNeg) posCount++;
    else if (hasNeg && !hasPos) negCount++;
    else neuCount++;

    // 한글 2-10글자 토큰 추출 → 조사/어미 제거 → 정규화
    const tokens = text.match(/[가-힣]{2,10}/g) ?? [];
    for (const raw of tokens) {
      const stripped = stripSuffix(raw);
      if (stripped.length < 2) continue;
      if (STOPWORDS.has(stripped)) continue;
      if (STOPWORDS.has(raw)) continue;
      counts.set(stripped, (counts.get(stripped) ?? 0) + 1);
    }
  }

  // 빈도 3 이상만 + 내림차순 + 감정 태깅
  const sorted = Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([keyword, count]) => {
      let sentiment: "positive" | "negative" | "neutral" = "neutral";
      if ([...POS_WORDS].some((w) => keyword.includes(w))) sentiment = "positive";
      else if ([...NEG_WORDS].some((w) => keyword.includes(w))) sentiment = "negative";
      return { keyword, count, sentiment };
    });

  const total = Math.max(posCount + negCount + neuCount, 1);

  return {
    topKeywords: sorted,
    sentimentDist: {
      positive: Math.round((posCount / total) * 100),
      negative: Math.round((negCount / total) * 100),
      neutral: Math.round((neuCount / total) * 100),
    },
    totalComments: comments.length,
    avgLength: comments.length > 0 ? Math.round(totalLen / comments.length) : 0,
  };
}
