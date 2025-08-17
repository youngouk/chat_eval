# 📄 제품 요구사항 문서 (PRD)
## Multi-LLM 상담 평가 시스템 MVP

---

## 📌 문서 정보

| 항목 | 내용 |
|------|------|
| **문서 버전** | 2.0 |
| **작성일** | 2024-01-15 |
| **최종 수정** | 2024-01-16 |
| **작성자** | CX Team / Tech Team |
| **프로젝트명** | Multi-LLM 상담 평가 시스템 |
| **프로젝트 유형** | MVP (내부 도구) |
| **예상 개발 기간** | 2주 |
| **우선순위** | High |

---

## 🎯 1. 제품 개요

### 1.1 배경 및 문제점

현재 핀다 CX팀은 상담 품질 평가를 위해 OpenAI GPT-4 단일 모델에 의존하고 있습니다. 이로 인해:

- **일관성 부족**: Temperature 0.3 설정으로 동일 상담에 대한 평가 점수가 변동 (표준편차 0.4)
- **검증 불가**: 단일 AI의 평가를 교차 검증할 방법 없음
- **운영 비효율**: 평가 기준 변경 시 코드 수정 필요
- **편향 위험**: 단일 모델의 편향이 평가에 반영될 가능성
- **확장성 제한**: 모델 업그레이드나 변경 시 시스템 전체 수정 필요

### 1.2 목표

**핵심 목표**: 5-Layer 아키텍처 기반 Multi-LLM 교차 검증으로 평가 일관성을 95% 이상 확보

**세부 목표**:
1. **GPT-4o-mini + Gemini 2.0 Pro** 병렬 평가 체계 구축
2. 평가 점수 **표준편차 0.2 이하**로 일관성 확보
3. **Layer 기반 모듈화**로 확장성 및 유지보수성 향상
4. **JSON 기반 Hot-Reload** 설정 관리로 운영 효율성 극대화
5. **IQR 방식 이상치 탐지**로 신뢰도 95% 이상 달성

### 1.3 대상 사용자

- **주 사용자**: 핀다 CX팀 매니저 (1명)
- **부 사용자**: CX팀 상담원 (10명)
- **사용 빈도**: 일 평균 100건 평가 (월 2,000건)

### 1.4 범위 및 제약사항

**포함 범위**:
- **5-Layer 아키텍처** 기반 Multi-LLM 평가 엔진
- **Strategy Pattern** 기반 Provider 추상화
- **교차 검증 알고리즘** (표준편차 + IQR 이상치 탐지)
- **실시간 모니터링** 대시보드
- **버전 관리** 가능한 JSON 설정 시스템

**제외 범위** (MVP):
- 실시간 스트리밍
- 고급 캐싱 시스템 (Redis/Memcached)
- 보안 강화 (내부 도구)
- A/B 테스트 기능
- 머신러닝 기반 자동 튜닝

---

## 📋 2. 기능 요구사항

### 2.1 핵심 기능

#### F1. Multi-LLM 평가 실행
**설명**: 5-Layer 아키텍처 기반으로 하나의 상담을 여러 LLM으로 병렬 평가

**상세 요구사항**:
- **GPT-4o-mini**와 **Gemini 2.0 Pro** 병렬 호출 (Promise.allSettled 사용)
- **Strategy Pattern** 기반 Provider 추상화로 확장성 확보
- Temperature 0.1 고정으로 일관성 극대화
- **지수 백오프** 재시도 메커니즘 (최대 3회, 1s → 2s → 4s)
- **Circuit Breaker** 패턴으로 장애 전파 방지

**아키텍처 상세**:
```
[Presentation Layer] → [Application Layer] → [Integration Layer]
                                                    ↓
                    [Domain Layer] ← [Data Layer]
```

**수용 기준**:
- [ ] 2개 이상 LLM에서 평가 결과 수신
- [ ] **응답 시간 5초 이내** (각 LLM별 타임아웃 5초, 전체 10초)
- [ ] 한 LLM 실패해도 나머지로 평가 완료
- [ ] **표준편차 0.2 이하**로 일관성 확보
- [ ] Provider 추가 시 10분 내 통합 가능

#### F2. 교차 검증 및 결과 통합
**설명**: IQR 방식 이상치 탐지와 가중 평균을 통한 신뢰도 높은 결과 통합

