# AI 사회 탐구 실험실 (AI Mind Mining Lab)

> 검색량 분석을 넘어, **사람들의 마음과 사회 분위기의 흐름**을 읽는 AI 기반 데이터 마이닝 플랫폼

**https://datamining-jian.web.app**

---

## 이 프로젝트는 무엇인가요?

보통 데이터 분석 서비스는 "검색량이 올랐다/내렸다" 정도만 보여줍니다.

하지만 실제 사회 현상을 이해하려면:

- **왜** 사람들이 갑자기 관심을 가졌는가?
- **어떤 감정**으로 반응했는가?
- **어디서** 시작되어 **어떻게** 퍼졌는가?

를 함께 읽어야 합니다.

이 프로젝트는 **네이버 뉴스 + YouTube + DataLab + X(Twitter)** 데이터를 수집하고, AI가 "사람들의 마음"을 읽어내는 **사회 탐구 실험실**입니다.

---

## 구동 방식

```
사용자가 키워드 입력 (예: "치킨", "저출산", "BTS")
        |
        v
   [데이터 수집] ────────────────────────────────────
   |              |              |              |
네이버 뉴스     YouTube       DataLab       X(Twitter)
블로그/카페      영상+댓글      검색 트렌드     실시간 반응
(400건)        (8영상+300댓글)  (일별 추이)    (Grok AI)
        |
        v
   [패턴 분석] ── 순수 TypeScript 알고리즘
   |
   급등 감지 · 감정 분류 · 키워드 클러스터링
   교차상관 · 시계열 분해 · PMI 동시출현
        |
        v
   [AI 해석] ── Claude Haiku + Grok
   |
   "왜 사람들이 반응했는가?"
   "사회 분위기는 어떠한가?"
   "감정은 어떻게 변했는가?"
        |
        v
   [결과 표시] ── Material Design 3 UI
```

---

## 3개의 탭

### 1. 키워드 분석

키워드를 입력하면 **"왜 이 키워드가 뜨고 있는가?"** 를 분석합니다.

| 기능 | 설명 |
|------|------|
| AI 가설 생성 | 뉴스+댓글 근거 기반 3개 가설 제시 |
| 검색 트렌드 | DataLab 시계열 + 급등 구간 자동 감지 |
| 급등 원인 분석 | 각 급등 시점의 뉴스/영상/댓글 심층 분석 |
| 감정 분석 | 뉴스 제목의 긍정/부정/중립 분류 + 워드클라우드 |
| 유행 사이클 | 반복되는 유행 패턴 자동 감지 |
| 실제 검색량 | 네이버 검색광고 API 월간 검색 수치 |
| 연관 검색어 | 검색광고 + 자동완성 기반 |
| 이벤트 영향 | 한국 공휴일/명절 영향도 분석 |

### 2. YouTube 분석

YouTube 영상 링크를 넣으면 댓글 300개를 수집하여 분석합니다.

| 기능 | 설명 |
|------|------|
| 댓글 감정 분석 | 긍정/부정/중립 비율 |
| 키워드 추출 | 한국어 형태소 분석 + 워드클라우드 |
| AI 요약 | 영상의 사회적 위치 + 댓글 반응 종합 |

### 3. 실험실 (AI 사회 탐구)

**"사람들의 마음 흐름 읽기"** 를 목표로 하는 실험적 분석 도구입니다.

#### AI 사회 해석 (최상위 레이어)

키워드를 입력하면 모든 데이터를 종합하여:

- **사회 분위기** - 지금 사회의 온도는?
- **사람들의 마음** - 사람들은 무엇을 원하는가?
- **사회 변화 신호** - 어떤 변화가 감지되는가?
- **X 실시간 반응** - SNS에서 날것의 반응은?

을 생성합니다.

#### 6개 증거 탐구 실험실

AI 해석의 근거를 직접 탐구할 수 있는 6개 실험실:

| 실험실 | 핵심 질문 | 알고리즘 |
|--------|----------|---------|
| **검색 의도 분석** | 왜 검색했을까? | Intent Clustering, PMI |
| **사회 현상 연결망** | 어떤 사회 현상과 연결되나? | Graph Embedding, PMI Network |
| **유행 확산 분석** | 어디서 시작되어 퍼졌나? | Cascade Detection, Temporal Analysis |
| **반복 사회 패턴** | 매년 반복되는 패턴이 있나? | Sequential Pattern Mining |
| **관심 이동 분석** | 관심은 어디로 이동하나? | Markov Chain, Cross-correlation |
| **감정 흐름 분석** | 감정이 어떻게 변했나? | Emotion Trajectory, Sentiment Timeline |

