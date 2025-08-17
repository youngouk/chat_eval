# Gemini 2.5 모델 사용 가이드

## 🚀 개요

이 문서는 Google Gemini 2.5 Pro와 Flash 모델을 활용하는 방법을 설명합니다.

## 📋 지원 모델

### 1. Gemini 2.5 Pro (`gemini-2.5-pro`)
- **모델 코드**: `models/gemini-2.5-pro`
- **특징**: 고성능 추론 및 복잡한 분석 작업에 최적화
- **성능**: 
  - 속도: 느림 (10-20초)
  - 정확도: 매우 높음 (95%+)
  - 비용: 중간
- **적합한 용도**:
  - 심층적인 상담 품질 분석
  - 복잡한 고객 요구사항 평가
  - 상세한 개선 방안 제시
  - 문화적 감수성이 필요한 평가

### 2. Gemini 2.5 Flash (`gemini-2.5-flash`)
- **모델 코드**: `models/gemini-2.5-flash`
- **특징**: 빠른 응답과 효율적인 처리에 최적화
- **성능**:
  - 속도: 빠름 (2-5초)
  - 정확도: 높음 (90%+)
  - 비용: 낮음
- **적합한 용도**:
  - 실시간 상담 평가
  - 대량 데이터 처리
  - 빠른 피드백 제공
  - 일반적인 상담 품질 평가

## ⚙️ 설정 방법

### 1. 환경 변수 설정

`.env.local` 파일에 다음 설정을 추가하세요:

```env
# Google AI API 키 (필수)
GOOGLE_AI_API_KEY=your-google-ai-api-key-here

# Gemini 2.5 모델 선택
GEMINI_MODEL=gemini-2.5-flash  # 또는 gemini-2.5-pro

# Gemini 설정 (선택사항)
GEMINI_TOP_P=0.95
GEMINI_TOP_K=40
```

### 2. 모델 선택 가이드

#### 정확도 우선
```env
GEMINI_MODEL=gemini-2.5-pro
```
- 복잡한 상담 시나리오
- 상세한 분석이 필요한 경우
- 높은 품질의 피드백 요구

#### 속도 우선
```env
GEMINI_MODEL=gemini-2.5-flash
```
- 실시간 처리가 필요한 경우
- 대량 데이터 처리
- 빠른 결과 확인

### 3. 동적 모델 전환

모델 선택기를 사용하여 런타임에 모델을 변경할 수 있습니다:

```typescript
import { getModelById, convertToProviderConfig } from '@/lib/utils/model-selector';

// Gemini 2.5 Pro 사용
const proModel = getModelById('gemini-25-pro');
const proConfig = convertToProviderConfig(proModel);

// Gemini 2.5 Flash 사용
const flashModel = getModelById('gemini-25-flash');
const flashConfig = convertToProviderConfig(flashModel);
```

## 📊 성능 비교

| 기준 | Gemini 2.5 Pro | Gemini 2.5 Flash |
|------|----------------|-------------------|
| **응답 시간** | 10-20초 | 2-5초 |
| **정확도** | 매우 높음 (95%+) | 높음 (90%+) |
| **비용 (1K 토큰)** | Input: $0.0005<br>Output: $0.001 | Input: $0.0001<br>Output: $0.0002 |
| **토큰 효율성** | 보통 | 높음 |
| **동시 처리** | 제한적 | 우수 |

## 🎯 사용 시나리오

### Gemini 2.5 Pro 권장 시나리오

1. **VIP 고객 상담 분석**
   - 높은 정확도가 필요한 중요 고객
   - 상세한 분석 보고서 작성

2. **복잡한 문제 상황**
   - 다중 이슈가 얽힌 상담
   - 감정적으로 민감한 상황

3. **품질 감사**
   - 정기적인 상담 품질 감사
   - 교육용 케이스 스터디

### Gemini 2.5 Flash 권장 시나리오

1. **일반 상담 평가**
   - 일상적인 상담 품질 체크
   - 빠른 피드백이 필요한 경우

2. **대량 처리**
   - 월간/분기별 대량 데이터 분석
   - 배치 처리 작업

3. **실시간 모니터링**
   - 실시간 상담 품질 모니터링
   - 즉시 개선이 필요한 상황

## 🔧 고급 설정

### Top-P 설정
응답의 다양성을 제어합니다:
```env
# 보수적인 응답 (낮은 다양성)
GEMINI_TOP_P=0.8

# 균형잡힌 응답 (기본값)
GEMINI_TOP_P=0.95

# 창의적인 응답 (높은 다양성)
GEMINI_TOP_P=0.99
```

### Top-K 설정
고려할 토큰 수를 제한합니다:
```env
# 보수적인 선택
GEMINI_TOP_K=20

# 균형잡힌 선택 (기본값)
GEMINI_TOP_K=40

# 다양한 선택
GEMINI_TOP_K=100
```

## 💰 비용 최적화

### 1. 모델 선택 최적화
```typescript
// 비용 효율적인 평가를 위한 모델 선택
const costEffectiveModels = getRecommendedModels('cost');
// 결과: [Gemini 2.5 Flash, GPT-5-mini]
```

### 2. 배치 처리
```typescript
// 대량 처리 시 Flash 모델 사용
if (chatSessions.length > 100) {
  // Gemini 2.5 Flash 사용
  const flashConfig = convertToProviderConfig(
    getModelById('gemini-25-flash')
  );
}
```

### 3. 하이브리드 접근
```typescript
// 첫 번째 평가는 Flash로, 문제가 있는 경우 Pro로 재평가
const initialResult = await evaluateWithFlash(session);
if (initialResult.problematic || initialResult.score < threshold) {
  const detailedResult = await evaluateWithPro(session);
}
```

## 🐛 문제 해결

### API 키 오류
```
Error: GOOGLE_AI_API_KEY 환경변수가 설정되지 않았습니다.
```
**해결**: Google AI Studio에서 API 키 생성 후 환경 변수 설정

### 모델 접근 권한 오류
```
Error: Model 'gemini-2.5-pro' not found
```
**해결**: 
1. API 키 권한 확인
2. 모델명 확인 (`models/` 접두사 포함)
3. 지역 가용성 확인

### 응답 파싱 오류
```
Error: Gemini 2.5 응답 파싱 오류
```
**해결**:
1. JSON 형식 응답 요청 확인
2. Safety 설정 검토
3. 프롬프트 길이 조정

### 속도 최적화
```typescript
// Flash 모델 사용 시 더 빠른 응답
const fastConfig = {
  model: 'models/gemini-2.5-flash',
  top_k: 20,  // 더 제한적인 선택
  max_tokens: 2000  // 토큰 수 제한
};
```

## 📚 추가 리소스

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API 문서](https://ai.google.dev/docs)
- [모델 성능 벤치마크](https://ai.google.dev/models/gemini)
- [비용 계산기](https://ai.google.dev/pricing)

## 💬 지원

Gemini 모델 관련 문제가 발생하거나 추가 지원이 필요한 경우:
- CX팀 담당자에게 문의
- 기술팀 Slack 채널에 문의
- 프로젝트 이슈 트래커 활용