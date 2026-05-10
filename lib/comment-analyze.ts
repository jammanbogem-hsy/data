// 댓글 텍스트에서 키워드를 직접 추출 + 빈도 카운팅.
// 조사·어미 제거 + 어간 정규화 + 같은 어간 병합.

// 조사 접미사 — 긴 것부터 시도 (순서 중요)
const JOSA = [
  // 4음절 이상
  "에서부터", "으로부터", "에서만은", "이라고는",
  // 3음절
  "에서는", "으로는", "에서도", "으로도", "이라는", "이라고", "이라서",
  "만으로", "까지는", "부터는", "보다는", "에게는", "한테는", "처럼은",
  "만큼은", "에게서", "로서는", "로써는", "이든지", "이라도",
  // 2음절
  "에서", "으로", "에게", "한테", "까지", "부터", "보다", "처럼", "만큼", "밖에",
  "로서", "로써", "마저", "조차", "이나", "이든", "라도", "대로", "같이",
  "마다", "에는", "에도", "에만", "으론",
  // 1음절
  "은", "는", "이", "가", "을", "를", "의", "에", "로", "도", "만",
  "와", "과", "며", "고", "서", "라", "요", "야", "든",
];

// 어미 접미사
const EOMI = [
  // 4음절+
  "했습니다", "겠습니다", "하겠다", "했었다",
  // 3음절
  "합니다", "됩니다", "습니다", "십시오", "하네요", "하더라", "한다면",
  "했으면", "하려면", "해야지", "해볼까", "인것같", "하겠지",
  // 2음절 — 하다류
  "하기", "하면", "하는", "하고", "해서", "했다", "한다", "하자",
  "하지", "해도", "해야", "하며", "했는", "할까", "해봐", "해줘",
  // 되다류
  "되기", "되면", "되는", "되고", "됐다", "될까", "되지", "돼서",
  // 있다/없다
  "있는", "없는", "있다", "없다", "있어", "없어", "있으", "없으",
  // 연결/종결
  "인데", "는데", "은데", "지만", "거든", "니까", "면서", "으며",
  "네요", "에요", "해요", "죠", "다고", "라고", "던데", "더니",
  "잖아", "거야", "건데", "을까", "나요", "ㄹ까", "세요", "래요",
];

