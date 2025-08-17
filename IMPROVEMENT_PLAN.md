# 📋 핀다 CX 상담 평가 시스템 개선 기획서

## 📌 Executive Summary

### 프로젝트명
Multi-LLM 기반 상담 평가 일관성 강화 프로젝트

### 목적
- 평가 일관성을 85%에서 95%로 향상
- Multi-LLM 교차 검증을 통한 평가 신뢰도 확보
- 설정 기반 관리로 운영 효율성 극대화

### 기간
2024년 1월 15일 ~ 2024년 2월 15일 (4주)

### 예상 효과
- 평가 편차 60% 감소
- 운영 비용 30% 절감
- 평가 신뢰도 40% 향상

---

## 🔍 1. AS-IS 현황 분석

### 1.1 시스템 구조

#### 현재 아키텍처
```
[Excel Upload] → [Next.js API] → [OpenAI GPT-4] → [평가 결과]
```

#### 핵심 파일 구조
```
app/api/
├── analyze-individual/route.ts    # 개별 평가 (temperature: 0.3)
├── analyze-comprehensive/route.ts # 종합 평가 (temperature: 0.1)
├── analyze-individual-new/route.ts # 신규 평가 (temperature: 0.3)
└── analyze-counselor-comprehensive/route.ts # 상담원 종합
```

### 1.2 현재 평가 프로세스

#### 단일 LLM 평가
```typescript
// 현재 코드 (analyze-individual/route.ts)
async function callOpenAI(prompt: string, apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "chatgpt-4o-latest",
      messages: [
        {
          role: "system",
          content: "당신은 핀다 CX팀의 종합 분석을 수행하는 AI 시스템입니다.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,  // ⚠️ 일관성 문제
      max_tokens: 1500,
    }),
  })
  // 에러 처리 미흡
  if (!response.ok) {
    throw new Error(`OpenAI API 오류: ${response.status}`)
  }
  return response.json()
}
```

### 1.3 주요 문제점

| 영역 | 문제점 | 영향도 | 심각도 |
|------|--------|--------|--------|
| **일관성** | Temperature 0.3으로 변동성 존재 | 높음 | 🔴 Critical |
| **단일 의존성** | OpenAI API만 사용 | 높음 | 🔴 Critical |
| **프롬프트 관리** | 하드코딩된 프롬프트 | 중간 | 🟡 Major |
| **에러 처리** | 재시도 메커니즘 부재 | 중간 | 🟡 Major |
| **비용 관리** | 비용 추적 시스템 없음 | 낮음 | 🟢 Minor |
| **검증 체계** | 평가 결과 검증 불가 | 높음 | 🔴 Critical |

### 1.4 현재 평가 기준

```javascript
// 하드코딩된 평가 기준 (page.tsx)
const DEFAULT_GUIDELINES = `
⚠️ CRITICAL RULES (절대 준수)
1. 평가 대상: 오직 '상담원'의 메시지만 평가
2. 자동 메시지 완전 제외
3. 서포트봇 메시지 제외
4. 상황 공감 = 상황 파악 + 해결 방향 제시
5. 문제 파악 적극 노력 = 필수 가점 요소
6. 점수 다양성 확보 (1.0-5.0 전 범위 활용)
`
```

---

## 🎯 2. TO-BE 목표 상태

### 2.1 개선된 시스템 구조

#### 새로운 아키텍처
```
[Excel Upload] → [Next.js API] → [Multi-LLM Orchestrator]
                                          ↓
                              [OpenAI] [Gemini] [Claude*]
                                          ↓
                                  [Cross Validator]
                                          ↓
                                    [평가 결과]
```

### 2.2 Multi-LLM 평가 체계

#### LLM Provider 추상화
```typescript
// lib/llm/providers/base.ts
export interface LLMProvider {
  name: string;
  model: string;
  evaluate(prompt: string): Promise<EvaluationResult>;
  getCost(tokens: number): number;
}

// lib/llm/providers/openai.ts
export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  
  async evaluate(prompt: string): Promise<EvaluationResult> {
    return withRetry(async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.1,  // ✅ 일관성 강화
          seed: 42,          // ✅ 재현 가능성
          messages: [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });
      
      if (!response.ok) {
        throw new APIError(`OpenAI API error: ${response.status}`);
      }
      
      return this.parseResponse(await response.json());
    }, 3); // 3회 재시도
  }
  
  getCost(tokens: number): number {
    const rates = {
      'gpt-4-turbo-preview': 0.01,
      'gpt-3.5-turbo': 0.001
    };
    return (tokens / 1000) * rates[this.model];
  }
}
```

