import { ThresholdConfig, ProviderResult } from '@/lib/types/evaluation';

/**
 * 신뢰도 계산 알고리즘
 * 일관성, 아웃라이어, 샘플 크기 등을 종합하여 평가 결과의 신뢰도를 계산
 */
export class ConfidenceCalculator {
  private config: ThresholdConfig['confidence'];

  constructor(config: ThresholdConfig['confidence']) {
    this.config = config;
  }

  /**
   * 기본 신뢰도 계산
   */
  calculateConfidence(
    consistency: number,
    outlierCount: number,
    totalResults: number,
    additionalFactors?: {
      responseTime?: number;
      tokenUsage?: number;
      errorRate?: number;
      historicalPerformance?: number;
    }
  ): {
    confidence: number;
    reliability: 'high' | 'medium' | 'low';
    components: {
      consistency: number;
      outlier: number;
      sampleSize: number;
      additional?: number;
    };
    assessment: string;
    recommendations: string[];
  } {
    const factors = this.config.factors;
    
    // 1. 일관성 기여도
    const consistencyComponent = Math.min(1, consistency) * factors.consistency_weight;
    
    // 2. 아웃라이어 기여도 (아웃라이어가 적을수록 좋음)
    const outlierRatio = totalResults > 0 ? outlierCount / totalResults : 0;
    const outlierComponent = Math.max(0, 1 - outlierRatio) * factors.outlier_weight;
    
    // 3. 샘플 크기 기여도
    const sampleSizeComponent = this.calculateSampleSizeContribution(totalResults) * factors.sample_size_weight;
    
    // 4. 추가 요인들
    const additionalComponent = this.calculateAdditionalFactors(additionalFactors);
    
    // 최종 신뢰도 계산
    const baseConfidence = consistencyComponent + outlierComponent + sampleSizeComponent;
    const finalConfidence = Math.min(1, Math.max(0, baseConfidence + additionalComponent));
    
    // 신뢰도 등급 결정
    const reliability = this.determineReliability(finalConfidence, consistency);
    
    // 평가 및 권장사항
    const assessment = this.generateAssessment(finalConfidence, consistency, outlierRatio);
    const recommendations = this.generateRecommendations(finalConfidence, consistency, outlierCount, totalResults);

    return {
      confidence: parseFloat(finalConfidence.toFixed(3)),
      reliability,
      components: {
        consistency: parseFloat(consistencyComponent.toFixed(3)),
        outlier: parseFloat(outlierComponent.toFixed(3)),
        sampleSize: parseFloat(sampleSizeComponent.toFixed(3)),
        ...(additionalComponent !== 0 && { additional: parseFloat(additionalComponent.toFixed(3)) })
      },
      assessment,
      recommendations
    };
  }

  /**
   * 고급 신뢰도 분석
   */
  advancedConfidenceAnalysis(
    results: ProviderResult[],
    consistencyData: any,
    outlierData: any,
    historicalData?: {
      pastEvaluations: number[];
      averageConsistency: number;
      successRate: number;
    }
  ): {
    basicConfidence: any;
    temporalStability: number;
    crossValidation: number;
    uncertaintyQuantification: {
      confidenceInterval: [number, number];
      standardError: number;
      predictionInterval: [number, number];
    };
    qualityScore: number;
  } {
    // 기본 신뢰도 계산
    const basicConfidence = this.calculateConfidence(
      consistencyData.consistency,
      outlierData.outliers?.length || 0,
      results.length
    );

    // 시간적 안정성 (과거 데이터와 비교)
    const temporalStability = this.calculateTemporalStability(results, historicalData);
    
    // 교차 검증 신뢰도
    const crossValidation = this.calculateCrossValidation(results);
    
    // 불확실성 정량화
    const uncertaintyQuantification = this.quantifyUncertainty(results);
    
    // 전체 품질 점수
    const qualityScore = this.calculateQualityScore(
      basicConfidence.confidence,
      temporalStability,
      crossValidation,
      uncertaintyQuantification.standardError
    );

    return {
      basicConfidence,
      temporalStability,
      crossValidation,
      uncertaintyQuantification,
      qualityScore
    };
  }

  /**
   * 샘플 크기 기여도 계산
   */
  private calculateSampleSizeContribution(totalResults: number): number {
    if (totalResults <= 0) return 0;
    
    // 로그 스케일 기반 계산 (많을수록 좋지만 수익 체감)
    const optimal = 5; // 최적 Provider 수
    const ratio = Math.min(1, totalResults / optimal);
    
    // 로그 변환으로 수익 체감 효과 적용
    return Math.log(1 + ratio) / Math.log(2);
  }

