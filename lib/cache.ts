/**
 * 서버 메모리 캐시 — 같은 키워드 요청은 저장된 결과를 즉시 반환.
 *
 * 사용법:
 *   const cached = getCache<MyResult>("investigate", "치킨");
 *   if (cached) return cached; // 즉시 반환
 *   const result = await expensiveWork();
 *   setCache("investigate", "치킨", result);
 *
 * - TTL: 기본 1시간 (연수 중 충분)
 * - 최대 200개 항목 (메모리 보호)
 * - 서버 재시작 시 초기화
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();
const MAX_ENTRIES = 200;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1시간

function cacheKey(category: string, keyword: string): string {
  return `${category}::${keyword.toLowerCase().trim()}`;
}

/**
 * 캐시에서 결과를 가져온다. 만료되었으면 null.
 */
export function getCache<T>(category: string, keyword: string): T | null {
  const key = cacheKey(category, keyword);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * 결과를 캐시에 저장한다.
 */
export function setCache(category: string, keyword: string, data: unknown, ttlMs = DEFAULT_TTL_MS): void {
  const key = cacheKey(category, keyword);

  // 최대 항목 수 초과 시 가장 오래된 것 제거
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }

  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * 현재 캐시 상태 (디버그용)
 */
export function cacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: [...store.keys()] };
}