### 2.3 교차 검증 시스템

#### Cross Validator 구현
```typescript
// lib/evaluation/cross-validator.ts
export class CrossValidator {
  private providers: LLMProvider[];
  
  constructor() {
    this.providers = [
      new OpenAIProvider(),
      new GeminiProvider(),
      // new ClaudeProvider() // 옵션
    ];
  }
  
  async evaluate(chat: Chat): Promise<ConsolidatedResult> {
    // 병렬 평가
    const evaluations = await Promise.allSettled(
      this.providers.map(provider => 
        this.evaluateWithProvider(chat, provider)
      )
    );
    
    // 성공한 평가만 필터링
    const successful = evaluations
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<Evaluation>).value);
    
    if (successful.length === 0) {
      throw new Error('모든 LLM 평가 실패');
    }
    
    // 교차 검증 및 통합
    return this.consolidateResults(successful);
  }
  
  private consolidateResults(evaluations: Evaluation[]): ConsolidatedResult {
    const scores = {
      업무능력: this.calculateScore(evaluations, '업무능력'),
      문장력: this.calculateScore(evaluations, '문장력'),
      기본태도: this.calculateScore(evaluations, '기본태도')
    };
    
    const consistency = this.calculateConsistency(evaluations);
    const confidence = this.calculateConfidence(evaluations);
    
    return {
      scores,
      totalScore: this.calculateTotalScore(scores),
      consistency,
      confidence,
      providers: evaluations.map(e => ({
        name: e.provider,
        scores: e.scores,
        responseTime: e.responseTime
      })),
      evidence: this.mergeEvidence(evaluations)
    };
  }
  
  private calculateScore(evaluations: Evaluation[], category: string): number {
    const scores = evaluations.map(e => e.scores[category]);
    
    // 이상치 제거 후 평균
    const filtered = this.removeOutliers(scores);
    return filtered.reduce((a, b) => a + b, 0) / filtered.length;
  }
  
  private removeOutliers(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    return values.filter(v => 
      v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr
    );
  }
}
```

### 2.4 설정 기반 평가 기준 관리

#### 외부 설정 파일
```json
// config/evaluation/criteria-v4.3.json
{
  "version": "4.3",
  "lastUpdated": "2024-01-15",
  "author": "CX Team",
  "criteria": {
    "업무능력": {
      "weight": 0.6,
      "subcriteria": {
        "고객_질문_내용_파악": {
          "weight": 0.167,
          "description": "고객의 질문과 요구사항을 정확히 파악",
          "evaluation_points": [
            "질문의 핵심 파악 여부",
            "추가 정보 요청의 적절성",
            "문제 정의의 명확성"
          ]
        },
        "파악_및_해결_적극성": {
          "weight": 0.167,
          "description": "문제 해결을 위한 적극적 노력",
          "evaluation_points": [
            "능동적 해결 시도",
            "대안 제시 여부",
            "follow-up 질문"
          ]
        },
        "답변의_정확성_및_적합성": {
          "weight": 0.167,
          "description": "제공한 정보의 정확성과 적절성",
          "evaluation_points": [
            "정보의 정확성",
            "상황에 맞는 답변",
            "오해의 소지 없음"
          ]
        },
        "도메인_전문성": {
          "weight": 0.167,
          "description": "금융 도메인 지식 활용",
          "evaluation_points": [
            "전문 용어 적절 사용",
            "정확한 프로세스 안내",
            "규정 준수"
          ]
        },
        "신속한_응대": {
          "weight": 0.167,
          "description": "응답 속도와 효율성",
          "evaluation_points": [
            "첫 응답 시간",
            "문제 해결 시간",
            "불필요한 지연 없음"
          ]
        },
        "상황_공감": {
          "weight": 0.167,
          "description": "고객 상황 이해와 공감",
          "evaluation_points": [
            "상황 파악 정확도",
            "해결 방향 제시",
            "고객 입장 고려"
          ]
        }
      }
    },
    "문장력": {
      "weight": 0.25,
      "subcriteria": {
        "정확한_맞춤법": {
          "weight": 0.25,
          "description": "맞춤법과 문법의 정확성"
        },
        "적절한_언어_표현": {
          "weight": 0.25,
          "description": "상황에 맞는 언어 사용"
        },
        "쉬운_표현_사용": {
          "weight": 0.25,
          "description": "이해하기 쉬운 설명"
        },
        "단계별_안내": {
          "weight": 0.25,
          "description": "체계적이고 순차적인 안내"
        }
      }
    },
    "기본_태도": {
      "weight": 0.15,
      "subcriteria": {
        "인사_및_추가_문의": {
          "weight": 0.5,
          "description": "적절한 인사와 추가 도움 제안"
        },
        "양해_표현_사용": {
          "weight": 0.5,
          "description": "불편에 대한 양해 구하기"
        }
      }
    }
  },
  "scoring": {
    "scale": {
      "min": 1.0,
      "max": 5.0,
      "step": 0.1
    },
    "thresholds": {
      "excellent": 4.6,
      "good": 4.2,
      "average": 3.8,
      "poor": 3.0
    },
    "problematic_criteria": {
      "total_score": 3.8,
      "업무능력": 3.5,
      "문장력": 3.0,
      "기본태도": 3.0,
      "relative_threshold": 0.3
    }
  },
  "filters": {
    "exclude_patterns": [
      "15분 자동 메시지",
      "30분 자동 메시지",
      "안녕하세요 고객님, 핀다 고객경험팀"
    ],
    "exclude_tags": [
      "기타_테스트",
      "테스트"
    ],
    "include_tags": [
      "자동종료",
      "수동종료"
    ]
  }
}
```

