// 특정 날짜의 한국 시즌·공휴일·기념일 자동 감지.
// 네이버 뉴스/블로그 검색 쿼리에 맥락 키워드를 주입해 관련 기사 적중률을 높인다.
//
// 예: 2025-10-06 → ["추석", "한가위", "명절"]
//     2024-12-24 → ["크리스마스", "연말"]
//     2025-02-14 → ["밸런타인데이"]

interface SeasonalWindow {
  /** 연도 무관 기준 시작 (month/day) */
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  keywords: string[];
}

// 양력 고정 기념일·시즌 (추석은 음력이라 별도 처리)
const WINDOWS: SeasonalWindow[] = [
  { startMonth: 1, startDay: 1, endMonth: 1, endDay: 3, keywords: ["신정", "새해"] },
  { startMonth: 2, startDay: 10, endMonth: 2, endDay: 18, keywords: ["밸런타인데이"] },
  { startMonth: 3, startDay: 1, endMonth: 3, endDay: 1, keywords: ["삼일절"] },
  { startMonth: 3, startDay: 12, endMonth: 3, endDay: 16, keywords: ["화이트데이"] },
  { startMonth: 5, startDay: 1, endMonth: 5, endDay: 1, keywords: ["근로자의날"] },
  { startMonth: 5, startDay: 3, endMonth: 5, endDay: 7, keywords: ["어린이날", "가정의달"] },
  { startMonth: 5, startDay: 7, endMonth: 5, endDay: 9, keywords: ["어버이날"] },
  { startMonth: 5, startDay: 12, endMonth: 5, endDay: 16, keywords: ["로즈데이", "스승의날"] },
  { startMonth: 6, startDay: 5, endMonth: 6, endDay: 7, keywords: ["현충일"] },
  { startMonth: 7, startDay: 10, endMonth: 8, endDay: 20, keywords: ["여름휴가", "여름"] },
  { startMonth: 8, startDay: 14, endMonth: 8, endDay: 16, keywords: ["광복절"] },
  { startMonth: 10, startDay: 2, endMonth: 10, endDay: 4, keywords: ["개천절"] },
  { startMonth: 10, startDay: 8, endMonth: 10, endDay: 10, keywords: ["한글날"] },
  { startMonth: 10, startDay: 30, endMonth: 11, endDay: 1, keywords: ["할로윈"] },
  { startMonth: 11, startDay: 10, endMonth: 11, endDay: 12, keywords: ["빼빼로데이"] },
  { startMonth: 11, startDay: 24, endMonth: 11, endDay: 30, keywords: ["블랙프라이데이"] },
  { startMonth: 12, startDay: 20, endMonth: 12, endDay: 26, keywords: ["크리스마스", "연말"] },
  { startMonth: 12, startDay: 28, endMonth: 12, endDay: 31, keywords: ["연말", "송년회"] },
];

// 추석·설 음력 근사치 (연도별 양력 날짜 매핑)
// 소스: 한국 천문연구원. 필요 시 최신 연도 추가.
const CHUSEOK_APPROX: Record<string, { month: number; day: number }> = {
  "2023": { month: 9, day: 29 },
  "2024": { month: 9, day: 17 },
  "2025": { month: 10, day: 6 },
  "2026": { month: 9, day: 25 },
  "2027": { month: 9, day: 15 },
};
const SEOLLAL_APPROX: Record<string, { month: number; day: number }> = {
  "2024": { month: 2, day: 10 },
  "2025": { month: 1, day: 29 },
  "2026": { month: 2, day: 17 },
  "2027": { month: 2, day: 7 },
};

// 삼복(초복/중복/말복) — 절기·경일 기반. 연도별 테이블로 단순화.
const SAMBOK: Record<string, { chobok: [number, number]; jungbok: [number, number]; malbok: [number, number] }> = {
  "2023": { chobok: [7, 11], jungbok: [7, 21], malbok: [8, 10] },
  "2024": { chobok: [7, 15], jungbok: [7, 25], malbok: [8, 14] },
  "2025": { chobok: [7, 20], jungbok: [7, 30], malbok: [8, 9] },
  "2026": { chobok: [7, 15], jungbok: [7, 25], malbok: [8, 14] },
  "2027": { chobok: [7, 20], jungbok: [7, 30], malbok: [8, 9] },
};

