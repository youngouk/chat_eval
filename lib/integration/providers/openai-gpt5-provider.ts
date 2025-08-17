import { BaseProvider } from './base-provider';
import { EvaluationRequest, EvaluationResult } from '@/lib/types/evaluation';

/**
 * OpenAI GPT-5 Provider 구현
 * GPT-5-mini 모델을 사용한 상담 평가 서비스 (Responses API 사용)
 */
export class OpenAIGPT5Provider extends BaseProvider {
  constructor(config: any) {
    super('openai-gpt5', config);
  }

  /**
   * GPT-5-mini Responses API를 통한 상담 평가
   */
  async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    try {
      // API 키 검증
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다.');
      }

      // 프롬프트 생성
      const prompt = this.buildPrompt(request);
      
      // Responses API 호출
      const response = await this.callResponsesAPI(prompt, apiKey);
      
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
        model: this.config.model || 'gpt-5-mini',
        responseTime: Date.now() - startTime,
        tokens: this.calculateTokens(prompt, response),
        cost: this.calculateCost(prompt, response)
      };

      return result;
    } catch (error) {
      throw this.handleError(error, 'GPT-5 평가 실행 중 오류 발생');
    }
  }

  /**
   * OpenAI Responses API 호출 (GPT-5 전용)
   */
  private async callResponsesAPI(prompt: string, apiKey: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 60000);

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-5-mini',
          input: this.formatPromptForGPT5(prompt),
          // reasoning effort 설정 - 평가 작업에는 medium이 적합
          reasoning: {
            effort: this.config.reasoningEffort || 'medium'
          },
          // verbosity 설정 - 구조화된 JSON 응답에는 medium이 적합
          text: {
            verbosity: this.config.verbosity || 'medium'
          },
          // 온도 설정 - 일관성 있는 평가를 위해 낮은 온도
          temperature: this.config.temperature || 0.1,
          max_output_tokens: this.config.max_tokens || 2000,
          // JSON 형식 응답 요청
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GPT-5 API 오류: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Responses API는 output_text 필드를 사용
      return data.output_text || data.output || data.choices?.[0]?.message?.content || '';
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * GPT-5에 최적화된 프롬프트 포맷팅
   */
  private formatPromptForGPT5(prompt: string): string {
    return `당신은 핀다 고객 상담 품질을 평가하는 전문가입니다. 
제공된 평가 기준에 따라 객관적이고 일관성 있는 평가를 수행해야 합니다. 
반드시 유효한 JSON 형식으로만 응답하세요.

평가 시 주의사항:
1. 상담원의 메시지만 평가 대상입니다
2. 모든 점수는 1.0-5.0 범위에서 0.1 단위로 부여
3. 구체적인 근거와 함께 평가
4. 개선점과 강점을 명확히 제시
5. 평가 시 단계별로 생각하고 종합적으로 판단하세요

${prompt}`;
  }

  /**
   * 프롬프트 생성
   */
  private buildPrompt(request: EvaluationRequest): string {
    const { session, criteria } = request;
    
    // 대화 내용 구성
    const conversation = session.messages
      .filter(msg => msg.type === 'manager')
      .slice(0, 15) // 메시지 수 제한
      .map(msg => `상담원: ${msg.text.slice(0, 200)}`)
      .join('\n');

    return `다음 상담 내용을 평가 기준에 따라 평가해주세요.

상담 정보:
- 상담원 ID: ${session.managerId}
- 상담 날짜: ${session.metadata.startTime}
- 채널: ${session.metadata.channel}

평가 기준:
${JSON.stringify(criteria, null, 2)}

대화 내용:
${conversation}

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
   * 응답 파싱
   */
  private parseResponse(response: string): Partial<EvaluationResult> {
    try {
      // JSON 추출
      let jsonStr = response.trim();
      
      // 코드 블록 제거
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);
      
      // 점수 유효성 검증
      this.validateScores(parsed.scores);
      
      return parsed;
    } catch (error) {
      console.error('GPT-5 응답 파싱 오류:', error);
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
   * 토큰 수 계산 (GPT-5 기준)
   */
  private calculateTokens(prompt: string, response: string): number {
    // GPT-5는 더 효율적인 토큰 사용 (대략 1 토큰 ≈ 4.5자)
    const promptTokens = Math.ceil(prompt.length / 4.5);
    const responseTokens = Math.ceil(response.length / 4.5);
    return promptTokens + responseTokens;
  }

  /**
   * 비용 계산 (GPT-5-mini 기준)
   */
  private calculateCost(prompt: string, response: string): number {
    const inputTokens = Math.ceil(prompt.length / 4.5);
    const outputTokens = Math.ceil(response.length / 4.5);
    
    // GPT-5-mini 가격 (실제 가격으로 업데이트 필요)
    const inputCostPer1k = this.config.cost?.input_per_1k || 0.0001; // 예시 가격
    const outputCostPer1k = this.config.cost?.output_per_1k || 0.0002; // 예시 가격
    
    const inputCost = (inputTokens / 1000) * inputCostPer1k;
    const outputCost = (outputTokens / 1000) * outputCostPer1k;
    
    return inputCost + outputCost;
  }

  /**
   * 기본 결과 반환
   */
  private getDefaultResult(): Partial<EvaluationResult> {
    return {
      scores: {
        업무능력: { subtotal: 3.0 },
        문장력: { subtotal: 3.0 },
        기본_태도: { subtotal: 3.0 },
        total_score: 3.0
      },
      evidence: {
        positive: ['기본적인 상담 진행'],
        negative: ['평가 실패로 인한 기본값 적용'],
        quotes: []
      },
      improvements: ['재평가 필요'],
      problematic: false,
      severity: 'none'
    };
  }
}