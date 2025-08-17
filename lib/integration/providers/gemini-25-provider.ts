import { BaseProvider } from './base-provider';
import { EvaluationRequest, EvaluationResult } from '@/lib/types/evaluation';

/**
 * Google Gemini 2.5 Provider 구현
 * Gemini 2.5 Pro 및 Flash 모델을 사용한 상담 평가 서비스
 */
export class Gemini25Provider extends BaseProvider {
  constructor(config: any) {
    super('gemini-25', config);
  }

  /**
   * Gemini 2.5 API를 통한 상담 평가
   */
  async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    try {
      // API 키 검증
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) {
        throw new Error('Google AI API 키가 설정되지 않았습니다.');
      }

      // 프롬프트 생성
      const prompt = this.buildPrompt(request);
      
      // API 호출
      const response = await this.callAPI(prompt, apiKey);
      
      // 응답 파싱
      const parsedResult = this.parseResponse(response);
      
      // 결과 구성
      const result: EvaluationResult = {
        scores: parsedResult.scores || {
          업무능력: { subtotal: 3.0 },
          문장력: { subtotal: 3.0 },
          기본_태도: { subtotal: 3.0 },
          total_score: 3.0
        },
        evidence: parsedResult.evidence || {
          positive: [],
          negative: [],
          quotes: []
        },
        improvements: parsedResult.improvements || [],
        problematic: parsedResult.problematic || false,
        severity: parsedResult.severity || 'none',
        provider: this.name,
        model: this.config.model,
        responseTime: Date.now() - startTime,
        tokens: this.calculateTokens(prompt, response),
        cost: this.calculateCost(prompt, response)
      };