**상세 요구사항**:
- **3단계 검증 프로세스**:
  - Stage 1: 개별 결과 검증 (점수 범위, JSON 구조)
  - Stage 2: 교차 검증 (표준편차 분석, IQR 이상치 탐지)
  - Stage 3: 점수 통합 (가중 평균, 신뢰도 기반)
- **IQR(Interquartile Range)** 방식으로 이상치 자동 탐지 및 제거
- **신뢰도 점수** 계산 (0~1 범위, 목표: 0.8 이상)
- **일관성 지표**: 1 - (표준편차 / 5.0) 공식 사용

**통합 전략**:
- 기본: 이상치 제외 후 평균
- 가중: 모델별 신뢰도 가중치 적용
- 폴백: 모든 점수가 이상치일 경우 중앙값 사용

**수용 기준**:
- [ ] **신뢰도 0.8 이상** 달성
- [ ] **일관성 0.9 이상** (표준편차 0.5 이하)
- [ ] 이상치 탐지 정확도 95% 이상
- [ ] 통합 점수와 개별 LLM 점수 모두 제공
- [ ] 평가 근거 및 신뢰도 정보 포함

#### F3. 동적 평가 기준 관리
**설명**: Semantic Versioning 기반 JSON 설정의 Hot-Reload 시스템

**상세 요구사항**:
- **계층화된 설정 구조**:
  ```
  evaluation-config/
  ├── criteria/v1.0.json (현재 활성)
  ├── prompts/base-template.txt
  └── thresholds/scoring.json
  ```
- **Hot-Reload 메커니즘**: 파일 변경 감지 시 자동 리로드 (chokidar 사용)
- **Semantic Versioning**: Major.Minor.Patch 버전 관리
- **자동 Rollback**: 오류 발생 시 이전 버전 자동 복구
- **프롬프트 템플릿**: LLM별 최적화된 프롬프트 관리

**설정 요소**:
- 평가 기준 가중치 (업무능력 0.6, 문장력 0.25, 기본태도 0.15)
- 문제 상담 임계값 (총점 3.8, 상대적 0.3점 차이)
- LLM별 프롬프트 템플릿
- 이상치 탐지 파라미터

**수용 기준**:
- [ ] **Hot-Reload 5초 이내** 반영
- [ ] 설정 오류 시 **자동 Rollback** 동작
- [ ] 변경 이력 **완전 추적** 가능
- [ ] **버전 간 마이그레이션** 지원
- [ ] LLM별 프롬프트 **동적 생성**

### 2.2 부가 기능

#### F4. 비용 모니터링
**설명**: API 사용 비용 추적

**상세 요구사항**:
- LLM별 토큰 사용량 기록
- 일별 비용 집계
- 비용 임계값 알림

**수용 기준**:
- [ ] 실시간 비용 표시
- [ ] 일/월 단위 집계
- [ ] CSV 내보내기

#### F5. 평가 이력 조회
**설명**: 과거 평가 결과 조회

**상세 요구사항**:
- 상담원별 평가 이력
- 날짜별 필터링
- 일관성 추이 그래프

**수용 기준**:
- [ ] 최근 30일 데이터 조회
- [ ] 검색 응답 1초 이내
- [ ] Excel 다운로드

---

## 🔧 3. 기술 요구사항

### 3.1 시스템 아키텍처

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Next.js   │────▶│  Evaluation  │────▶│   LLM APIs  │
│   Frontend  │     │   Service    │     │             │
└─────────────┘     └──────────────┘     ├─────────────┤
                            │             │   OpenAI    │
                            │             ├─────────────┤
                    ┌──────────────┐     │   Gemini    │
                    │   Validator  │◀────└─────────────┘
                    └──────────────┘
                            │
                    ┌──────────────┐
                    │    Results   │
                    └──────────────┘
```

### 3.2 시스템 아키텍처

#### 5-Layer 아키텍처 상세
```
┌─────────────────────────────────────────────────┐
│            Presentation Layer                    │
│         (Next.js UI / Dashboard)                 │
├─────────────────────────────────────────────────┤
│            Application Layer                     │
│  (Evaluation Orchestrator / Business Logic)     │
├─────────────────────────────────────────────────┤
│            Integration Layer                     │
│     (LLM Provider Adapters / External APIs)     │
├─────────────────────────────────────────────────┤
│            Domain Layer                          │
│  (Validation Engine / Consistency Algorithms)   │
├─────────────────────────────────────────────────┤
│            Data Layer                            │
│    (Config Management / Result Storage)         │
└─────────────────────────────────────────────────┘
```

#### 데이터 플로우
```
[Excel Upload] → [Data Parser] → [Session Builder]
       ↓