  /**
   * 추가 요인들 계산
   */
  private calculateAdditionalFactors(factors?: {
    responseTime?: number;
    tokenUsage?: number;
    errorRate?: number;
    historicalPerformance?: number;
  }): number {
    if (!factors) return 0;
    
    let additionalScore = 0;
    let factorCount = 0;
    
    // 응답 시간 (빠를수록 좋음, 하지만 너무 빠르면 의심)
    if (factors.responseTime !== undefined) {
      const responseTimeScore = this.scoreResponseTime(factors.responseTime);
      additionalScore += responseTimeScore;
      factorCount++;
    }
    
    // 토큰 사용량 (적절한 수준이어야 함)
    if (factors.tokenUsage !== undefined) {
      const tokenScore = this.scoreTokenUsage(factors.tokenUsage);
      additionalScore += tokenScore;
      factorCount++;
    }
    
    // 오류율 (낮을수록 좋음)
    if (factors.errorRate !== undefined) {
      const errorScore = Math.max(0, 1 - factors.errorRate);
      additionalScore += errorScore;
      factorCount++;
    }
    
    // 과거 성능 (높을수록 좋음)
    if (factors.historicalPerformance !== undefined) {
      additionalScore += Math.min(1, Math.max(0, factors.historicalPerformance));
      factorCount++;
    }
    
    // 추가 요인들의 가중치는 전체의 10%
    return factorCount > 0 ? (additionalScore / factorCount) * 0.1 : 0;
  }

  /**
   * 응답 시간 점수 계산
   */
  private scoreResponseTime(responseTime: number): number {
    // 1-10초가 최적, 그 외는 감점
    if (responseTime < 1) return 0.5; // 너무 빠름 (의심스러움)
    if (responseTime <= 10) return 1.0; // 최적
    if (responseTime <= 30) return 0.8; // 양호
    if (responseTime <= 60) return 0.6; // 보통
    return 0.3; // 너무 느림
  }

  /**
   * 토큰 사용량 점수 계산
   */
  private scoreTokenUsage(tokenUsage: number): number {
    // 500-2000 토큰이 적절
    if (tokenUsage < 100) return 0.3; // 너무 적음
    if (tokenUsage <= 500) return 0.7; // 적음
    if (tokenUsage <= 2000) return 1.0; // 최적
    if (tokenUsage <= 4000) return 0.8; // 많음
    return 0.5; // 너무 많음
  }

  /**
   * 시간적 안정성 계산
   */
  private calculateTemporalStability(
    currentResults: ProviderResult[],
    historicalData?: {
      pastEvaluations: number[];
      averageConsistency: number;
      successRate: number;
    }
  ): number {
    if (!historicalData || historicalData.pastEvaluations.length === 0) {
      return 0.5; // 기본값
    }

    // 현재 결과와 과거 결과 비교
    const currentAverage = this.calculateAverageScore(currentResults);
    const historicalAverage = historicalData.pastEvaluations.reduce((sum, val) => sum + val, 0) / historicalData.pastEvaluations.length;
    
    // 차이가 적을수록 안정성이 높음
    const difference = Math.abs(currentAverage - historicalAverage);
    const stability = Math.max(0, 1 - (difference / 2)); // 최대 2점 차이까지 허용
    
    return stability;
  }

  /**
   * 교차 검증 계산
   */
  private calculateCrossValidation(results: ProviderResult[]): number {
    if (results.length < 3) return 0.5; // 최소 3개 Provider 필요
    
    // Leave-one-out 교차 검증 시뮬레이션
    let totalConsistency = 0;
    
    for (let i = 0; i < results.length; i++) {
      const trainingSet = results.filter((_, index) => index !== i);
      const testResult = results[i];
      
      // 훈련 세트의 평균과 테스트 결과 비교
      const trainingAverage = this.calculateAverageScore(trainingSet);
      const testScore = testResult.scores.total_score || 0;
      
      const consistency = 1 - Math.abs(trainingAverage - testScore) / 2.5; // 정규화
      totalConsistency += Math.max(0, consistency);
    }
    
    return totalConsistency / results.length;
  }