      return result;
    } catch (error) {
      throw this.handleError(error, 'Gemini 2.5 평가 실행 중 오류 발생');
    }
  }

  /**
   * Gemini 2.5 API 호출
   */
  private async callAPI(prompt: string, apiKey: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 60000);

    try {
      // 모델명 처리 (models/ 접두사 제거)
      const modelName = this.config.model.startsWith('models/') 
        ? this.config.model 
        : `models/${this.config.model}`;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: this.getSystemPrompt() + '\n\n' + prompt
            }]
          }],
          generationConfig: {
            temperature: this.config.temperature || 0.1,
            maxOutputTokens: this.config.max_tokens || 4000,
            topP: this.config.top_p || 0.95,
            topK: this.config.top_k || 40,
            responseMimeType: "application/json",
            // Gemini 2.5 특화 설정
            candidateCount: 1,
            stopSequences: []
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini 2.5 API 오류: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Gemini 2.5 API에서 유효하지 않은 응답을 받았습니다.');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Gemini 2.5 특화 시스템 프롬프트
   */
  private getSystemPrompt(): string {
    const modelType = this.getModelType();
    
    const basePrompt = `당신은 핀다 고객 상담 품질을 평가하는 전문가입니다. 
제공된 평가 기준에 따라 객관적이고 일관성 있는 평가를 수행해야 합니다. 
반드시 유효한 JSON 형식으로만 응답하세요.

평가 시 주의사항:
1. 상담원의 메시지만 평가 대상입니다
2. 모든 점수는 1.0-5.0 범위에서 0.1 단위로 부여
3. 구체적인 근거와 함께 평가
4. 개선점과 강점을 명확히 제시
5. 다양한 관점에서 균형 잡힌 평가 제공`;

    if (modelType === 'pro') {
      return basePrompt + `

Gemini 2.5 Pro 특화 평가 관점:
- 심층적이고 종합적인 분석 수행
- 복잡한 상황에서의 상담원 역량 평가
- 고급 커뮤니케이션 기법 및 전략 분석
- 미묘한 감정적 뉘앙스와 문화적 컨텍스트 고려
- 전문적이고 상세한 개선 방안 제시`;
    } else {
      return basePrompt + `

Gemini 2.5 Flash 특화 평가 관점:
- 빠르고 효율적인 핵심 평가 수행
- 즉각적인 상담 품질 판단
- 명확하고 실용적인 피드백 제공
- 실시간 상담 개선 포인트 도출
- 간결하면서도 정확한 평가 결과 제공`;
    }
  }

  /**
   * 모델 타입 확인 (Pro 또는 Flash)
   */
  private getModelType(): 'pro' | 'flash' {
    const model = this.config.model.toLowerCase();
    return model.includes('pro') ? 'pro' : 'flash';
  }

  /**
   * Gemini 2.5 특화 프롬프트 생성
   */
  private buildPrompt(request: EvaluationRequest): string {
    const { session, criteria } = request;
    const modelType = this.getModelType();
    
    // 대화 내용 구성 (Pro는 더 많은 메시지 처리 가능)
    const messageLimit = modelType === 'pro' ? 25 : 15;
    const textLimit = modelType === 'pro' ? 300 : 200;
    
    const conversation = session.messages
      .filter(msg => msg.type === 'manager')
      .slice(0, messageLimit)
      .map(msg => `상담원: ${msg.text.slice(0, textLimit)}`)
      .join('\n');

    const basePrompt = `다음 상담 내용을 평가 기준에 따라 평가해주세요.

상담 정보:
- 상담원 ID: ${session.managerId}
- 상담 날짜: ${session.metadata.startTime}
- 채널: ${session.metadata.channel}
- 모델: Gemini 2.5 ${modelType.toUpperCase()}

평가 기준:
${JSON.stringify(criteria, null, 2)}

대화 내용:
${conversation}`;

    const modelSpecificGuidance = modelType === 'pro' 
      ? `

Gemini 2.5 Pro 전문 평가 지침:
1. 상담원의 전문성과 숙련도를 심층적으로 분석
2. 복잡한 고객 요구사항 처리 능력 평가
3. 감정적 지능과 공감 능력의 세밀한 측정
4. 문화적 감수성과 다양성 인식 수준 평가
5. 창의적 문제 해결과 혁신적 접근 방식 고려
6. 장기적 고객 관계 구축 역량 분석`
      : `

Gemini 2.5 Flash 신속 평가 지침:
1. 핵심 상담 요소들의 즉각적인 품질 평가
2. 명확하고 직관적인 개선 포인트 도출
3. 실시간 피드백에 적합한 간결한 분석
4. 즉시 적용 가능한 실용적 조언 제공
5. 효율적이면서도 정확한 점수 산정`;

    return basePrompt + modelSpecificGuidance + `

다음 JSON 형식으로 평가해주세요:
{
  "scores": {
    "업무능력": {
      "고객_질문_내용_파악": 0.0,
      "파악_및_해결_적극성": 0.0,
      "답변의_정확성_및_적합성": 0.0,
      "도메인_전문성": 0.0,
      "신속한_응대": 0.0,
      "상황_공감": 0.0,
      "subtotal": 0.0
    },
    "문장력": {
      "정확한_맞춤법": 0.0,
      "적절한_언어_표현": 0.0,
      "쉬운_표현_사용": 0.0,
      "단계별_안내": 0.0,
      "subtotal": 0.0
    },
    "기본_태도": {
      "인사_및_추가_문의": 0.0,
      "양해_표현_사용": 0.0,
      "subtotal": 0.0
    },
    "total_score": 0.0
  },
  "evidence": {
    "positive": ["긍정적 근거들"],
    "negative": ["부정적 근거들"],
    "quotes": ["실제 대화 인용구들"]
  },
  "improvements": ["개선 제안들"],
  "problematic": false,
  "severity": "none"
}`;
  }

  /**
   * 응답 파싱 (기존과 동일하지만 Gemini 2.5 특화 오류 처리)
   */
  private parseResponse(response: string): Partial<EvaluationResult> {
    try {
      // JSON 추출 및 정제
      let jsonStr = response.trim();
      
      // 코드 블록 제거
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      // 앞뒤 불필요한 텍스트 제거
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        jsonStr = braceMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      
      // 점수 유효성 검증
      this.validateScores(parsed.scores);
      
      return parsed;
    } catch (error) {
      console.error('Gemini 2.5 응답 파싱 오류:', error);
      console.error('원본 응답:', response.slice(0, 500));
      return this.getDefaultResult();
    }
  }

  /**
   * 점수 유효성 검증
   */
  private validateScores(scores: any): void {
    if (!scores || typeof scores !== 'object') {
      throw new Error('점수 객체가 유효하지 않습니다');
    }

    // 필수 항목 확인
    const requiredSections = ['업무능력', '문장력', '기본_태도'];
    for (const section of requiredSections) {
      if (!scores[section] || typeof scores[section] !== 'object') {
        throw new Error(`${section} 섹션이 누락되었습니다`);
      }
    }

    // 점수 범위 확인 (1.0-5.0)
    const validateScoreRange = (score: number, name: string) => {
      if (typeof score !== 'number' || score < 1.0 || score > 5.0) {
        throw new Error(`${name} 점수가 유효하지 않습니다: ${score}`);
      }
    };

    // 각 섹션의 점수들 검증
    Object.entries(scores).forEach(([sectionName, section]: [string, any]) => {
      if (typeof section === 'object' && section !== null) {
        Object.entries(section).forEach(([itemName, score]: [string, any]) => {
          if (typeof score === 'number') {
            validateScoreRange(score, `${sectionName}.${itemName}`);
          }
        });
      }
    });
  }

  /**
   * Gemini 2.5 토큰 수 계산
   */
  private calculateTokens(prompt: string, response: string): number {
    // Gemini 2.5의 토큰 계산 (더 효율적, 1 토큰 ≈ 4.5자)
    const promptTokens = Math.ceil(prompt.length / 4.5);
    const responseTokens = Math.ceil(response.length / 4.5);
    return promptTokens + responseTokens;
  }

  /**
   * Gemini 2.5 비용 계산
   */
  private calculateCost(prompt: string, response: string): number {
    const inputTokens = Math.ceil(prompt.length / 4.5);
    const outputTokens = Math.ceil(response.length / 4.5);
    
    // Gemini 2.5 모델별 가격 (실제 가격으로 업데이트 필요)
    const modelType = this.getModelType();
    let inputCostPer1k, outputCostPer1k;
    
    if (modelType === 'pro') {
      // Gemini 2.5 Pro 가격 (예시)
      inputCostPer1k = this.config.cost?.input_per_1k || 0.0005;
      outputCostPer1k = this.config.cost?.output_per_1k || 0.001;
    } else {
      // Gemini 2.5 Flash 가격 (예시)
      inputCostPer1k = this.config.cost?.input_per_1k || 0.0001;
      outputCostPer1k = this.config.cost?.output_per_1k || 0.0002;
    }
    
    const inputCost = (inputTokens / 1000) * inputCostPer1k;
    const outputCost = (outputTokens / 1000) * outputCostPer1k;
    
    return inputCost + outputCost;
  }

  /**
   * 기본 결과 반환
   */
  private getDefaultResult(): Partial<EvaluationResult> {
    const modelType = this.getModelType();
    
    return {
      scores: {
        업무능력: { subtotal: 3.0 },
        문장력: { subtotal: 3.0 },
        기본_태도: { subtotal: 3.0 },
        total_score: 3.0
      },
      evidence: {
        positive: ['기본적인 상담 진행'],
        negative: [`Gemini 2.5 ${modelType.toUpperCase()} 평가 실패로 인한 기본값 적용`],
        quotes: []
      },
      improvements: ['재평가 필요'],
      problematic: false,
      severity: 'none'
    };
  }

  /**
   * Gemini 2.5 특화 재시도 가능 오류 판단
   */
  protected isRetryableError(error: any): boolean {
    // 기본 재시도 로직 적용
    const baseRetryable = super.isRetryableError(error);
    if (baseRetryable) return true;

    const errorMessage = error.message?.toLowerCase() || '';
    
    // Gemini 2.5 특화 재시도 가능 오류들
    const gemini25RetryableErrors = [
      'quota exceeded',
      'rate limit',
      'service unavailable',
      'model overloaded',
      'safety filter',
      'recitation',
      'model not found', // 모델 전환 시 일시적 오류
      'resource exhausted',
      'temporarily unavailable'
    ];

    return gemini25RetryableErrors.some(keyword => errorMessage.includes(keyword));
  }
}