[Evaluation Orchestrator] → [Provider Registry]
       ↓                          ↓
[Request Builder] → [GPT-4o-mini] [Gemini 2.0 Pro]
       ↓                          ↓
[Response Parser] ← [API Responses]
       ↓
[Consistency Validator] → [IQR Outlier Detector]
       ↓
[Score Aggregator] → [Dashboard UI]
```

### 3.3 기술 스택

| 구분 | 기술 | 버전 | 용도 | 변경사항 |
|------|------|------|------|----------|
| **Frontend** | Next.js | 14.2 | 기존 유지 | - |
| **Backend** | Next.js API Routes | 14.2 | 기존 유지 | - |
| **LLM** | OpenAI API | **GPT-4o-mini** | 주 평가 | 모델 변경 |
| **LLM** | Google Gemini | **2.0 Pro** | 교차 검증 | 신규 추가 |
| **설정** | JSON + chokidar | - | Hot-Reload | 기능 강화 |
| **모니터링** | Console + Dashboard | - | 실시간 추적 | UI 추가 |
| **패턴** | Strategy + Factory | - | Provider 추상화 | 신규 |
| **검증** | IQR + 표준편차 | - | 이상치 탐지 | 신규 |

### 3.3 API 명세

#### 3.3.1 Multi-LLM 평가 API

**Endpoint**: `POST /api/evaluate-multi`

**Request**:
```json
{
  "chatId": "chat_123",
  "sessionData": {
    "managerId": "5",
    "messages": [
      {
        "type": "manager",
        "text": "안녕하세요. 무엇을 도와드릴까요?",
        "timestamp": "2024-01-15T10:00:00Z"
      }
    ],
    "metadata": {
      "device": "mobile",
      "channel": "app",
      "duration": 300
    }
  },
  "config": {
    "useMultiLLM": true,
    "criteriaVersion": "1.0",
    "providers": ["openai", "gemini"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "evaluation": {
    "scores": {
      "업무능력": {
        "value": 4.5,
        "subcriteria": {
          "고객질문_파악": 4.6,
          "해결_적극성": 4.4,
          "답변_정확성": 4.5,
          "전문성": 4.4,
          "신속성": 4.6,
          "공감능력": 4.5
        }
      },
      "문장력": { "value": 4.2 },
      "기본태도": { "value": 4.8 },
      "총점": 4.5
    },
    "validation": {
      "consistency": 0.92,
      "confidence": 0.87,
      "reliability": "high",
      "outliers": []
    },
    "providers": [
      {
        "name": "openai",
        "model": "gpt-4o-mini",
        "scores": { "업무능력": 4.6, "문장력": 4.3, "기본태도": 4.8 },
        "responseTime": 1234,
        "tokens": 1850,
        "cost": 0.0185
      },
      {
        "name": "gemini",
        "model": "gemini-2.0-pro",
        "scores": { "업무능력": 4.4, "문장력": 4.1, "기본태도": 4.8 },
        "responseTime": 987,
        "tokens": 1650,
        "cost": 0.0041
      }
    ],
    "evidence": {
      "positive": ["친절한 인사", "명확한 안내", "빠른 응답"],
      "negative": ["일부 전문 용어 부족"],
      "quotes": ["안녕하세요. 무엇을 도와드릴까요?"],
      "improvements": ["금융 전문 용어 활용 강화"]
    }
  },
  "metadata": {
    "criteriaVersion": "1.0",
    "processingTime": 2.1,
    "timestamp": "2024-01-15T10:00:05Z"
  }
}
```

#### 3.3.2 설정 조회 API

**Endpoint**: `GET /api/config/evaluation`

**Response**:
```json
{
  "version": "4.3",
  "criteria": {
    "업무능력": { "weight": 0.6 },
    "문장력": { "weight": 0.25 },
    "기본태도": { "weight": 0.15 }
  },
  "thresholds": {
    "problematic": 3.8,
    "excellent": 4.6
  }
}
```

### 3.4 데이터 모델

#### 평가 결과 스키마
```typescript
interface Evaluation {
  id: string;
  chatId: string;
  managerId: string;
  timestamp: Date;
  scores: {
    업무능력: ScoreDetail;
    문장력: ScoreDetail;
    기본태도: ScoreDetail;
    총점: number;
  };
  providers: ProviderResult[];
  consistency: number;
  confidence: number;
  evidence: Evidence;
}

interface ScoreDetail {
  value: number;
  subcriteria: Record<string, number>;
}

interface ProviderResult {
  name: string;
  model: string;
  scores: Record<string, number>;
  responseTime: number;
  tokens: number;
  cost: number;
}
```

### 3.5 성능 요구사항

| 항목 | 목표값 | 측정 방법 |
|------|--------|-----------|
| **응답 시간** | < 5초 | 95 percentile |
| **동시 처리** | 10건 | 병렬 요청 |
| **가용성** | 99% | 업타임 |
| **일관성** | > 90% | 표준편차 |

---

## 🎨 4. UI/UX 요구사항

### 4.1 평가 실행 화면

```
┌─────────────────────────────────────┐
│      Multi-LLM 상담 평가           │
├─────────────────────────────────────┤
│                                     │
│  [파일 선택]  [평가 시작]          │
│                                     │
│  ┌─────────────────────────┐       │
│  │ 진행 상태               │       │
│  │ ▶ OpenAI: 완료 (1.2초)  │       │
│  │ ▶ Gemini: 완료 (0.9초)  │       │
│  │ ▶ 통합중...            │       │
│  └─────────────────────────┘       │
│                                     │
│  평가 결과                          │
│  ┌─────────────────────────┐       │
│  │ 총점: 4.5 / 5.0         │       │
│  │ 일관성: 92%             │       │
│  │                         │       │
│  │ [상세보기] [다운로드]   │       │
│  └─────────────────────────┘       │
└─────────────────────────────────────┘
```

### 4.2 모니터링 대시보드

```
┌─────────────────────────────────────┐
│        평가 시스템 모니터링         │
├─────────────────────────────────────┤
│                                     │
│  오늘의 통계                        │
│  ┌──────────┬──────────┐           │
│  │ 평가 건수 │   523    │           │
│  │ 평균 일관성│   91.2%  │           │
│  │ API 비용  │  $12.34  │           │
│  └──────────┴──────────┘           │
│                                     │
│  Provider별 응답시간                │
│  OpenAI: ████████ 1.5s             │
│  Gemini: ██████   1.1s             │
│                                     │
└─────────────────────────────────────┘
```

---

## 📅 5. 구현 계획

### 5.1 개발 일정 (2주)

#### Week 1: 5-Layer 아키텍처 구축
| 일차 | 레이어/작업 | 담당 | 완료 기준 |
|------|-------------|------|-----------|
| **D1** | Data Layer | Backend Dev | JSON 설정 Hot-Reload 동작 |
| **D2** | Integration Layer | Backend Dev | GPT-4o-mini + Gemini 2.0 Pro 연동 |
| **D3** | Domain Layer | Backend Dev | IQR 이상치 탐지 + 표준편차 검증 |
| **D4** | Application Layer | Backend Dev | Evaluation Orchestrator 완성 |
| **D5** | Integration Test | QA | 5-Layer 통합 테스트 통과 |

#### Week 2: UI 및 최적화
| 일차 | 작업 | 담당 | 완료 기준 |
|------|------|------|-----------|
| **D6** | Presentation Layer | Frontend Dev | Multi-LLM 평가 UI 완성 |
| **D7** | 모니터링 대시보드 | Frontend Dev | 실시간 메트릭 표시 |
| **D8** | 성능 최적화 | Backend Dev | 응답 시간 5초 이내 달성 |
| **D9** | E2E 테스트 | QA | 전체 시나리오 검증 완료 |
| **D10** | 배포 및 모니터링 | DevOps | Production 안정성 확인 |

#### 상세 작업 계획
**Data Layer (D1)**:
- chokidar 기반 파일 감시 시스템
- Semantic Versioning 스키마 설계
- 자동 Rollback 메커니즘

**Integration Layer (D2)**:
- Strategy Pattern Provider 추상화
- Circuit Breaker 패턴 구현
- 지수 백오프 재시도 로직

**Domain Layer (D3)**:
- IQR 방식 이상치 탐지 알고리즘
- 3단계 검증 프로세스
- 신뢰도 점수 계산 엔진

**Application Layer (D4)**:
- Multi-LLM 오케스트레이션
- 병렬 처리 (Promise.allSettled)
- 결과 통합 및 가중 평균

### 5.2 마일스톤

| 마일스톤 | 날짜 | 산출물 |
|----------|------|--------|
| **M1: 백엔드 완료** | D5 | Multi-LLM API 동작 |
| **M2: MVP 완성** | D9 | 전체 기능 구현 |
| **M3: 배포** | D10 | Production 운영 |

---

## ✅ 6. 승인 기준

### 6.1 기능 검증

- [ ] 2개 LLM 동시 평가 성공
- [ ] 평가 일관성 90% 이상
- [ ] 응답 시간 5초 이내
- [ ] 설정 파일 변경 즉시 반영

### 6.2 품질 기준

- [ ] 주요 시나리오 테스트 100% 통과
- [ ] 에러율 1% 미만
- [ ] 사용자 피드백 반영

### 6.3 배포 조건

- [ ] 스테이징 환경 테스트 완료
- [ ] 롤백 계획 수립
- [ ] 모니터링 설정 완료

---

## 🚨 7. 리스크 및 대응

### 7.1 기술적 리스크

| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|-----------|
| LLM API 장애 | 중 | 높음 | 단일 LLM 폴백 모드 |
| 응답 지연 | 중 | 중 | 타임아웃 설정 (5초) |
| 비용 초과 | 낮음 | 중 | 일일 한도 설정 |

### 7.2 일정 리스크

| 리스크 | 대응 방안 |
|--------|-----------|
| 개발 지연 | 부가 기능 다음 단계로 연기 |
| 테스트 이슈 | 핫픽스로 운영 중 수정 |

---

## 📊 8. 성공 지표

### 8.1 정량적 지표 (출시 후 1개월)

| KPI | 목표 | 현재 | 측정 방법 | 개선율 |
|-----|------|------|-----------|--------|
| **평가 일관성** | > 95% | 85% | 표준편차 0.2 이하 | +11.8% |
| **신뢰도 점수** | > 0.8 | 0.6 | IQR 기반 신뢰도 | +33.3% |
| **재평가 요청** | < 5% | 15% | 티켓 시스템 | -66.7% |
| **처리 시간** | < 5초 | 7초 | API 응답 로그 | -28.6% |
| **이상치 탐지** | > 95% | N/A | IQR 정확도 | 신규 |
| **비용 최적화** | 30% 절감 | 기준 | 토큰 사용량 추적 | 신규 |

#### 상세 측정 지표
**일관성 측정**:
- 표준편차: σ < 0.2 (5점 만점 기준)
- 변동계수: CV < 5%
- 일관성 점수: 1 - (σ/5) > 0.96

**신뢰도 측정**:
- IQR 기반 이상치 비율 < 5%
- Provider 간 점수 차이 < 0.3점
- 신뢰도 점수 0.8 이상

### 8.2 정성적 지표

- CX팀 만족도 조사 (5점 만점 4점 이상)
- 평가 신뢰도 향상 피드백
- 운영 효율성 개선 체감

---

## 📝 9. 부록

### 9.1 용어 정의

| 용어 | 설명 |
|------|------|
| **LLM** | Large Language Model (대규모 언어 모델) |
| **Cross Validation** | 교차 검증 |
| **Consistency Score** | 평가 일관성 점수 (0~1) |
| **Provider** | LLM 서비스 제공자 (OpenAI, Google) |

### 9.2 참고 자료

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Google Gemini API Guide](https://ai.google.dev)
- 기존 평가 시스템 운영 데이터

### 9.3 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0 | 2024-01-15 | CX/Tech Team | 초안 작성 |

---

## 📋 10. 체크리스트

### 개발 착수 전
- [ ] API Key 발급 완료
- [ ] 개발 환경 구성
- [ ] 테스트 데이터 준비

### 개발 완료 조건
- [ ] 모든 필수 기능 구현
- [ ] 테스트 시나리오 통과
- [ ] 문서 업데이트

### 배포 준비
- [ ] Production 환경 설정
- [ ] 모니터링 도구 설정
- [ ] 사용자 교육 자료

---

**문서 승인**

| 역할 | 이름 | 서명 | 날짜 |
|------|------|------|------|
| Product Owner | CX Team Lead | | |
| Tech Lead | | | |
| QA Lead | | | |

---

*본 PRD는 핀다 CX팀 Multi-LLM 상담 평가 시스템 MVP 개발을 위한 공식 요구사항 문서입니다.*

*MVP 특성상 복잡도를 최소화하고 핵심 기능에 집중하여 빠른 출시를 목표로 합니다.*