import { BaseProvider } from './base-provider';
import { EvaluationRequest, EvaluationResult } from '@/lib/types/evaluation';

/**
 * OpenAI Provider 구현
 * GPT-4o-mini 모델을 사용한 상담 평가 서비스
 */
export class OpenAIProvider extends BaseProvider {
  constructor(config: any) {
    super('openai', config);
  }

  /**
   * OpenAI API를 통한 상담 평가
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
      throw this.handleError(error, 'OpenAI 평가 실행 중 오류 발생');
    }
  }

  /**
   * OpenAI API 호출
   */
  private async callAPI(prompt: string, apiKey: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.max_tokens,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API 오류: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 시스템 프롬프트 생성
   */
  private getSystemPrompt(): string {
    return `당신은 핀다 고객 상담 품질을 평가하는 전문가입니다. 
제공된 평가 기준에 따라 객관적이고 일관성 있는 평가를 수행해야 합니다. 
반드시 유효한 JSON 형식으로만 응답하세요.

평가 시 주의사항:
1. 상담원의 메시지만 평가 대상입니다
2. 모든 점수는 1.0-5.0 범위에서 0.1 단위로 부여
3. 구체적인 근거와 함께 평가
4. 개선점과 강점을 명확히 제시`;
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
      console.error('OpenAI 응답 파싱 오류:', error);
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
   * 토큰 수 계산 (대략적)
   */
  private calculateTokens(prompt: string, response: string): number {
    // 대략적인 토큰 계산 (1 토큰 ≈ 4자)
    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = Math.ceil(response.length / 4);
    return promptTokens + responseTokens;
  }

  /**
   * 비용 계산
   */
  private calculateCost(prompt: string, response: string): number {
    const tokens = this.calculateTokens(prompt, response);
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(response.length / 4);
    
    const inputCost = (inputTokens / 1000) * this.config.cost.input_per_1k;
    const outputCost = (outputTokens / 1000) * this.config.cost.output_per_1k;
    
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