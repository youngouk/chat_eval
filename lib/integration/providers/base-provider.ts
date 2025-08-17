import { EvaluationRequest, EvaluationResult, ProviderConfig } from '@/lib/types/evaluation';

/**
 * Base Provider 추상 클래스
 * 모든 LLM Provider가 구현해야 할 공통 인터페이스
 */
export abstract class BaseProvider {
  protected name: string;
  protected config: ProviderConfig;
  private retryCount: number = 0;

  constructor(name: string, config: ProviderConfig) {
    this.name = name;
    this.config = config;
  }

  /**
   * 상담 평가 실행 (추상 메서드)
   */
  abstract evaluate(request: EvaluationRequest): Promise<EvaluationResult>;

  /**
   * Provider 이름 반환
   */
  getName(): string {
    return this.name;
  }

  /**
   * Provider 설정 반환
   */
  getConfig(): ProviderConfig {
    return this.config;
  }

  /**
   * Provider 활성화 상태 확인
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 재시도 로직이 포함된 평가 실행
   */
  async evaluateWithRetry(request: EvaluationRequest): Promise<EvaluationResult> {
    this.retryCount = 0;
    
    for (let attempt = 1; attempt <= this.config.retry.max_attempts; attempt++) {
      try {
        const result = await this.evaluate(request);
        this.retryCount = 0; // 성공 시 재시도 카운트 리셋
        return result;
      } catch (error) {
        this.retryCount = attempt;
        
        if (attempt === this.config.retry.max_attempts) {
          // 최대 재시도 횟수 도달
          throw this.handleError(error, `${this.name} Provider 최대 재시도 횟수 초과`);
        }

        // 재시도 가능한 오류인지 확인
        if (!this.isRetryableError(error)) {
          throw this.handleError(error, `${this.name} Provider 재시도 불가능한 오류`);
        }

        // 지수 백오프 대기
        const delayMs = this.config.retry.initial_delay * Math.pow(this.config.retry.backoff_multiplier, attempt - 1);
        console.warn(`${this.name} Provider 재시도 ${attempt}/${this.config.retry.max_attempts} (${delayMs}ms 후)`);
        
        await this.delay(delayMs);
      }
    }

    // 이 지점에 도달하면 안 됨
    throw new Error(`${this.name} Provider 예상치 못한 오류`);
  }

  /**
   * 재시도 가능한 오류인지 판단
   */
  protected isRetryableError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.status || error.statusCode;

    // HTTP 상태 코드 기반 재시도 판단
    if (statusCode) {
      // 4xx 클라이언트 오류 (재시도 불가)
      if (statusCode >= 400 && statusCode < 500) {
        // 단, 429 (Rate Limit)와 408 (Timeout)은 재시도 가능
        return statusCode === 429 || statusCode === 408;
      }
      
      // 5xx 서버 오류 (재시도 가능)
      if (statusCode >= 500) {
        return true;
      }
    }

    // 네트워크 관련 오류 (재시도 가능)
    const networkErrors = [
      'network',
      'timeout',
      'connect',
      'econnreset',
      'enotfound',
      'econnrefused'
    ];
    
    return networkErrors.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * 오류 처리 및 표준화
   */
  protected handleError(error: any, context: string): Error {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = `${context}: ${errorMessage}`;
    
    console.error(fullMessage, {
      provider: this.name,
      retryCount: this.retryCount,
      config: {
        model: this.config.model,
        timeout: this.config.timeout
      },
      originalError: error
    });

    return new Error(fullMessage);
  }

  /**
   * 지연 실행
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 설정 유효성 검증
   */
  protected validateConfig(): void {
    if (!this.config) {
      throw new Error(`${this.name} Provider 설정이 없습니다`);
    }

    if (!this.config.model) {
      throw new Error(`${this.name} Provider 모델이 설정되지 않았습니다`);
    }

    if (typeof this.config.temperature !== 'number' || this.config.temperature < 0 || this.config.temperature > 2) {
      throw new Error(`${this.name} Provider temperature 설정이 유효하지 않습니다: ${this.config.temperature}`);
    }

    if (!this.config.max_tokens || this.config.max_tokens <= 0) {
      throw new Error(`${this.name} Provider max_tokens 설정이 유효하지 않습니다: ${this.config.max_tokens}`);
    }

    if (!this.config.timeout || this.config.timeout <= 0) {
      throw new Error(`${this.name} Provider timeout 설정이 유효하지 않습니다: ${this.config.timeout}`);
    }
  }

  /**
   * Provider 상태 확인
   */
  async healthCheck(): Promise<{success: boolean, message: string, responseTime?: number}> {
    const startTime = Date.now();
    
    try {
      // 간단한 테스트 요청으로 상태 확인
      const testRequest: EvaluationRequest = {
        session: {
          chatId: 'health-check',
          userId: 'test',
          managerId: 'test',
          messages: [{
            type: 'manager',
            text: '안녕하세요.',
            timestamp: new Date()
          }],
          metadata: {
            startTime: new Date(),
            channel: 'test'
          }
        },
        criteria: {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          author: 'system',
          evaluation_criteria: {
            업무능력: { weight: 0.6, subcriteria: {} },
            문장력: { weight: 0.25, subcriteria: {} },
            기본_태도: { weight: 0.15, subcriteria: {} }
          },
          scoring: {
            scale: { min: 1, max: 5, step: 0.1 },
            thresholds: { excellent: 4.5, good: 4.0, average: 3.5, poor: 2.5 },
            problematic_criteria: {
              total_score: 2.5,
              업무능력: 2.0,
              문장력: 2.0,
              기본태도: 2.0,
              relative_threshold: 0.8
            }
          },
          filters: {
            exclude_patterns: [],
            exclude_tags: [],
            include_tags: []
          }
        }
      };

      await this.evaluate(testRequest);
      
      return {
        success: true,
        message: `${this.name} Provider 정상 작동`,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        message: `${this.name} Provider 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Provider 통계 정보 반환
   */
  getStats(): {
    name: string;
    model: string;
    enabled: boolean;
    retryCount: number;
    config: {
      temperature: number;
      max_tokens: number;
      timeout: number;
    };
  } {
    return {
      name: this.name,
      model: this.config.model,
      enabled: this.config.enabled,
      retryCount: this.retryCount,
      config: {
        temperature: this.config.temperature,
        max_tokens: this.config.max_tokens,
        timeout: this.config.timeout
      }
    };
  }
}