---

## 사용 알고리즘 상세

### 데이터 수집 단계

| 알고리즘 | 파일 | 하는 일 |
|----------|------|--------|
| Naver Search API | `lib/providers/naver.ts` | 뉴스/블로그/카페 검색 (QPS 제한 대응, 순차 호출) |
| Naver DataLab API | `lib/providers/naver.ts` | 검색 트렌드 시계열 (성별/연령/기기별 필터) |
| Naver Search Ad API | `lib/providers/naver-ad.ts` | 실제 월간 검색량 + 연관 키워드 (HMAC-SHA256 인증) |
| Naver Autocomplete | `lib/providers/naver-ad.ts` | 실시간 자동완성 검색어 |
| YouTube Data API v3 | `lib/providers/youtube.ts` | 영상 검색 + 댓글 수집 (페이지네이션) |
| Wikipedia Pageviews | `lib/providers/wikipedia.ts` | 위키백과 조회수 (보조 지표) |
| xAI Grok API | `lib/providers/grok.ts` | X/Twitter 실시간 반응 요약 |

### 패턴 분석 단계

모든 알고리즘은 **순수 TypeScript**로 구현 (외부 ML 라이브러리 없음):

| 알고리즘 | 파일 | 하는 일 |
|----------|------|--------|
| 이동평균 급등 감지 | `lib/spike.ts` | 7일 이동평균 대비 1.5배 돌파 구간 탐지 |
| STL 시계열 분해 | `lib/stl-decompose.ts` | 트렌드 + 요일 패턴 + 잔차 분리 |
| Z-score 이상치 | `lib/statistical-anomaly.ts` | 통계적으로 유의미한 급등/급락 포인트 |
| Pearson 상관분석 | `lib/correlation.ts` | 키워드 간 상관관계 + 시간차(lag) 분석 |
| PMI 동시출현 | `lib/keyword-cluster.ts` | 키워드 쌍의 동시 등장 강도 계산 |
| 한국어 형태소 처리 | `lib/comment-analyze.ts` | 조사/어미 제거 (45+ 조사, 50+ 어미 패턴) |
| 감정 분류 | `lib/comment-analyze.ts` | 90+ 긍정어, 65+ 부정어 기반 3분류 |
| 이벤트 영향 분석 | `lib/event-study.ts` | 이벤트 전/중/후 구간 비교 |
| 요일/공휴일 보정 | `lib/correction.ts` | 요일 효과 제거, 한국 공휴일 보정 |
| 유행 사이클 감지 | `lib/trend-cycle.ts` | AUC 기반 유행 강도, 주기성 분석 |
| 한국 시즌 감지 | `lib/korean-seasonal.ts` | 명절/절기/시험기간 자동 태깅 |

### 실험실 알고리즘

| 알고리즘 | 파일 | 하는 일 |
|----------|------|--------|
| Intent Clustering | `lib/lab/intent-cluster.ts` | 검색 의도를 PMI 클러스터링으로 그룹화 |
| Social Graph | `lib/lab/social-graph.ts` | 동시출현 기반 사회 현상 네트워크 구축 |
| Cascade Detection | `lib/lab/cascade-detect.ts` | 플랫폼 간 확산 시간차 분석 |
| Sequential Pattern | `lib/lab/sequential-pattern.ts` | 연도별 반복 패턴 탐지 |
| Markov Chain | `lib/lab/markov.ts` | 교차상관 기반 관심 이동 전이 확률 |
| Emotion Trajectory | `lib/lab/emotion-trajectory.ts` | 시간 버킷별 감정 변화 추적 |

### AI 해석 단계

| 모델 | 역할 | 비용 |
|------|------|------|
| Claude Haiku 4.5 | 가설 생성, 사회 해석, 감정 분류 | ~$0.04/분석 |
| Grok 3 Mini | X/Twitter 실시간 반응 요약 | ~$0.003/분석 |

