// Firestore 컬렉션 공유 타입 정의
// Python 파이프라인과 Next.js 웹앱이 같은 필드명을 사용하도록 기준 역할

export type Source = "naver-news" | "naver-datalab" | "youtube-video" | "youtube-comment";
export type SentimentLabel = "positive" | "negative" | "neutral";
export type Category =
  | "food"
  | "game"
  | "culture"
  | "sports"
  | "science"
  | "animal"
  | "travel"
  | "education"
  | "other";

// 일자별 수집 스냅샷 메타
export interface Snapshot {
  id: string;              // yyyy-MM-dd
  runAt: number;           // epoch ms
  sources: Source[];
  itemCount: number;
  topicCount: number;
  status: "running" | "ok" | "error";
  error?: string;
}

// 원문 아이템 (text는 Cloud Storage에, 여기선 메타만)
export interface Item {
  id: string;
  snapshotId: string;
  source: Source;
  url: string;
  title?: string;
  textPreview: string;      // 120자 프리뷰
  storagePath?: string;     // gs://.../raw/yyyy-MM-dd/items/{id}.json
  createdAt: number;        // 원문 작성 시각
  collectedAt: number;
  category?: Category;
  lang: "ko" | "en" | "other";
  authorHash?: string;      // 원작성자 해시 (개인정보 비저장)
  likeCount?: number;
}

// 정규화된 키워드 마스터
export interface Keyword {
  id: string;               // 정규화된 표면형
  text: string;
  totalMentions: number;
  lastSeenAt: number;
  kidSafeScore: number;     // 0–1
  category?: Category;
}

// 일자별 키워드 집계 (급등 탐지 입력)
export interface KeywordDaily {
  id: string;               // yyyy-MM-dd_{keyword}
  date: string;             // yyyy-MM-dd
  keyword: string;
  count: number;
  sentimentAvg: number;     // -1..1
  sentimentDist: { positive: number; negative: number; neutral: number };
  sources: Partial<Record<Source, number>>;
  surgeScore: number;       // recent7 / prior28Avg 비율, min=0
}

// 키워드 공기 관계 (온톨로지 그래프 엣지)
export interface Edge {
  id: string;               // yyyy-MM-dd_{a}__{b} (a < b 사전순)
  date: string;
  a: string;
  b: string;
  weight: number;
  pmi: number;
}

// 수업용 토픽 카드 — 파이프라인 최종 산출물
export interface Topic {
  id: string;
  date: string;
  title: string;
  summary: string;          // 5-6학년 수준 1-2문장
  keywords: string[];
  sentimentDist: { positive: number; negative: number; neutral: number };
  surgeScore: number;
  kidSafeScore: number;
  category: Category;
  lessonIdeas: string[];    // 활동 아이디어 3개
  sampleQuotes: Array<{ source: Source; url: string; textPreview: string }>;
}