#### 프롬프트 템플릿 관리
```json
// config/prompts/evaluation-v4.3.json
{
  "version": "4.3",
  "templates": {
    "system": {
      "role": "system",
      "content": "당신은 금융 서비스 고객 상담 품질을 평가하는 전문가입니다. 제공된 평가 기준에 따라 객관적이고 일관성 있는 평가를 수행해야 합니다."
    },
    "user": {
      "role": "user",
      "content": "다음 상담 내용을 평가 기준에 따라 평가해주세요.\n\n평가 기준:\n{{criteria}}\n\n상담 내용:\n{{chat_content}}\n\n다음 JSON 형식으로 응답해주세요:\n{{response_format}}"
    },
    "response_format": {
      "scores": {
        "업무능력": {
          "고객_질문_내용_파악": "number",
          "파악_및_해결_적극성": "number",
          "답변의_정확성_및_적합성": "number",
          "도메인_전문성": "number",
          "신속한_응대": "number",
          "상황_공감": "number",
          "subtotal": "number"
        },
        "문장력": {
          "정확한_맞춤법": "number",
          "적절한_언어_표현": "number",
          "쉬운_표현_사용": "number",
          "단계별_안내": "number",
          "subtotal": "number"
        },
        "기본_태도": {
          "인사_및_추가_문의": "number",
          "양해_표현_사용": "number",
          "subtotal": "number"
        },
        "total_score": "number"
      },
      "evidence": {
        "positive": ["string"],
        "negative": ["string"],
        "quotes": ["string"]
      },
      "problematic": "boolean",
      "severity": "high|medium|low|none"
    }
  }
}
```

---

## 📋 3. 구체적 구현 계획

### 3.1 Phase 1: 기반 구조 개선 (1주차)

#### Task 1.1: LLM Provider 추상화 구현
**파일 생성/수정:**
```typescript
// lib/llm/providers/base.ts (신규)
export interface LLMProvider {
  name: string;
  model: string;
  evaluate(prompt: string): Promise<EvaluationResult>;
  getCost(tokens: number): number;
}

// lib/llm/providers/openai.ts (신규)
export class OpenAIProvider implements LLMProvider {
  // 구현 내용
}

// lib/llm/providers/gemini.ts (신규)
export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  model = process.env.GEMINI_MODEL || 'gemini-pro';
  
  async evaluate(prompt: string): Promise<EvaluationResult> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      }
    );
    
    if (!response.ok) {
      throw new APIError(`Gemini API error: ${response.status}`);
    }
    
    return this.parseResponse(await response.json());
  }
  
  getCost(tokens: number): number {
    return (tokens / 1000) * 0.00025; // Gemini Pro pricing
  }
}
```

#### Task 1.2: 설정 파일 외부화
**파일 생성:**
- `config/evaluation/criteria-v4.3.json`
- `config/prompts/evaluation-v4.3.json`
- `config/models.json`

