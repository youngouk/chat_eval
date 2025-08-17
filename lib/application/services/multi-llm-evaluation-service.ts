import { EvaluationOrchestrator } from '@/lib/integration/evaluation-orchestrator';
import { EvaluationValidator } from '@/lib/domain/evaluation-validator';
import { ConfigManager } from '@/lib/config/manager';
import { 
  EvaluationRequest, 
  ConsolidatedResult, 
  ChatSession,
  EvaluationCriteria 
} from '@/lib/types/evaluation';

/**
 * Multi-LLM 평가 서비스
 * 전체 평가 프로세스를 조율하고 관리하는 핵심 Application Service
 */
export class MultiLLMEvaluationService {
  private static instance: MultiLLMEvaluationService;
  private orchestrator: EvaluationOrchestrator;
  private validator: EvaluationValidator;
  private configManager: ConfigManager;
  private isInitialized: boolean = false;

  private constructor() {
    this.orchestrator = EvaluationOrchestrator.getInstance();
    this.validator = EvaluationValidator.getInstance();
    this.configManager = ConfigManager.getInstance();
  }

  static getInstance(): MultiLLMEvaluationService {
    if (!this.instance) {
      this.instance = new MultiLLMEvaluationService();
    }
    return this.instance;
  }

  /**
   * 서비스 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[MultiLLMEvaluationService] 이미 초기화됨');
      return;
    }

    console.log('[MultiLLMEvaluationService] 초기화 시작');

    try {
      // 오케스트레이터 초기화
      await this.orchestrator.initialize();
      
      // 설정 검증
      this.validateConfiguration();
      
      this.isInitialized = true;
      console.log('[MultiLLMEvaluationService] 초기화 완료');
    } catch (error) {
      console.error('[MultiLLMEvaluationService] 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 단일 상담 평가
   */
  async evaluateChat(
    chatSession: ChatSession,
    options?: {
      strictValidation?: boolean;
      generateReport?: boolean;
      includeAdvancedAnalysis?: boolean;
      timeout?: number;
    }
  ): Promise<{
    result: ConsolidatedResult;
    validation: any;
    metadata: {
      processingTime: number;
      timestamp: string;
      version: string;
      providersUsed: string[];
    };
    report?: string;
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`[MultiLLMEvaluationService] 상담 평가 시작: ${chatSession.chatId}`);
      
      // 초기화 확인
      if (!this.isInitialized) {
        await this.initialize();
      }

      // 평가 요청 구성
      const evaluationRequest = await this.buildEvaluationRequest(chatSession, options);
      
      // Multi-LLM 평가 실행
      const evaluationResult = await this.orchestrator.evaluateChat(evaluationRequest);
      
      // 결과 검증
      const validation = await this.validator.validateEvaluationResults(
        evaluationResult.providers,
        {
          strictMode: options?.strictValidation,
          generateReport: options?.generateReport,
          includeAdvancedAnalysis: options?.includeAdvancedAnalysis
        }
      );

      // 모델 설정 정보 가져오기
      const modelConfig = this.configManager.getModelConfig();

      // 메타데이터 구성
      const metadata = {
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: this.configManager.getConfigInfo().criteria_version || '1.0.0',
        providersUsed: evaluationResult.providers.map(p => p.name),
        modelSettings: {
          multiLLMEnabled: modelConfig.evaluation_mode?.multi_llm || false,
          comparisonMode: modelConfig.evaluation_mode?.comparison_mode || 'weighted_average',
          activeProviders: Object.entries(modelConfig.providers)
            .filter(([_, provider]: [string, any]) => provider.enabled)
            .map(([providerId, providerConfig]: [string, any]) => ({
              id: providerId,
              name: providerId === 'openai-gpt5' ? 'GPT-5-mini' : 
                    providerId === 'gemini-25' ? 'Gemini 2.5' : 
                    providerId === 'openai' ? 'GPT-4' : providerId,
              model: providerConfig.model,
              temperature: providerConfig.temperature,
              ...(providerId === 'openai-gpt5' && {
                reasoningEffort: providerConfig.reasoningEffort || 'medium',
                verbosity: providerConfig.verbosity || 'medium'
              }),
              ...(providerId === 'gemini-25' && {
                topP: providerConfig.top_p || 0.95,
                topK: providerConfig.top_k || 40
              })
            }))
        }
      };