AI는 **패턴을 발견하는 것이 아니라, 발견된 패턴을 사람이 이해할 수 있는 이야기로 변환**하는 역할입니다.

---

## 핵심 설계 원칙

### 1. "추측이 아닌 데이터 속에서 의미를 얻는 것"

모든 해석에는 근거 데이터가 있고, `[뉴스1]`, `[유튜브3]` 같은 출처 라벨로 추적 가능합니다.

### 2. "설명 가능한 사회 해석"

AI의 해석이 왜 나왔는지, 6개 실험실에서 근거를 직접 탐구할 수 있습니다.

### 3. X 반응은 "참고용"

X(Twitter) 데이터는 전체 여론을 대표하지 않습니다. "실시간 담론 감지 센서"로 활용합니다.

### 4. 비용 효율

| 항목 | 비용 |
|------|------|
| 키워드 분석 1회 | ~$0.04 |
| 실험실 전체 1회 | ~$0.05 |
| 월 100회 분석 | ~$5 |
| 네이버/YouTube API | 무료 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router, SSR) |
| 언어 | TypeScript |
| UI | Tailwind CSS + Google Material Design 3 |
| 아이콘 | Material Symbols Outlined |
| 차트 | visx (SVG 기반) |
| 워드클라우드 | d3-cloud |
| AI | Anthropic Claude Haiku 4.5 + xAI Grok 3 Mini |
| 호스팅 | Firebase Hosting + Cloud Run |
| 캐싱 | 서버 메모리 캐시 (1시간 TTL) |

---

## 프로젝트 구조

```
app/
  page.tsx                    # 키워드 분석 (메인)
  youtube/page.tsx            # YouTube 분석
  lab/
    page.tsx                  # 실험실 메인 (AI 사회 해석)
    intent/page.tsx           # 검색 의도 분석
    social-graph/page.tsx     # 사회 현상 연결망
    cascade/page.tsx          # 유행 확산 분석
    sequential/page.tsx       # 반복 사회 패턴
    markov/page.tsx           # 관심 이동 분석
    emotion/page.tsx          # 감정 흐름 분석
  api/
    investigate/route.ts      # 키워드 분석 API
    spike-insight/route.ts    # 급등 원인 분석 API
    youtube-analyze/route.ts  # YouTube 분석 API
    lab/                      # 실험실 API (7개)

lib/
  providers/                  # 외부 API 연동
    naver.ts                  # 네이버 검색/DataLab
    naver-ad.ts               # 네이버 검색광고/자동완성
    youtube.ts                # YouTube Data API
    claude.ts                 # Claude AI
    grok.ts                   # Grok (X 반응)
    wikipedia.ts              # Wikipedia Pageviews
  lab/                        # 실험실 알고리즘
  spike.ts                    # 급등 감지
  trend-cycle.ts              # 유행 사이클
  correlation.ts              # 상관분석
  comment-analyze.ts          # 감정 분류/형태소
  cache.ts                    # 서버 캐싱

components/                   # UI 컴포넌트 (30+)
```

---

## 로컬 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정 (.env.local)
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
NAVER_AD_CUSTOMER_ID=...
NAVER_AD_API_KEY=...
NAVER_AD_SECRET_KEY=...
YOUTUBE_API_KEY=...
ANTHROPIC_API_KEY=...
XAI_API_KEY=...

# 3. 개발 서버 실행
npm run dev

# 4. 브라우저에서 열기
open http://localhost:3000
```

---

## 교육적 활용

이 프로젝트는 초등~중학교 데이터 마이닝 수업을 위해 만들어졌습니다.

학생들은 단순히 "검색량이 올랐다"를 넘어:

- "**왜** 사람들은 이런 행동을 했을까?"
- "**왜** 이런 감정이 퍼졌을까?"
- "**왜** 이런 유행이 확산되었을까?"

를 데이터 근거를 바탕으로 탐구할 수 있습니다.

---

## 동시 사용 (연수/수업)

20명이 동시에 사용할 수 있도록 **서버 캐싱**이 적용되어 있습니다.

- 첫 번째 사용자: API 호출 → 15초 대기 → 결과 (저장)
- 나머지 19명: 저장된 결과 → **1초 이내** 즉시 표시
- 캐시 유효기간: 1시간

---

## 라이선스

교육 목적 프로젝트입니다.