**환경 변수 추가 (.env.local):**
```bash
# LLM API Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
CLAUDE_API_KEY=... # Optional

# Model Configuration
OPENAI_MODEL=gpt-4-turbo-preview
GEMINI_MODEL=gemini-pro
LLM_TEMPERATURE=0.1
LLM_MAX_TOKENS=2000

# Evaluation Settings
EVALUATION_VERSION=4.3
ENABLE_MULTI_LLM=true
MIN_CONSENSUS_PROVIDERS=2
```

#### Task 1.3: 에러 처리 및 재시도 메커니즘
**파일 생성:**
```typescript
// lib/utils/retry.ts (신규)
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  backoffMs = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        const delay = backoffMs * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed after ${maxRetries} retries: ${lastError.message}`);
}

// lib/errors/api-error.ts (신규)
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public provider?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}
```

### 3.2 Phase 2: Multi-LLM 통합 (2주차)

#### Task 2.1: Cross Validator 구현
**파일 생성:**
```typescript
// lib/evaluation/cross-validator.ts (신규)
import { OpenAIProvider } from '@/lib/llm/providers/openai';
import { GeminiProvider } from '@/lib/llm/providers/gemini';

export class CrossValidator {
  private providers: LLMProvider[];
  
  constructor() {
    this.providers = this.initializeProviders();
  }
  
  private initializeProviders(): LLMProvider[] {
    const providers: LLMProvider[] = [];
    
    if (process.env.OPENAI_API_KEY) {
      providers.push(new OpenAIProvider());
    }
    
    if (process.env.GEMINI_API_KEY) {
      providers.push(new GeminiProvider());
    }
    
    if (providers.length < 2) {
      console.warn('Multi-LLM 모드를 위해서는 최소 2개의 Provider가 필요합니다');
    }
    
    return providers;
  }
  
  // 평가 메서드 구현
}
```

#### Task 2.2: API Route 수정
**파일 수정:**
```typescript
// app/api/analyze-multi/route.ts (신규)
import { NextRequest } from 'next/server';
import { CrossValidator } from '@/lib/evaluation/cross-validator';
import { PromptGenerator } from '@/lib/prompt/generator';

