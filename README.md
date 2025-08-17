# Multi-LLM 평가 시스템

고객 서비스 채팅 상담 품질을 자동으로 평가하는 Multi-LLM 기반 시스템입니다.

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 개발 환경 자동 설정
npm run setup

# 또는 수동 설정
cp .env.example .env.local
# .env.local 파일에서 API 키 설정
```

### 2. 개발 서버 시작

```bash
# 추천: 통합 개발 스크립트 사용
npm run dev:server

# 또는 기본 Next.js 개발 서버
npm run dev
```

### 3. 시스템 상태 확인

```bash
# 헬스 체크
npm run health

# 브라우저에서 확인
open http://localhost:3000
```

## 📋 API 키 설정

### OpenAI API 키 (필수)
1. [OpenAI Platform](https://platform.openai.com/api-keys)에서 API 키 생성
2. `.env.local` 파일에 설정:
   ```
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```
3. GPT-5-mini 모델이 자동으로 사용됩니다

### Google AI API 키 (Multi-LLM 모드용, 권장)
1. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 API 키 생성
2. `.env.local` 파일에 설정:
   ```
   GOOGLE_AI_API_KEY=your-google-ai-api-key-here
   GEMINI_MODEL=gemini-2.5-flash  # 또는 gemini-2.5-pro
   ```
3. Gemini 2.5 모델이 자동으로 사용됩니다

## ✨ 주요 기능

### 1. 상담 데이터 업로드 및 처리
- **Excel 파일 업로드**: 대량의 상담 데이터를 Excel 형식으로 일괄 업로드
- **데이터 자동 파싱**: 상담원별, 날짜별 자동 분류 및 정리
- **실시간 처리 상태 표시**: 업로드 진행률 및 처리 상태 모니터링

### 2. AI 기반 상담 품질 평가
- **다차원 평가 체계**:
  - 업무능력 (6개 세부 항목)
  - 문장력 (4개 세부 항목)
  - 기본 태도 (2개 세부 항목)
- **5점 척도 평가**: 각 항목별 1.0~5.0점 정밀 평가
- **자동 메시지 필터링**: 봇 메시지 및 자동 응답 제외

### 3. 종합 분석 및 리포트
- **상담원별 성과 분석**: 개인별 강점/약점 도출
- **트렌드 분석**: 시간대별 패턴 및 개선 추이 파악
- **벤치마크 비교**: 팀 평균 대비 개인 성과 비교
- **Excel 리포트 생성**: 분석 결과 다운로드 가능

### 4. 개선 피드백 시스템
- **문제 상담 자동 식별**: 평균 이하 성과 자동 감지
- **구체적 개선 제안**: 항목별 맞춤형 개선 가이드
- **우선순위 제공**: 심각도에 따른 개선 우선순위 설정

### 5. 아카이브 기능
- **평가 결과 저장**: 모든 평가 데이터 영구 보관
- **이력 관리**: 과거 평가 결과 조회 및 비교
- **자동 아카이빙**: 30일 이상 된 데이터 자동 보관

## 🛠 기술 스택

### Frontend
- **Framework**: Next.js 14.2.16
- **UI Library**: React 18
- **Styling**: Tailwind CSS 3.4
- **Component Library**: Radix UI
- **Form Management**: React Hook Form
- **Validation**: Zod

### Backend
- **Runtime**: Node.js
- **API Routes**: Next.js API Routes
- **File Storage**: Vercel Blob Storage
- **Data Processing**: XLSX

### AI Integration
- **Multi-LLM**: OpenAI GPT-5-mini (Responses API) + Google Gemini 2.5 Pro/Flash
- **Temperature**: 0.1 (일관성 있는 평가를 위한 낮은 온도 설정)
- **Architecture**: 5-Layer Clean Architecture
- **GPT-5 Features**: 
  - Reasoning effort control (minimal/low/medium/high)
  - Verbosity control (low/medium/high)
  - Responses API for improved performance
- **Gemini 2.5 Features**:
  - Pro: 고성능 추론 및 복잡한 분석
  - Flash: 빠른 응답과 효율적 처리
  - 문화적 감수성과 다각적 관점 제공

## 📁 프로젝트 구조

```
fintech-feedback-system/
├── app/                        # Next.js 앱 디렉토리
│   ├── api/                   # API 엔드포인트
│   │   ├── upload/            # 파일 업로드 처리
│   │   ├── analyze/           # 상담 분석
│   │   ├── analyze-comprehensive/ # 종합 분석
│   │   ├── analyze-individual/   # 개별 분석
│   │   ├── generate-report/   # 리포트 생성
│   │   ├── archive/           # 아카이브 관리
│   │   └── comments/          # 코멘트 관리
│   ├── page.tsx              # 메인 페이지
│   └── layout.tsx            # 레이아웃
├── components/               # 재사용 가능한 컴포넌트
│   └── ui/                  # UI 컴포넌트 라이브러리
├── lib/                     # 유틸리티 함수
├── hooks/                   # 커스텀 React 훅
└── public/                  # 정적 파일
```

## 🚀 시작하기

### 필수 요구사항
- Node.js 18.0 이상
- npm 또는 pnpm 패키지 매니저

### 설치 방법

1. 저장소 클론
```bash
git clone [repository-url]
cd fintech-feedback-system
```

2. 의존성 설치
```bash
pnpm install
# 또는
npm install
```

3. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 변수를 설정:
```env
OPENAI_API_KEY=your_openai_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