      // 품질 확인
      if (!validation.isValid && options?.strictValidation) {
        throw new Error(`평가 결과 검증 실패: ${validation.recommendations.join(', ')}`);
      }

      console.log(`[MultiLLMEvaluationService] 평가 완료: ${metadata.processingTime}ms`);

      return {
        result: evaluationResult,
        validation,
        metadata,
        ...(validation.report && { report: validation.report })
      };
    } catch (error) {
      console.error(`[MultiLLMEvaluationService] 평가 실패 (${chatSession.chatId}):`, error);
      throw error;
    }
  }

  /**
   * 배치 상담 평가
   */
  async evaluateChatsBatch(
    chatSessions: ChatSession[],
    options?: {
      batchSize?: number;
      parallelism?: number;
      strictValidation?: boolean;
      progressCallback?: (completed: number, total: number, current?: any) => void;
      errorHandling?: 'fail-fast' | 'continue' | 'retry';
      retryAttempts?: number;
    }
  ): Promise<{
    results: any[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      averageProcessingTime: number;
      averageConfidence: number;
    };
    errors: any[];
  }> {
    const startTime = Date.now();
    const batchSize = options?.batchSize || 10;
    const parallelism = options?.parallelism || 3;
    const retryAttempts = options?.retryAttempts || 2;
    
    console.log(`[MultiLLMEvaluationService] 배치 평가 시작: ${chatSessions.length}건`);

    const results: any[] = [];
    const errors: any[] = [];
    let completed = 0;

    // 배치 단위로 처리
    for (let i = 0; i < chatSessions.length; i += batchSize) {
      const batch = chatSessions.slice(i, i + batchSize);
      
      // 병렬 처리 (세마포어 패턴)
      const semaphore = new Array(Math.min(parallelism, batch.length)).fill(null);
      const batchPromises = semaphore.map(async (_, index) => {
        const startIndex = index;
        
        for (let j = startIndex; j < batch.length; j += parallelism) {
          const chatSession = batch[j];
          let attempts = 0;
          let lastError: any;

          while (attempts <= retryAttempts) {
            try {
              const result = await this.evaluateChat(chatSession, {
                strictValidation: options?.strictValidation,
                generateReport: false,
                includeAdvancedAnalysis: false
              });

              results.push({
                chatId: chatSession.chatId,
                ...result
              });

              completed++;
              options?.progressCallback?.(completed, chatSessions.length, {
                chatId: chatSession.chatId,
                status: 'completed'
              });

              break; // 성공시 루프 종료
            } catch (error) {
              lastError = error;
              attempts++;
              
              if (attempts <= retryAttempts) {
                console.warn(`[MultiLLMEvaluationService] 재시도 ${attempts}/${retryAttempts}: ${chatSession.chatId}`);
                await this.delay(1000 * attempts); // 지수 백오프
              }
            }
          }

          // 모든 재시도 실패
          if (attempts > retryAttempts) {
            const errorInfo = {
              chatId: chatSession.chatId,
              error: lastError instanceof Error ? lastError.message : '알 수 없는 오류',
              attempts
            };

            errors.push(errorInfo);
            completed++;

            options?.progressCallback?.(completed, chatSessions.length, {
              chatId: chatSession.chatId,
              status: 'failed',
              error: errorInfo.error
            });

            // 오류 처리 전략
            if (options?.errorHandling === 'fail-fast') {
              throw lastError;
            }
          }
        }
      });

      await Promise.all(batchPromises);
    }

    // 요약 통계 계산
    const summary = this.calculateBatchSummary(results, errors, startTime);

    console.log(`[MultiLLMEvaluationService] 배치 평가 완료: ${summary.successful}/${summary.total}건 성공`);

    // 모델 설정 정보 추가
    const modelConfig = this.configManager.getModelConfig();
    const batchMetadata = {
      modelSettings: {
        multiLLMEnabled: modelConfig.evaluation_mode?.multi_llm || false,
        comparisonMode: modelConfig.evaluation_mode?.comparison_mode || 'weighted_average',
        activeProviders: Object.entries(modelConfig.providers)
          .filter(([_, provider]: [string, any]) => provider.enabled)
          .map(([providerId, providerConfig]: [string, any]) => ({
            id: providerId,
            name: providerId === 'openai-gpt5' ? 'GPT-5-mini' : 
                  providerId === 'gemini-25' ? 'Gemini 2.5' : 
                  providerId === 'openai' ? 'GPT-4' : providerId,
            model: providerConfig.model,
            temperature: providerConfig.temperature,
            ...(providerId === 'openai-gpt5' && {
              reasoningEffort: providerConfig.reasoningEffort || 'medium',
              verbosity: providerConfig.verbosity || 'medium'
            }),
            ...(providerId === 'gemini-25' && {
              topP: providerConfig.top_p || 0.95,
              topK: providerConfig.top_k || 40
            })
          }))
      },
      batchInfo: {
        totalProcessed: chatSessions.length,
        successful: summary.successful,
        failed: summary.failed,
        batchStartTime: new Date(startTime).toISOString(),
        batchEndTime: new Date().toISOString(),
        totalProcessingTime: Date.now() - startTime
      }
    };

    return {
      results,
      summary,
      errors,
      metadata: batchMetadata
    };
  }

  /**
   * 실시간 평가 스트림
   */
  async* evaluateStream(
    chatSessions: AsyncIterable<ChatSession>,
    options?: {
      bufferSize?: number;
      flushInterval?: number;
      validation?: boolean;
    }
  ): AsyncGenerator<{
    chatId: string;
    result?: ConsolidatedResult;
    validation?: any;
    error?: string;
    metadata: any;
  }> {
    const bufferSize = options?.bufferSize || 5;
    const flushInterval = options?.flushInterval || 1000;
    
    const buffer: ChatSession[] = [];
    let lastFlush = Date.now();

    for await (const chatSession of chatSessions) {
      buffer.push(chatSession);

      // 버퍼가 가득 찼거나 플러시 간격이 지난 경우
      if (buffer.length >= bufferSize || (Date.now() - lastFlush) >= flushInterval) {
        // 버퍼 내용 처리
        const batchResults = await this.processBatchStream(buffer, options);
        
        for (const result of batchResults) {
          yield result;
        }

        buffer.length = 0; // 버퍼 클리어
        lastFlush = Date.now();
      }
    }

    // 남은 버퍼 내용 처리
    if (buffer.length > 0) {
      const remainingResults = await this.processBatchStream(buffer, options);
      for (const result of remainingResults) {
        yield result;
      }
    }
  }

  /**
   * 평가 요청 구성
   */
  private async buildEvaluationRequest(
    chatSession: ChatSession,
    options?: any
  ): Promise<EvaluationRequest> {
    // 평가 기준 로드
    const criteria = this.configManager.getEvaluationCriteria();
    
    return {
      session: chatSession,
      criteria,
      options: {
        timeout: options?.timeout,
        providers: options?.providers
      }
    };
  }

  /**
   * 배치 스트림 처리
   */
  private async processBatchStream(
    batch: ChatSession[],
    options?: any
  ): Promise<any[]> {
    const results: any[] = [];

    // 병렬 처리
    const promises = batch.map(async (chatSession) => {
      try {
        const result = await this.evaluateChat(chatSession, {
          strictValidation: options?.validation,
          generateReport: false,
          includeAdvancedAnalysis: false
        });

        return {
          chatId: chatSession.chatId,
          result: result.result,
          validation: result.validation,
          metadata: result.metadata
        };
      } catch (error) {
        return {
          chatId: chatSession.chatId,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          metadata: {
            processingTime: 0,
            timestamp: new Date().toISOString(),
            version: 'error',
            providersUsed: []
          }
        };
      }
    });

    const settled = await Promise.allSettled(promises);
    
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    });

    return results;
  }

  /**
   * 배치 요약 계산
   */
  private calculateBatchSummary(results: any[], errors: any[], startTime: number): any {
    const total = results.length + errors.length;
    const successful = results.length;
    const failed = errors.length;
    
    const totalProcessingTime = Date.now() - startTime;
    const averageProcessingTime = successful > 0 ? 
      results.reduce((sum, r) => sum + r.metadata.processingTime, 0) / successful : 0;
    
    const averageConfidence = successful > 0 ?
      results.reduce((sum, r) => sum + r.validation.confidence, 0) / successful : 0;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? successful / total : 0,
      averageProcessingTime: Math.round(averageProcessingTime),
      totalProcessingTime,
      averageConfidence: parseFloat(averageConfidence.toFixed(3))
    };
  }

  /**
   * 설정 검증
   */
  private validateConfiguration(): void {
    const configInfo = this.configManager.getConfigInfo();
    
    if (configInfo.error) {
      throw new Error(`설정 오류: ${configInfo.error}`);
    }

    if (!configInfo.enabled_providers || configInfo.enabled_providers.length === 0) {
      throw new Error('활성화된 Provider가 없습니다.');
    }

    console.log(`[MultiLLMEvaluationService] 설정 검증 완료 - Provider: ${configInfo.enabled_providers.length}개`);
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 서비스 상태 확인
   */
  async getServiceStatus(): Promise<{
    initialized: boolean;
    orchestrator: any;
    validator: any;
    config: any;
    health: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      details: any;
    };
  }> {
    const health = await this.performHealthCheck();
    
    return {
      initialized: this.isInitialized,
      orchestrator: this.orchestrator.getStatus(),
      validator: 'ready', // EvaluationValidator는 getStatus 메서드가 없음
      config: this.configManager.getConfigInfo(),
      health
    };
  }

  /**
   * 헬스 체크
   */
  private async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const orchestratorStatus = this.orchestrator.getStatus();
      
      if (!orchestratorStatus.initialized) {
        return {
          status: 'unhealthy',
          details: { reason: 'Orchestrator not initialized' }
        };
      }

      if (orchestratorStatus.providerFactory.activeProviders === 0) {
        return {
          status: 'unhealthy',
          details: { reason: 'No active providers' }
        };
      }

      if (orchestratorStatus.providerFactory.activeProviders === 1) {
        return {
          status: 'degraded',
          details: { reason: 'Only one provider active' }
        };
      }

      return {
        status: 'healthy',
        details: {
          providers: orchestratorStatus.providerFactory.activeProviders,
          multiLLM: orchestratorStatus.providerFactory.multiLLMAvailable
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : '알 수 없는 오류' }
      };
    }
  }

  /**
   * 설정 새로고침
   */
  async reloadConfiguration(): Promise<void> {
    console.log('[MultiLLMEvaluationService] 설정 새로고침');
    
    await this.orchestrator.reloadConfiguration();
    this.validator.reloadConfiguration();
    
    this.validateConfiguration();
    
    console.log('[MultiLLMEvaluationService] 설정 새로고침 완료');
  }

  /**
   * 서비스 종료
   */
  async shutdown(): Promise<void> {
    console.log('[MultiLLMEvaluationService] 서비스 종료');
    
    this.isInitialized = false;
    
    // 필요시 리소스 정리
    
    console.log('[MultiLLMEvaluationService] 서비스 종료 완료');
  }
}