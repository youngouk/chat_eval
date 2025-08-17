import { ProviderFactory } from './provider-factory';
import { ConfigManager } from '@/lib/config/manager';
import { 
  EvaluationRequest, 
  EvaluationResult, 
  ConsolidatedResult, 
  ProviderResult,
  ThresholdConfig 
} from '@/lib/types/evaluation';

/**
 * Multi-LLM 평가 오케스트레이터
 * 여러 LLM Provider의 평가 결과를 조합하고 일관성을 검증
 */
export class EvaluationOrchestrator {
  private static instance: EvaluationOrchestrator;
  private providerFactory: ProviderFactory;
  private configManager: ConfigManager;
  private thresholds: ThresholdConfig;

  private constructor() {
    this.providerFactory = ProviderFactory.getInstance();
    this.configManager = ConfigManager.getInstance();
    this.thresholds = this.configManager.getThresholds();
  }

  static getInstance(): EvaluationOrchestrator {
    if (!this.instance) {
      this.instance = new EvaluationOrchestrator();
    }
    return this.instance;
  }

  /**
   * 오케스트레이터 초기화
   */
  async initialize(): Promise<void> {
    console.log('[Orchestrator] 초기화 시작');
    
    try {
      // Provider Factory 초기화
      await this.providerFactory.initializeProviders();
      
      // 설정 검증
      this.validateConfiguration();
      
      console.log('[Orchestrator] 초기화 완료');
    } catch (error) {
      console.error('[Orchestrator] 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * Multi-LLM 평가 실행
   */
  async evaluateChat(request: EvaluationRequest): Promise<ConsolidatedResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Orchestrator] 상담 평가 시작: ChatID ${request.session.chatId}`);
      
      // 사용할 Provider들 선택
      const providers = this.providerFactory.getProvidersForEvaluation();
      
      if (providers.length === 0) {
        throw new Error('사용 가능한 평가 Provider가 없습니다.');
      }

      console.log(`[Orchestrator] ${providers.length}개 Provider로 평가 진행: ${providers.map(p => p.getName()).join(', ')}`);

      // 병렬 평가 실행
      const evaluationResults = await this.executeParallelEvaluations(providers, request);
      
      // 결과 통합 및 검증
      const consolidatedResult = await this.consolidateResults(evaluationResults, request);
      
      console.log(`[Orchestrator] 평가 완료: ${Date.now() - startTime}ms`);
      
      return consolidatedResult;
    } catch (error) {
      console.error('[Orchestrator] 평가 실패:', error);
      throw error;
    }
  }

  /**
   * 병렬 평가 실행
   */
  private async executeParallelEvaluations(
    providers: any[], 
    request: EvaluationRequest
  ): Promise<ProviderResult[]> {
    const results: ProviderResult[] = [];
    
    // Promise.allSettled로 개별 Provider 실패가 전체를 멈추지 않도록 함
    const evaluationPromises = providers.map(async (provider) => {
      const startTime = Date.now();
      
      try {
        console.log(`[Orchestrator] ${provider.getName()} 평가 시작`);
        
        const result = await provider.evaluateWithRetry(request);
        const responseTime = Date.now() - startTime;
        
        console.log(`[Orchestrator] ${provider.getName()} 평가 완료: ${responseTime}ms`);
        
        return {
          name: provider.getName(),
          model: provider.getConfig().model,
          scores: this.extractScores(result),
          responseTime,
          tokens: result.tokens || 0,
          cost: result.cost || 0,
          success: true
        } as ProviderResult;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        console.error(`[Orchestrator] ${provider.getName()} 평가 실패:`, error);
        
        return {
          name: provider.getName(),
          model: provider.getConfig().model,
          scores: {},
          responseTime,
          tokens: 0,
          cost: 0,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        } as ProviderResult;
      }
    });

    const settledResults = await Promise.allSettled(evaluationPromises);
    
    // 성공한 결과들만 수집
    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`[Orchestrator] Provider ${providers[index].getName()} Promise 실패:`, result.reason);
      }
    });

    // 최소 하나의 성공적인 평가가 필요
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) {
      throw new Error('모든 Provider에서 평가가 실패했습니다.');
    }

    console.log(`[Orchestrator] ${successfulResults.length}/${results.length} Provider 평가 성공`);
    
    return results;
  }

  /**
   * 결과 통합 및 검증
   */
  private async consolidateResults(
    providerResults: ProviderResult[], 
    request: EvaluationRequest
  ): Promise<ConsolidatedResult> {
    const successfulResults = providerResults.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      throw new Error('통합할 성공적인 평가 결과가 없습니다.');
    }

    // 점수 통합
    const consolidatedScores = this.consolidateScores(successfulResults);
    
    // 일관성 검증
    const validation = this.validateConsistency(successfulResults);
    
    // 아웃라이어 검출
    const outliers = this.detectOutliers(successfulResults);
    
    // 신뢰도 계산
    const confidence = this.calculateConfidence(validation.consistency, outliers.length, successfulResults.length);
    
    // 증거 통합
    const evidence = this.consolidateEvidence(successfulResults);
    
    const result: ConsolidatedResult = {
      scores: {
        업무능력: consolidatedScores.업무능력 || 3.0,
        문장력: consolidatedScores.문장력 || 3.0,
        기본_태도: consolidatedScores.기본_태도 || 3.0,
        총점: consolidatedScores.total_score || 3.0
      },
      validation: {
        consistency: validation.consistency,
        confidence,
        reliability: this.determineReliability(confidence, validation.consistency),
        outliers
      },
      providers: providerResults,
      evidence,
      metadata: {
        criteriaVersion: request.criteria.version,
        processingTime: Date.now(),
        timestamp: new Date().toISOString()
      }
    };

    console.log(`[Orchestrator] 결과 통합 완료 - 신뢰도: ${confidence.toFixed(2)}, 일관성: ${validation.consistency.toFixed(2)}`);
    
    return result;
  }

  /**
   * 점수 통합 (IQR 기반)
   */
  private consolidateScores(results: ProviderResult[]): Record<string, number> {
    const consolidated: Record<string, number> = {};
    
    // 각 점수 항목별로 통합
    const scoreKeys = new Set<string>();
    results.forEach(result => {
      Object.keys(result.scores).forEach(key => scoreKeys.add(key));
    });

    scoreKeys.forEach(key => {
      const values = results
        .map(result => result.scores[key])
        .filter(value => typeof value === 'number' && !isNaN(value))
        .sort((a, b) => a - b);

      if (values.length > 0) {
        if (values.length === 1) {
          consolidated[key] = values[0];
        } else if (values.length === 2) {
          consolidated[key] = (values[0] + values[1]) / 2;
        } else {
          // IQR 기반 아웃라이어 제거 후 평균
          const q1Index = Math.floor(values.length * 0.25);
          const q3Index = Math.floor(values.length * 0.75);
          const q1 = values[q1Index];
          const q3 = values[q3Index];
          const iqr = q3 - q1;
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;
          
          const filteredValues = values.filter(v => v >= lowerBound && v <= upperBound);
          
          if (filteredValues.length > 0) {
            consolidated[key] = filteredValues.reduce((sum, val) => sum + val, 0) / filteredValues.length;
          } else {
            // 모든 값이 아웃라이어인 경우 중앙값 사용
            const medianIndex = Math.floor(values.length / 2);
            consolidated[key] = values[medianIndex];
          }
        }
      }
    });

    return consolidated;
  }

  /**
   * 일관성 검증
   */
  private validateConsistency(results: ProviderResult[]): { consistency: number; details: any } {
    if (results.length < 2) {
      return { consistency: 1.0, details: { message: '단일 Provider 결과' } };
    }

    const scoreKeys = new Set<string>();
    results.forEach(result => {
      Object.keys(result.scores).forEach(key => scoreKeys.add(key));
    });

    let totalVariance = 0;
    let validComparisons = 0;
    const details: any = {};

    scoreKeys.forEach(key => {
      const values = results
        .map(result => result.scores[key])
        .filter(value => typeof value === 'number' && !isNaN(value));

      if (values.length >= 2) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);
        
        totalVariance += variance;
        validComparisons++;
        
        details[key] = {
          mean: mean.toFixed(2),
          standardDeviation: standardDeviation.toFixed(2),
          values: values.map(v => v.toFixed(2))
        };
      }
    });

    const averageVariance = validComparisons > 0 ? totalVariance / validComparisons : 0;
    
    // 일관성 점수 계산 (0-1, 1이 가장 일관성 있음)
    const consistency = Math.max(0, 1 - (averageVariance / 2)); // 분산이 2를 넘으면 일관성 0
    
    return { consistency, details };
  }

  /**
   * 아웃라이어 검출
   */
  private detectOutliers(results: ProviderResult[]): number[] {
    if (results.length < 3) return []; // 최소 3개 결과 필요
    
    const totalScores = results
      .map(result => result.scores.total_score || result.scores.총점)
      .filter(score => typeof score === 'number' && !isNaN(score))
      .sort((a, b) => a - b);

    if (totalScores.length < 3) return [];

    // IQR 방법으로 아웃라이어 검출
    const q1Index = Math.floor(totalScores.length * 0.25);
    const q3Index = Math.floor(totalScores.length * 0.75);
    const q1 = totalScores[q1Index];
    const q3 = totalScores[q3Index];
    const iqr = q3 - q1;
    const multiplier = this.thresholds.outlier_detection.multiplier;
    
    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;

    const outliers: number[] = [];
    totalScores.forEach((score, index) => {
      if (score < lowerBound || score > upperBound) {
        outliers.push(index);
      }
    });

    return outliers;
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(consistency: number, outlierCount: number, totalResults: number): number {
    const factors = this.thresholds.confidence.factors;
    
    // 일관성 기여도
    const consistencyContribution = consistency * factors.consistency_weight;
    
    // 아웃라이어 기여도 (아웃라이어가 적을수록 좋음)
    const outlierRatio = outlierCount / totalResults;
    const outlierContribution = Math.max(0, 1 - outlierRatio) * factors.outlier_weight;
    
    // 샘플 크기 기여도
    const sampleSizeRatio = Math.min(1, totalResults / 3); // 3개 이상이면 최대값
    const sampleSizeContribution = sampleSizeRatio * factors.sample_size_weight;
    
    const confidence = consistencyContribution + outlierContribution + sampleSizeContribution;
    
    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * 신뢰도 등급 결정
   */
  private determineReliability(confidence: number, consistency: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.8 && consistency >= 0.8) {
      return 'high';
    } else if (confidence >= 0.6 && consistency >= 0.6) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 증거 통합
   */
  private consolidateEvidence(results: ProviderResult[]): any {
    const evidence = {
      positive: new Set<string>(),
      negative: new Set<string>(),
      quotes: new Set<string>()
    };

    results.forEach(result => {
      // Provider별 증거 통합 (실제 구현에서는 result에서 evidence 추출)
      // 현재는 기본 구조만 제공
    });

    return {
      positive: Array.from(evidence.positive),
      negative: Array.from(evidence.negative),
      quotes: Array.from(evidence.quotes)
    };
  }

  /**
   * 점수 추출
   */
  private extractScores(result: EvaluationResult): Record<string, number> {
    const scores: Record<string, number> = {};
    
    if (result.scores) {
      // 각 섹션의 subtotal 추출
      if (result.scores.업무능력?.subtotal) {
        scores.업무능력 = result.scores.업무능력.subtotal;
      }
      if (result.scores.문장력?.subtotal) {
        scores.문장력 = result.scores.문장력.subtotal;
      }
      if (result.scores.기본_태도?.subtotal) {
        scores.기본_태도 = result.scores.기본_태도.subtotal;
      }
      if (result.scores.total_score) {
        scores.total_score = result.scores.total_score;
      }
    }
    
    return scores;
  }

  /**
   * 설정 검증
   */
  private validateConfiguration(): void {
    const providers = this.providerFactory.getActiveProviders();
    
    if (providers.length === 0) {
      throw new Error('활성화된 Provider가 없습니다.');
    }

    // Multi-LLM 설정 검증
    if (this.providerFactory.isMultiLLMAvailable()) {
      console.log('[Orchestrator] Multi-LLM 모드 사용 가능');
    } else {
      console.log('[Orchestrator] Single-LLM 모드로 동작');
    }

    console.log(`[Orchestrator] 설정 검증 완료 - ${providers.length}개 Provider 활성화`);
  }

  /**
   * 오케스트레이터 상태 정보
   */
  getStatus(): any {
    return {
      initialized: true,
      providerFactory: this.providerFactory.getStatus(),
      thresholds: {
        consistency: this.thresholds.consistency,
        confidence: this.thresholds.confidence,
        outlier_detection: this.thresholds.outlier_detection
      }
    };
  }

  /**
   * 설정 새로고침
   */
  async reloadConfiguration(): Promise<void> {
    console.log('[Orchestrator] 설정 새로고침');
    
    this.configManager.forceReload();
    this.thresholds = this.configManager.getThresholds();
    
    await this.providerFactory.reloadConfiguration();
    
    console.log('[Orchestrator] 설정 새로고침 완료');
  }
}