// 수능일 (매년 11월 셋째 목요일 기준)
const SUNEUNG: Record<string, { month: number; day: number }> = {
  "2023": { month: 11, day: 16 },
  "2024": { month: 11, day: 14 },
  "2025": { month: 11, day: 13 },
  "2026": { month: 11, day: 19 },
  "2027": { month: 11, day: 18 },
};

// 절기 중 주요 — 동지(12/22경), 입춘(2/4경), 하지(6/21경), 입추(8/7경) 등
const JEOLGI: Array<{ name: string; month: number; day: number; range: number }> = [
  { name: "동지", month: 12, day: 22, range: 1 },
  { name: "입춘", month: 2, day: 4, range: 1 },
  { name: "춘분", month: 3, day: 21, range: 1 },
  { name: "하지", month: 6, day: 21, range: 1 },
  { name: "입추", month: 8, day: 7, range: 1 },
  { name: "추분", month: 9, day: 23, range: 1 },
];

function inRange(m: number, d: number, w: SeasonalWindow): boolean {
  const cur = m * 100 + d;
  const s = w.startMonth * 100 + w.startDay;
  const e = w.endMonth * 100 + w.endDay;
  return cur >= s && cur <= e;
}

function dayDiff(y: number, m: number, d: number, target: { month: number; day: number }): number {
  const a = new Date(y, m - 1, d).getTime();
  const b = new Date(y, target.month - 1, target.day).getTime();
  return Math.abs((a - b) / 86400000);
}

/**
 * 날짜 문자열(YYYY-MM-DD)에서 시즌/공휴일 키워드 추출.
 * 최대 3개 반환 (쿼리 오염 방지).
 */
export function detectSeasonal(dateStr: string): string[] {
  const m0 = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m0) return [];
  const y = parseInt(m0[1], 10);
  const m = parseInt(m0[2], 10);
  const d = parseInt(m0[3], 10);

  const hits: string[] = [];

  // 1) 양력 고정 기념일
  for (const w of WINDOWS) {
    if (inRange(m, d, w)) hits.push(...w.keywords);
  }

  // 2) 추석 (±4일 이내)
  const ck = CHUSEOK_APPROX[String(y)];
  if (ck && dayDiff(y, m, d, ck) <= 4) {
    hits.push("추석", "한가위", "명절");
  }

  // 3) 설날 (±4일 이내)
  const se = SEOLLAL_APPROX[String(y)];
  if (se && dayDiff(y, m, d, se) <= 4) {
    hits.push("설날", "구정", "명절");
  }

  // 4) 삼복 (초/중/말) — ±2일 이내
  const sb = SAMBOK[String(y)];
  if (sb) {
    if (dayDiff(y, m, d, { month: sb.chobok[0], day: sb.chobok[1] }) <= 2) hits.push("초복", "복날", "삼복");
    if (dayDiff(y, m, d, { month: sb.jungbok[0], day: sb.jungbok[1] }) <= 2) hits.push("중복", "복날", "삼복");
    if (dayDiff(y, m, d, { month: sb.malbok[0], day: sb.malbok[1] }) <= 2) hits.push("말복", "복날", "삼복");
  }

  // 5) 수능일 ±7일 (수험생·입시 맥락)
  const sn = SUNEUNG[String(y)];
  if (sn && dayDiff(y, m, d, sn) <= 7) {
    hits.push("수능", "수험생", "입시");
  }

  // 6) 절기 ±1일
  for (const j of JEOLGI) {
    if (dayDiff(y, m, d, { month: j.month, day: j.day }) <= j.range) {
      hits.push(j.name);
    }
  }

  // 7) 월별 기본 시즌 (계절성)
  const monthlySeason: Record<number, string> = {
    1: "겨울", 2: "겨울", 3: "봄", 4: "봄", 5: "봄",
    6: "여름", 7: "여름", 8: "여름",
    9: "가을", 10: "가을", 11: "가을", 12: "겨울",
  };
  const season = monthlySeason[m];
  if (season && hits.length === 0) hits.push(season);

  // 중복 제거, 최대 4개 (복날 같은 건 3개 키워드라 여유)
  return Array.from(new Set(hits)).slice(0, 4);
}

/** 날짜의 요일 (한글) */
export function koreanWeekday(dateStr: string): string {
  const d = new Date(dateStr);
  return ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
}