export function stripSuffix(word: string): string {
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

export const STOPWORDS = new Set([
  // 기능어·접속사·부사
  "있으면", "없으면", "그리고", "그런데", "하지만", "그래서", "그러면",
  "그러나", "그렇게", "따라서", "그래도", "그러니", "그러다",
  "진짜", "정말", "완전", "그냥", "너무", "아주", "매우", "약간", "조금",
  "엄청", "꽤", "참", "딱", "막", "겁나", "졸라", "개",
  "이런", "저런", "그런", "어떤", "무슨", "이거", "저거", "그거",
  "이것", "저것", "그것", "여기", "거기", "저기", "어디",
  "오늘", "내일", "어제", "요즘", "지금", "다음", "이번", "이제",
  "나중", "아까", "방금", "갑자기", "항상", "자주", "가끔",
  "우리", "저희", "자기", "본인", "여러분", "나는", "저는",
  "얘가", "걔가", "쟤가", "누가", "뭐가",
  "하나", "혼자", "모두", "전부", "아니", "아니라", "없는데",
  "다른", "같은", "이렇게", "저렇게", "그렇게",
  // 유튜브/인터넷 상용어
  "영상", "댓글", "구독", "알림", "채널", "유튜브", "좋아요",
  "라이브", "스트리밍", "업로드", "조회수", "인스타", "틱톡",
  "다들", "사람", "정도", "때문", "경우", "부분",
  "얘기", "이야기", "뭔가", "어떻게", "왜",
  "ㅋㅋ", "ㅎㅎ", "ㅠㅠ", "ㅜㅜ", "ㄷㄷ", "ㅇㅇ",
  "ㅋㅋㅋ", "ㅋㅋㅋㅋ", "ㅎㅎㅎ", "ㅠㅠㅠ", "ㅜㅜㅜ",
  // 일반 동사/형용사 잔재
  "있다", "없다", "하다", "되다", "같다", "보다", "가다", "오다",
  "좋겠다", "싶다", "알다", "모르다", "보이다", "나오다", "들어가",
  "해주", "해줘", "해달", "알겠", "모르겠",
  // 뉴스 상용 동사/부사 (워드클라우드 노이즈)
  "올해", "최근", "따르면", "밝혔", "전했", "보도", "발표", "관련",
  "대한", "위해", "통해", "이어", "나타", "라며", "했다", "된다",
  "한편", "또한", "이후", "이전", "현재", "예정", "이상", "이하",
  "가운데", "가능", "필요", "예상", "전망", "지난해", "작년", "올해",
  "상반기", "하반기", "분기", "지난", "앞서", "오는", "기자",
  // 동사/부사 어간 잔재 (조사 제거 후 남는 것들)
  "오르", "내리", "나서", "속에", "그는", "그의", "이를", "일제히",
  "다만", "만큼", "결정", "고려해", "높아", "낮아", "크게", "작게",
  "많은", "적은", "새로", "계속", "함께", "대해", "것으로", "라는",
  "이번", "제공", "소개", "실시", "마련", "지원", "추진", "진행",
  "확인", "논의", "설명", "강조", "지적", "평가", "분석",
  // 관형/의존
  "것", "거", "수", "줄", "때", "곳", "뿐", "중", "내",
  // 숫자/단위 잔재
  "하나", "둘", "셋", "넷", "처음", "마지막",
]);

const POS_WORDS = new Set([
  // 감탄/호평
  "좋다", "최고", "대박", "인기", "사랑", "추천", "감동", "행복", "축하",
  "멋지", "예쁘", "귀엽", "기대", "응원", "화이팅", "훌륭", "미쳤",
  "감사", "고마", "좋아", "최애", "레전드", "존경", "재밌", "재미",
  // 긍정 형용사
  "완벽", "놀랍", "신기", "소름", "대단", "짱", "갓",
  "편하", "깔끔", "상큼", "힐링", "따뜻", "포근", "설렘", "설레",
  // 긍정 동사/표현
  "성공", "발전", "성장", "기쁘", "즐겁", "만족", "뿌듯",
  "유익", "알차", "든든", "풍성", "넉넉", "충분",
  // 인터넷 긍정어
  "킹왕짱", "갓벽", "존맛", "존잘", "존예", "핵꿀잼", "꿀잼",
  "미쳤다", "역대급", "찐", "인정", "공감", "최선",
  // 칭찬
  "천재", "프로", "능력자", "실력", "센스", "배려", "친절",
]);

const NEG_WORDS = new Set([
  // 부정 감정
  "별로", "싫다", "실망", "논란", "문제", "불만", "짜증", "화나",
  "걱정", "불안", "힘들", "아쉬", "안타깝", "슬프", "우울",
  "비싼", "불편", "최악", "쓰레기", "거짓",
  // 비판/혐오
  "역겹", "구역질", "한심", "답답", "황당", "어이없", "말도안",
  "충격", "경악", "분노", "배신", "사기", "조작", "날조",
  // 부정 형용사
  "무섭", "끔찍", "지루", "노잼", "재미없", "유치", "촌스럽",
  "심각", "위험", "부족", "형편없", "엉망", "개판", "망했",
  // 불편/고통
  "피곤", "지침", "아프", "고통", "괴롭", "스트레스", "지겹",
  "짜증나", "귀찮", "싫어", "후회", "잘못", "실수", "폭망",
  // 인터넷 부정어
  "노답", "헬", "병맛", "극혐", "흑역사", "어그로", "악플",
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
