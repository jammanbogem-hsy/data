/**
 * Claude 응답에서 JSON을 안전하게 추출한다.
 * - ```json ... ``` 코드 블록 제거
 * - JSON 앞뒤에 붙은 설명 텍스트 무시
 * - 첫 번째 { ... } 또는 [ ... ] 블록을 찾아서 파싱
 */
export function parseAiJson<T>(text: string): T {
  // 1. 코드 블록 제거
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // 2. 직접 파싱 시도
  try {
    return JSON.parse(cleaned);
  } catch {
    // 3. { } 블록 추출 시도
    const braceStart = cleaned.indexOf("{");
    const braceEnd = cleaned.lastIndexOf("}");
    if (braceStart >= 0 && braceEnd > braceStart) {
      try {
        return JSON.parse(cleaned.slice(braceStart, braceEnd + 1));
      } catch { /* fall through */ }
    }

    // 4. [ ] 블록 추출 시도
    const bracketStart = cleaned.indexOf("[");
    const bracketEnd = cleaned.lastIndexOf("]");
    if (bracketStart >= 0 && bracketEnd > bracketStart) {
      try {
        return JSON.parse(cleaned.slice(bracketStart, bracketEnd + 1));
      } catch { /* fall through */ }
    }

    throw new Error(`JSON 파싱 실패: ${cleaned.slice(0, 200)}`);
  }
}