4. 개발 서버 실행
```bash
pnpm dev
# 또는
npm run dev
```

5. 브라우저에서 확인
```
http://localhost:3000
```

## 📊 평가 기준

### 업무능력 (60%)
- 고객 질문 내용 파악
- 파악 및 해결 적극성
- 답변의 정확성 및 적합성
- 도메인 전문성
- 신속한 응대
- 상황 공감

### 문장력 (25%)
- 정확한 맞춤법
- 적절한 언어 표현
- 쉬운 표현 사용
- 단계별 안내

### 기본 태도 (15%)
- 인사 및 추가 문의
- 양해 표현 사용

## 🔍 주요 API 엔드포인트

| 엔드포인트 | 메소드 | 설명 |
|-----------|--------|------|
| `/api/evaluate-multi` | GET | 헬스 체크 |
| `/api/evaluate-multi` | POST | Multi-LLM 평가 (스트리밍) |
| `/api/upload` | POST | Excel 파일 업로드 |
| `/api/analyze` | POST | 상담 데이터 분석 |
| `/api/analyze-comprehensive` | POST | 종합 분석 수행 |
| `/api/analyze-individual` | POST | 개별 상담 분석 |
| `/api/generate-report` | POST | Excel 리포트 생성 |
| `/api/archive` | GET/POST/DELETE | 아카이브 관리 |
| `/api/comments` | GET/POST/DELETE | 코멘트 관리 |

## 🛠️ 개발 스크립트

```bash
# 개발 환경 설정
npm run setup

# 개발 서버 시작 (추천)
npm run dev:server

# 기본 개발 서버
npm run dev

# 빌드
npm run build

# 타입 체크
npm run build:check

# 린트
npm run lint

# 헬스 체크
npm run health

# 캐시 정리
npm run clean

# 완전 재설치
npm run clean:all
```

## 🚀 GPT-5 최적화 기능

### GPT-5-mini 모델 특징
- **향상된 추론 능력**: GPT-4 대비 더 정확하고 일관성 있는 평가
- **Responses API**: Chain of Thought (CoT) 전달로 성능 향상
- **동적 추론 조절**: 평가 복잡도에 따라 reasoning effort 자동 조정
- **비용 효율성**: GPT-4 대비 낮은 비용으로 더 나은 성능

### Reasoning Effort 설정
- **minimal**: 단순 평가, 빠른 응답 (< 2초)
- **low**: 기본 평가, 균형잡힌 속도 (2-5초)
- **medium**: 표준 평가, 정확한 분석 (5-10초) - 기본값
- **high**: 심층 평가, 상세한 분석 (10-20초)

### Verbosity 설정
- **low**: 핵심 평가 결과만 제공
- **medium**: 평가 결과와 주요 근거 제공 - 기본값
- **high**: 상세한 분석과 모든 근거 제공

## 🎯 Gemini 2.5 모델 비교

### Gemini 2.5 Pro
- **특징**: 고성능 추론 및 복잡한 분석 작업에 최적화
- **속도**: 느림 (10-20초)
- **정확도**: 매우 높음
- **적합한 용도**: 심층 평가, 복잡한 상담 분석, 상세한 피드백
- **비용**: 중간 ($0.0005/1K input, $0.001/1K output)

### Gemini 2.5 Flash
- **특징**: 빠른 응답과 효율적인 처리에 최적화
- **속도**: 빠름 (2-5초)
- **정확도**: 높음
- **적합한 용도**: 실시간 평가, 대량 처리, 빠른 피드백
- **비용**: 낮음 ($0.0001/1K input, $0.0002/1K output)

### 모델 선택 가이드
```env
# 정확도를 최우선으로 하는 경우
GEMINI_MODEL=gemini-2.5-pro

# 속도와 비용 효율성을 중시하는 경우 (기본값)
GEMINI_MODEL=gemini-2.5-flash
```

## 📈 성능 최적화

- **병렬 처리**: 여러 상담원 데이터 동시 분석
- **캐싱**: 반복 분석 결과 캐싱으로 응답 속도 향상
- **배치 처리**: 대량 데이터 효율적 처리
- **자동 정리**: 30일 이상 된 데이터 자동 아카이빙
- **GPT-5 최적화**: Responses API 활용으로 토큰 사용량 감소

## 🔒 보안 및 개인정보 보호

- API 키 환경 변수 관리
- 상담 데이터 암호화 저장
- 접근 권한 관리
- 개인정보 마스킹 처리

## 📝 라이선스

이 프로젝트는 비공개 소프트웨어입니다. 무단 복제 및 배포를 금지합니다.

## 👥 개발팀

핀다 CX팀 & 기술팀

## 📞 문의사항

프로젝트 관련 문의사항은 CX팀 담당자에게 연락 바랍니다.