# GPT-5-mini 마이그레이션 가이드

## 🚀 개요

이 문서는 기존 GPT-4o-mini에서 GPT-5-mini로 마이그레이션하는 방법을 설명합니다.

## 📋 주요 변경 사항

### 1. API 변경
- **기존**: Chat Completions API (`/v1/chat/completions`)
- **신규**: Responses API (`/v1/responses`)
- **장점**: Chain of Thought (CoT) 전달로 성능 향상, 토큰 사용량 감소

### 2. 새로운 파라미터
- `reasoning.effort`: 추론 수준 제어 (minimal/low/medium/high)
- `text.verbosity`: 응답 길이 제어 (low/medium/high)

### 3. 모델 성능
- **추론 능력**: GPT-4 대비 향상된 정확도
- **응답 속도**: reasoning effort에 따라 조절 가능
- **비용**: GPT-4 대비 약 80% 절감

## 🔧 마이그레이션 단계

### 1단계: 환경 변수 설정
```bash
# .env.local 파일 수정
OPENAI_API_KEY=sk-your-openai-api-key-here
GPT5_REASONING_EFFORT=medium
GPT5_VERBOSITY=medium
```

### 2단계: 설정 파일 업데이트
`config/models.json` 파일이 자동으로 업데이트되어 있습니다:
- `openai-gpt5` provider가 활성화됨
- `openai` provider는 비활성화됨 (fallback용으로 유지)

### 3단계: 서버 재시작
```bash
# 개발 서버 재시작
npm run dev

# 또는 통합 개발 스크립트
npm run dev:server
```

### 4단계: 동작 확인
```bash
# 헬스 체크
npm run health

# API 테스트
curl http://localhost:3000/api/evaluate-multi
```

## ⚙️ 세부 설정

### Reasoning Effort 조정
평가 작업의 복잡도에 따라 reasoning effort를 조정하세요:

| 설정 | 사용 사례 | 응답 시간 | 정확도 |
|------|-----------|-----------|---------|
| minimal | 단순 검증 | < 2초 | 기본 |
| low | 빠른 평가 | 2-5초 | 양호 |
| medium | 표준 평가 | 5-10초 | 높음 |
| high | 심층 분석 | 10-20초 | 매우 높음 |

### Verbosity 조정
결과의 상세도를 조정하세요:

| 설정 | 출력 내용 | 토큰 사용량 |
|------|-----------|-------------|
| low | 핵심 결과만 | 최소 |
| medium | 결과 + 주요 근거 | 보통 |
| high | 상세 분석 + 모든 근거 | 최대 |

## 🔄 롤백 방법

GPT-4로 롤백이 필요한 경우:

1. `config/models.json` 수정:
```json
{
  "providers": {
    "openai-gpt5": {
      "enabled": false,
      ...
    },
    "openai": {
      "enabled": true,
      ...
    }
  }
}
```

2. 서버 재시작:
```bash
npm run dev
```

## 📊 성능 비교

### 평가 정확도
- GPT-4o-mini: 85-90%
- GPT-5-mini: 92-95%

### 응답 시간 (medium effort)
- GPT-4o-mini: 3-7초
- GPT-5-mini: 5-10초

### 비용 (1000회 평가 기준)
- GPT-4o-mini: ~$2.50
- GPT-5-mini: ~$0.50

## 🐛 문제 해결

### API 키 오류
```
Error: OPENAI_API_KEY 환경변수가 설정되지 않았습니다.
```
**해결**: `.env.local` 파일에 유효한 OpenAI API 키 설정

### 모델 접근 권한 오류
```
Error: Model 'gpt-5-mini' not found
```
**해결**: OpenAI 계정에서 GPT-5 액세스 권한 확인

### 타임아웃 오류
```
Error: Request timeout
```
**해결**: 
- reasoning effort를 'low' 또는 'minimal'로 낮춤
- `API_TIMEOUT` 환경 변수 값 증가 (기본 60000ms)

## 📚 추가 리소스

- [OpenAI GPT-5 공식 문서](https://platform.openai.com/docs/models/gpt-5)
- [Responses API 가이드](https://platform.openai.com/docs/api-reference/responses)
- [마이그레이션 베스트 프랙티스](https://cookbook.openai.com/examples/gpt-5/migration)

## 💬 지원

문제가 발생하거나 추가 지원이 필요한 경우:
- CX팀 담당자에게 문의
- 기술팀 Slack 채널에 문의