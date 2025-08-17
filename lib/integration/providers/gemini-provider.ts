import { BaseProvider } from './base-provider';
import { EvaluationRequest, EvaluationResult } from '@/lib/types/evaluation';

/**
 * Google Gemini Provider 구현
 * Gemini 2.0 Flash Experimental 모델을 사용한 상담 평가 서비스
 */
export class GeminiProvider extends BaseProvider {
  constructor(config: any) {
    super('gemini', config);
  }

  /**
   * Gemini API를 통한 상담 평가
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
        cost: this.calculateCost(prompt, response) // Gemini는 현재 무료
      };

      return result;
    } catch (error) {
      throw this.handleError(error, 'Gemini 평가 실행 중 오류 발생');
    }
  }

  /**
   * Gemini API 호출
   */
  private async callAPI(prompt: string, apiKey: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`;
      
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
            temperature: this.config.temperature,
            maxOutputTokens: this.config.max_tokens,
            responseMimeType: "application/json"
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
        throw new Error(`Gemini API 오류: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Gemini API에서 유효하지 않은 응답을 받았습니다.');
      }

      return data.candidates[0].content.parts[0].text;
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
4. 개선점과 강점을 명확히 제시
5. OpenAI와 다른 관점에서 평가하여 다양성 확보

Gemini 특화 평가 관점:
- 다문화적 커뮤니케이션 스타일 고려
- 감정적 뉘앙스와 컨텍스트 깊이 분석
- 창의적이고 다각적인 평가 접근`;
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

Gemini 특화 평가 지침:
1. 상담원의 감정적 지능과 공감 능력을 세밀하게 분석
2. 문화적 컨텍스트와 커뮤니케이션 스타일 고려
3. 창의적이고 혁신적인 문제 해결 방식 평가
4. OpenAI와 다른 관점에서 균형 잡힌 평가 제공

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
      console.error('Gemini 응답 파싱 오류:', error);
      console.error('원본 응답:', response.slice(0, 500));
      return this.getDefaultResult();
    }
  }

  /**
   * 점수 유효성 검증 (OpenAI와 동일한 로직)
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
    // Gemini의 토큰 계산 (대략적, 1 토큰 ≈ 4자)
    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = Math.ceil(response.length / 4);
    return promptTokens + responseTokens;
  }

  /**
   * 비용 계산 (현재 Gemini는 무료)
   */
  private calculateCost(prompt: string, response: string): number {
    // Gemini 2.0 Flash Experimental은 현재 무료
    return 0;
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
        negative: ['Gemini 평가 실패로 인한 기본값 적용'],
        quotes: []
      },
      improvements: ['재평가 필요'],
      problematic: false,
      severity: 'none'
    };
  }

  /**
   * Gemini 특화 재시도 가능 오류 판단
   */
  protected isRetryableError(error: any): boolean {
    // 기본 재시도 로직 적용
    const baseRetryable = super.isRetryableError(error);
    if (baseRetryable) return true;

    const errorMessage = error.message?.toLowerCase() || '';
    
    // Gemini 특화 재시도 가능 오류들
    const geminiRetryableErrors = [
      'quota exceeded',
      'rate limit',
      'service unavailable',
      'model overloaded',
      'safety filter',
      'recitation'
    ];

    return geminiRetryableErrors.some(keyword => errorMessage.includes(keyword));
  }
}