  /**
   * 불확실성 정량화
   */
  private quantifyUncertainty(results: ProviderResult[]): {
    confidenceInterval: [number, number];
    standardError: number;
    predictionInterval: [number, number];
  } {
    const scores = results
      .filter(r => r.success)
      .map(r => r.scores.total_score || 0);
    
    if (scores.length < 2) {
      return {
        confidenceInterval: [0, 0],
        standardError: 0,
        predictionInterval: [0, 0]
      };
    }

    const mean = scores.reduce((sum, val) => sum + val, 0) / scores.length;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (scores.length - 1);
    const standardError = Math.sqrt(variance / scores.length);
    
    // 95% 신뢰구간 (t-분포 근사)
    const tValue = this.getTValue(scores.length - 1, 0.05);
    const margin = tValue * standardError;
    
    const confidenceInterval: [number, number] = [
      Math.max(1, mean - margin),
      Math.min(5, mean + margin)
    ];
    
    // 예측구간 (개별 값에 대한)
    const predictionMargin = tValue * Math.sqrt(variance + Math.pow(standardError, 2));
    const predictionInterval: [number, number] = [
      Math.max(1, mean - predictionMargin),
      Math.min(5, mean + predictionMargin)
    ];

    return {
      confidenceInterval,
      standardError: parseFloat(standardError.toFixed(3)),
      predictionInterval
    };
  }

  /**
   * 전체 품질 점수 계산
   */
  private calculateQualityScore(
    confidence: number,
    temporalStability: number,
    crossValidation: number,
    standardError: number
  ): number {
    const weights = {
      confidence: 0.4,
      temporal: 0.2,
      crossVal: 0.2,
      precision: 0.2
    };
    
    const precisionScore = Math.max(0, 1 - standardError);
    
    const qualityScore = 
      confidence * weights.confidence +
      temporalStability * weights.temporal +
      crossValidation * weights.crossVal +
      precisionScore * weights.precision;
    
    return parseFloat(qualityScore.toFixed(3));
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
   * 평가 생성
   */
  private generateAssessment(confidence: number, consistency: number, outlierRatio: number): string {
    if (confidence >= this.config.target) {
      return '신뢰도가 목표 수준에 도달했습니다. 평가 결과를 신뢰할 수 있습니다.';
    } else if (confidence >= this.config.minimum) {
      return '신뢰도가 최소 기준은 만족하지만 개선의 여지가 있습니다.';
    } else {
      return '신뢰도가 기준 이하입니다. 추가 검증이나 개선이 필요합니다.';
    }
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendations(
    confidence: number,
    consistency: number,
    outlierCount: number,
    totalResults: number
  ): string[] {
    const recommendations: string[] = [];

    if (confidence < this.config.minimum) {
      recommendations.push('신뢰도가 기준 이하입니다. Provider 설정을 재검토하거나 추가 Provider를 활성화하세요.');
    }

    if (consistency < 0.6) {
      recommendations.push('일관성이 낮습니다. 평가 기준을 더 명확히 하거나 프롬프트를 개선하세요.');
    }

    if (outlierCount > totalResults * 0.3) {
      recommendations.push('아웃라이어가 많습니다. Provider별 설정을 점검하고 일관성을 개선하세요.');
    }

    if (totalResults < 2) {
      recommendations.push('더 많은 Provider를 활성화하여 신뢰도를 향상시키세요.');
    }

    if (recommendations.length === 0) {
      recommendations.push('신뢰도가 양호합니다. 현재 설정을 유지하세요.');
    }

    return recommendations;
  }

  /**
   * 평균 점수 계산
   */
  private calculateAverageScore(results: ProviderResult[]): number {
    const scores = results
      .filter(r => r.success)
      .map(r => r.scores.total_score || 0);
    
    return scores.length > 0 ? scores.reduce((sum, val) => sum + val, 0) / scores.length : 0;
  }

  /**
   * t-분포 임계값 (근사)
   */
  private getTValue(df: number, alpha: number): number {
    // 간단한 t-분포 근사 (실제로는 더 정확한 계산 필요)
    if (df >= 30) return 1.96; // 정규분포 근사
    if (df >= 20) return 2.086;
    if (df >= 10) return 2.228;
    if (df >= 5) return 2.571;
    return 3.182; // df=1~4
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: ThresholdConfig['confidence']): void {
    this.config = config;
  }

  /**
   * 현재 설정 반환
   */
  getConfig(): ThresholdConfig['confidence'] {
    return { ...this.config };
  }
}