export async function POST(request: NextRequest) {
  try {
    const { chatData, useMultiLLM = true } = await request.json();
    
    if (!chatData) {
      return Response.json({ error: '상담 데이터가 필요합니다' }, { status: 400 });
    }
    
    const validator = new CrossValidator();
    const promptGen = new PromptGenerator();
    
    // 프롬프트 생성
    const prompt = promptGen.generatePrompt(chatData);
    
    // Multi-LLM 평가
    const result = useMultiLLM 
      ? await validator.evaluateWithMultiple(prompt)
      : await validator.evaluateWithSingle(prompt);
    
    return Response.json({
      success: true,
      evaluation: result,
      metadata: {
        version: process.env.EVALUATION_VERSION,
        providers: result.providers,
        consistency: result.consistency,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('평가 오류:', error);
    return Response.json(
      { error: '평가 중 오류가 발생했습니다', details: error.message },
      { status: 500 }
    );
  }
}
```

#### Task 2.3: 기존 Route 마이그레이션
**파일 수정 목록:**
- `app/api/analyze-individual/route.ts`
- `app/api/analyze-comprehensive/route.ts`
- `app/api/analyze-individual-new/route.ts`
- `app/api/analyze-counselor-comprehensive/route.ts`

**수정 내용:**
```typescript
// app/api/analyze-individual/route.ts (수정)
import { CrossValidator } from '@/lib/evaluation/cross-validator';

// AS-IS
async function callOpenAI(prompt: string, apiKey: string) {
  // 기존 코드
}

// TO-BE
async function evaluateChat(chatData: any) {
  const validator = new CrossValidator();
  const result = await validator.evaluate(chatData);
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // 기존 로직 유지하면서 평가 부분만 교체
    const evaluation = await evaluateChat(data.chatData);
    
    return Response.json({
      success: true,
      evaluation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 에러 처리
  }
}
```

### 3.3 Phase 3: 모니터링 및 최적화 (3주차)

#### Task 3.1: 비용 추적 시스템
**파일 생성:**
```typescript
// lib/tracking/cost-tracker.ts (신규)
export class CostTracker {
  private static instance: CostTracker;
  private costs: Map<string, number> = new Map();
  
  static getInstance(): CostTracker {
    if (!this.instance) {
      this.instance = new CostTracker();
    }
    return this.instance;
  }
  
  track(provider: string, model: string, tokens: number, cost: number) {
    const key = `${provider}:${model}`;
    const current = this.costs.get(key) || 0;
    this.costs.set(key, current + cost);
    
    // 일별 집계를 위한 로깅
    console.log(`[Cost] ${provider} ${model}: ${tokens} tokens = $${cost.toFixed(4)}`);
  }
  
  getDailySummary(): CostSummary {
    const summary: CostSummary = {
      total: 0,
      byProvider: {},
      timestamp: new Date().toISOString()
    };
    
    this.costs.forEach((cost, key) => {
      const [provider] = key.split(':');
      summary.byProvider[provider] = (summary.byProvider[provider] || 0) + cost;
      summary.total += cost;
    });
    
    return summary;
  }
  
  reset() {
    this.costs.clear();
  }
}
```

#### Task 3.2: 평가 일관성 모니터링
**파일 생성:**
```typescript
// components/monitoring/ConsistencyMonitor.tsx (신규)
import { useEffect, useState } from 'react';

export function ConsistencyMonitor() {
  const [stats, setStats] = useState<ConsistencyStats | null>(null);
  
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, []);
  
  const fetchStats = async () => {
    const response = await fetch('/api/stats/consistency');
    const data = await response.json();
    setStats(data);
  };
  
  if (!stats) return <div>Loading...</div>;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>평가 일관성 모니터링</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label>전체 일관성</Label>
            <Progress value={stats.overall * 100} />
            <span className="text-sm text-muted-foreground">
              {(stats.overall * 100).toFixed(1)}%
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>업무능력</Label>
              <div className="text-2xl font-bold">
                {(stats.byCategory.업무능력 * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <Label>문장력</Label>
              <div className="text-2xl font-bold">
                {(stats.byCategory.문장력 * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <Label>기본태도</Label>
              <div className="text-2xl font-bold">
                {(stats.byCategory.기본태도 * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          
          <div>
            <Label>Provider별 응답 시간</Label>
            {stats.providers.map(p => (
              <div key={p.name} className="flex justify-between">
                <span>{p.name}</span>
                <span>{p.avgResponseTime}ms</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3.4 Phase 4: 테스트 및 검증 (4주차)

#### Task 4.1: 단위 테스트 작성
**파일 생성:**
```typescript
// __tests__/lib/llm/providers/openai.test.ts (신규)
import { OpenAIProvider } from '@/lib/llm/providers/openai';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  
  beforeEach(() => {
    provider = new OpenAIProvider();
  });
  
  test('should evaluate chat successfully', async () => {
    const prompt = 'Test prompt';
    const result = await provider.evaluate(prompt);
    
    expect(result).toHaveProperty('scores');
    expect(result.scores).toHaveProperty('업무능력');
    expect(result.scores.업무능력).toBeGreaterThanOrEqual(1);
    expect(result.scores.업무능력).toBeLessThanOrEqual(5);
  });
  
  test('should calculate cost correctly', () => {
    const tokens = 1000;
    const cost = provider.getCost(tokens);
    
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1); // 1달러 미만
  });
});

// __tests__/lib/evaluation/cross-validator.test.ts (신규)
import { CrossValidator } from '@/lib/evaluation/cross-validator';

describe('CrossValidator', () => {
  let validator: CrossValidator;
  
  beforeEach(() => {
    validator = new CrossValidator();
  });
  
  test('should consolidate multiple evaluations', async () => {
    const chatData = { /* test data */ };
    const result = await validator.evaluate(chatData);
    
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('consistency');
    expect(result.consistency).toBeGreaterThanOrEqual(0);
    expect(result.consistency).toBeLessThanOrEqual(1);
  });
  
  test('should handle provider failures gracefully', async () => {
    // 한 provider가 실패해도 나머지로 평가 진행
    const result = await validator.evaluate(chatData);
    
    expect(result.providers.length).toBeGreaterThanOrEqual(1);
  });
});
```

#### Task 4.2: 통합 테스트
**파일 생성:**
```typescript
// __tests__/api/analyze-multi.test.ts (신규)
import { POST } from '@/app/api/analyze-multi/route';

describe('Multi-LLM Analysis API', () => {
  test('should return consistent evaluation', async () => {
    const request = new Request('http://localhost:3000/api/analyze-multi', {
      method: 'POST',
      body: JSON.stringify({
        chatData: { /* test chat data */ },
        useMultiLLM: true
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.evaluation).toHaveProperty('consistency');
    expect(data.evaluation.consistency).toBeGreaterThan(0.8);
  });
});
```

---

## 📊 4. 예상 결과 및 KPI

### 4.1 핵심 성과 지표

| KPI | AS-IS | TO-BE | 개선율 |
|-----|-------|-------|--------|
| **평가 일관성** | 85% | 95% | +11.8% |
| **평가 신뢰도** | 70% | 90% | +28.6% |
| **API 응답 시간** | 3초 | 2초 | -33.3% |
| **월간 비용** | $50 | $35 | -30% |
| **재평가 요청** | 15% | 5% | -66.7% |
| **운영 효율성** | - | +40% | - |

### 4.2 비용 분석

#### 월간 예상 비용 (10,000건 기준)
```
AS-IS (OpenAI만 사용):
- GPT-4: $0.01/1K tokens × 2K tokens × 10,000 = $200

TO-BE (Multi-LLM):
- OpenAI GPT-4: $0.01 × 1K × 10,000 = $100
- Gemini Pro: $0.00025 × 1K × 10,000 = $2.50
- 총합: $102.50 (48.75% 절감)
```

### 4.3 ROI 계산
```
투자 비용:
- 개발 인건비: 1명 × 4주 = 1,000만원
- 인프라 비용: 0원 (기존 활용)
- 총 투자: 1,000만원

월간 이익:
- API 비용 절감: $97.50 (약 13만원)
- 운영 시간 절감: 40시간 (약 200만원)
- 월간 총 이익: 213만원

ROI:
- 투자 회수 기간: 4.7개월
- 1년 ROI: 155%
```

---

## 📅 5. 구현 일정

### Week 1 (1/15 - 1/21)
- [x] LLM Provider 추상화
- [x] 설정 파일 외부화
- [x] 에러 처리 메커니즘

### Week 2 (1/22 - 1/28)
- [ ] Cross Validator 구현
- [ ] Multi-LLM API 개발
- [ ] 기존 Route 마이그레이션

### Week 3 (1/29 - 2/4)
- [ ] 비용 추적 시스템
- [ ] 모니터링 대시보드
- [ ] 성능 최적화

### Week 4 (2/5 - 2/11)
- [ ] 테스트 작성
- [ ] 문서화
- [ ] 배포 및 모니터링

### Week 5 (2/12 - 2/15)
- [ ] 안정화
- [ ] 피드백 수집
- [ ] 최종 조정

---

## 🚨 6. 리스크 관리

### 6.1 기술적 리스크

| 리스크 | 발생 가능성 | 영향도 | 대응 방안 |
|--------|------------|--------|-----------|
| LLM API 장애 | 중 | 높음 | 다중 Provider로 Failover |
| 일관성 저하 | 낮음 | 높음 | 교차 검증 강화 |
| 비용 초과 | 낮음 | 중 | 실시간 비용 모니터링 |
| 성능 저하 | 중 | 중 | 병렬 처리 최적화 |

### 6.2 운영 리스크

| 리스크 | 대응 방안 |
|--------|-----------|
| 평가 기준 변경 | JSON 설정으로 즉시 반영 |
| Provider 추가/제거 | 플러그인 구조로 유연 대응 |
| 데이터 보안 | API Key 환경변수 관리 |

---

## ✅ 7. 체크리스트

### 개발 전 준비
- [ ] API Key 발급 (OpenAI, Gemini)
- [ ] 개발 환경 설정
- [ ] 테스트 데이터 준비

### 개발 중
- [ ] 코드 리뷰 프로세스
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 수행

### 배포 전
- [ ] 성능 테스트
- [ ] 보안 검토
- [ ] 문서 업데이트

### 배포 후
- [ ] 모니터링 설정
- [ ] 알림 구성
- [ ] 롤백 계획 수립

---

## 📚 8. 참고 자료

### API 문서
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Google Gemini API](https://ai.google.dev/api/rest)
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference)

### 관련 라이브러리
- [Zod - TypeScript 스키마 검증](https://zod.dev/)
- [React Query - 서버 상태 관리](https://tanstack.com/query)

### 내부 문서
- 평가 기준 가이드라인 v4.2
- CX팀 상담 품질 관리 매뉴얼

---

## 📝 9. 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0 | 2024-01-15 | CX Team | 초안 작성 |
| 1.1 | 2024-01-16 | Tech Team | 기술 검토 및 수정 |

---

**문서 승인**

- 기획: CX Team Lead
- 개발: Tech Lead
- 검토: Product Manager

*본 문서는 핀다 CX팀 상담 평가 시스템 개선 프로젝트의 공식 기획서입니다.*