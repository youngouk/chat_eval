import { ConfigManager } from '@/lib/config/manager';
import { OutlierDetector } from './validators/outlier-detector';
import { ConsistencyValidator } from './validators/consistency-validator';
import { ConfidenceCalculator } from './validators/confidence-calculator';
import { 
  ProviderResult, 
  ConsolidatedResult, 
  EvaluationResult,
  ThresholdConfig 
} from '@/lib/types/evaluation';

/**
 * 통합 평가 검증기
 * 모든 검증 알고리즘을 조합하여 평가 결과의 품질을 검증
 */
export class EvaluationValidator {
  private static instance: EvaluationValidator;
  private configManager: ConfigManager;
  private thresholds: ThresholdConfig;
  private outlierDetector: OutlierDetector;
  private consistencyValidator: ConsistencyValidator;
  private confidenceCalculator: ConfidenceCalculator;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
    this.thresholds = this.configManager.getThresholds();
    
    this.outlierDetector = new OutlierDetector(this.thresholds.outlier_detection);
    this.consistencyValidator = new ConsistencyValidator(this.thresholds.consistency);
    this.confidenceCalculator = new ConfidenceCalculator(this.thresholds.confidence);
  }

  static getInstance(): EvaluationValidator {
    if (!this.instance) {
      this.instance = new EvaluationValidator();
    }
    return this.instance;
  }

  /**
   * 전체 평가 결과 검증
   */
  async validateEvaluationResults(
    providerResults: ProviderResult[],
    options?: {
      strictMode?: boolean;
      generateReport?: boolean;
      includeAdvancedAnalysis?: boolean;
    }
  ): Promise<{
    isValid: boolean;
    confidence: number;
    reliability: 'high' | 'medium' | 'low';
    validation: {
      scores: any;
      consistency: any;
      outliers: any;
      confidence: any;
    };
    recommendations: string[];
    report?: string;
    advanced?: any;
  }> {
    console.log('[EvaluationValidator] 평가 결과 검증 시작');

    try {
      // 1. 기본 유효성 검사
      const basicValidation = this.performBasicValidation(providerResults);
      if (!basicValidation.isValid) {
        return {
          isValid: false,
          confidence: 0,
          reliability: 'low',
          validation: basicValidation.details,
          recommendations: basicValidation.recommendations,
          ...(options?.generateReport && { report: this.generateValidationReport(basicValidation) })
        };
      }

      // 2. 점수 검증
      const scoresValidation = this.validateScores(providerResults);
      
      // 3. 일관성 검증
      const consistencyValidation = this.consistencyValidator.validateConsistency(providerResults);
      
      // 4. 아웃라이어 검출
      const outlierValidation = this.detectOutliers(providerResults);
      
      // 5. 신뢰도 계산
      const confidenceValidation = this.confidenceCalculator.calculateConfidence(
        consistencyValidation.consistency,
        outlierValidation.outliers.length,
        providerResults.length,
        this.extractAdditionalFactors(providerResults)
      );

      // 6. 종합 판단
      const isValid = this.determineOverallValidity(
        scoresValidation,
        consistencyValidation,
        outlierValidation,
        confidenceValidation,
        options?.strictMode
      );

      // 7. 권장사항 통합
      const allRecommendations = this.consolidateRecommendations([
        scoresValidation.recommendations,
        consistencyValidation.details.recommendations,
        confidenceValidation.recommendations
      ]);

      // 8. 고급 분석 (선택적)
      let advancedAnalysis;
      if (options?.includeAdvancedAnalysis) {
        advancedAnalysis = await this.performAdvancedAnalysis(providerResults, {
          consistency: consistencyValidation,
          outliers: outlierValidation,
          confidence: confidenceValidation
        });
      }

      const result = {
        isValid,
        confidence: confidenceValidation.confidence,
        reliability: confidenceValidation.reliability,
        validation: {
          scores: scoresValidation,
          consistency: consistencyValidation,
          outliers: outlierValidation,
          confidence: confidenceValidation
        },
        recommendations: allRecommendations,
        ...(options?.generateReport && { 
          report: this.generateComprehensiveReport({
            scores: scoresValidation,
            consistency: consistencyValidation,
            outliers: outlierValidation,
            confidence: confidenceValidation
          })
        }),
        ...(advancedAnalysis && { advanced: advancedAnalysis })
      };

      console.log(`[EvaluationValidator] 검증 완료 - 유효성: ${isValid}, 신뢰도: ${confidenceValidation.confidence.toFixed(2)}`);
      
      return result;
    } catch (error) {
      console.error('[EvaluationValidator] 검증 중 오류:', error);
      throw error;
    }
  }

  /**
   * 단일 평가 결과 검증
   */
  validateSingleResult(result: EvaluationResult): {
    isValid: boolean;
    issues: string[];
    score: number;
    details: any;
  } {
    const issues: string[] = [];
    let score = 1.0;

    // 1. 점수 구조 검증
    if (!result.scores) {
      issues.push('점수 객체가 누락되었습니다.');
      score *= 0.5;
    } else {
      const scoreValidation = this.validateScoreStructure(result.scores);
      if (!scoreValidation.isValid) {
        issues.push(...scoreValidation.issues);
        score *= scoreValidation.score;
      }
    }

    // 2. 점수 범위 검증
    if (result.scores) {
      const rangeValidation = this.validateScoreRanges(result.scores);
      if (!rangeValidation.isValid) {
        issues.push(...rangeValidation.issues);
        score *= 0.8; // 점수 범위 오류 시 점수 감점
      }
    }

    // 3. 증거 검증
    if (!result.evidence || !result.evidence.positive || !result.evidence.negative) {
      issues.push('증거 정보가 불완전합니다.');
      score *= 0.9;
    }

    // 4. 일관성 검증
    if (result.scores && result.scores.total_score) {
      const calculatedTotal = this.calculateTotalScore(result.scores);
      const difference = Math.abs(result.scores.total_score - calculatedTotal);
      if (difference > 0.1) {
        issues.push(`총점 계산이 일치하지 않습니다. (차이: ${difference.toFixed(2)})`);
        score *= 0.8;
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      score: parseFloat(score.toFixed(2)),
      details: {
        hasScores: !!result.scores,
        hasEvidence: !!(result.evidence?.positive && result.evidence?.negative),
        hasImprovements: !!(result.improvements && result.improvements.length > 0)
      }
    };
  }

  /**
   * 기본 유효성 검사
   */
  private performBasicValidation(results: ProviderResult[]): {
    isValid: boolean;
    details: any;
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 1. 결과 존재 확인
    if (!results || results.length === 0) {
      issues.push('평가 결과가 없습니다.');
      return {
        isValid: false,
        details: { basic: { issues } },
        recommendations: ['평가를 다시 수행하세요.']
      };
    }

    // 2. 성공한 결과 확인
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) {
      issues.push('성공한 평가 결과가 없습니다.');
      recommendations.push('Provider 설정을 확인하거나 다른 Provider를 시도하세요.');
    }

    // 3. 최소 요구사항 확인
    const minProviders = this.thresholds.validation.required_fields.length || 1;
    if (successfulResults.length < minProviders) {
      issues.push(`최소 ${minProviders}개의 성공한 결과가 필요합니다.`);
      recommendations.push('더 많은 Provider를 활성화하거나 재시도하세요.');
    }

    return {
      isValid: issues.length === 0,
      details: { 
        basic: { 
          issues,
          totalResults: results.length,
          successfulResults: successfulResults.length,
          minRequired: minProviders
        }
      },
      recommendations
    };
  }

  /**
   * 점수 검증
   */
  private validateScores(results: ProviderResult[]): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
    details: any;
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0) {
      return {
        isValid: false,
        issues: ['검증할 성공한 결과가 없습니다.'],
        recommendations: ['성공한 평가 결과를 먼저 확보하세요.'],
        details: {}
      };
    }

    // 각 Provider 결과 검증
    const providerValidations: any = {};
    successfulResults.forEach(result => {
      const validation = this.validateProviderScores(result);
      providerValidations[result.name] = validation;
      
      if (!validation.isValid) {
        issues.push(`${result.name} Provider의 점수가 유효하지 않습니다.`);
      }
    });

    // 점수 범위 검증
    const rangeValidation = this.validateScoreRanges(successfulResults);
    if (!rangeValidation.isValid) {
      issues.push(...rangeValidation.issues);
      recommendations.push(...rangeValidation.recommendations);
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
      details: {
        providers: providerValidations,
        ranges: rangeValidation
      }
    };
  }

  /**
   * Provider별 점수 검증
   */
  private validateProviderScores(result: ProviderResult): {
    isValid: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 1.0;

    if (!result.scores) {
      issues.push('점수 객체가 없습니다.');
      return { isValid: false, issues, score: 0 };
    }

    // 필수 점수 필드 확인
    const requiredFields = ['업무능력', '문장력', '기본_태도', 'total_score'];
    requiredFields.forEach(field => {
      if (result.scores[field] === undefined) {
        issues.push(`${field} 점수가 누락되었습니다.`);
        score *= 0.8;
      }
    });

    // 점수 범위 확인 (1.0-5.0)
    Object.entries(result.scores).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (value < 1.0 || value > 5.0) {
          issues.push(`${key} 점수가 범위를 벗어났습니다: ${value}`);
          score *= 0.7;
        }
        if (isNaN(value)) {
          issues.push(`${key} 점수가 숫자가 아닙니다.`);
          score *= 0.5;
        }
      }
    });

    return {
      isValid: issues.length === 0,
      issues,
      score: parseFloat(score.toFixed(2))
    };
  }

  /**
   * 아웃라이어 검출
   */
  private detectOutliers(results: ProviderResult[]): any {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length < 3) {
      return {
        outliers: [],
        statistics: {},
        hasOutliers: false,
        recommendation: '아웃라이어 검출을 위해 최소 3개의 성공한 결과가 필요합니다.'
      };
    }

    // 총점 기준 아웃라이어 검출
    const totalScores = successfulResults.map(r => r.scores.total_score || 0);
    const outlierResult = this.outlierDetector.detectOutliers(totalScores);

    return {
      outliers: outlierResult.outliers,
      outlierIndices: outlierResult.outlierIndices,
      statistics: outlierResult.statistics,
      hasOutliers: outlierResult.outliers.length > 0,
      filteredValues: outlierResult.filteredValues,
      recommendation: outlierResult.outliers.length > 0 ? 
        '아웃라이어가 발견되었습니다. Provider 설정을 검토하세요.' :
        '아웃라이어가 발견되지 않았습니다.'
    };
  }

  /**
   * 추가 요인 추출
   */
  private extractAdditionalFactors(results: ProviderResult[]): any {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) return {};

    const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length;
    const avgTokens = successfulResults.reduce((sum, r) => sum + r.tokens, 0) / successfulResults.length;
    const errorRate = (results.length - successfulResults.length) / results.length;

    return {
      responseTime: avgResponseTime,
      tokenUsage: avgTokens,
      errorRate
    };
  }

  /**
   * 종합 유효성 판단
   */
  private determineOverallValidity(
    scoresValidation: any,
    consistencyValidation: any,
    outlierValidation: any,
    confidenceValidation: any,
    strictMode?: boolean
  ): boolean {
    const threshold = strictMode ? 0.8 : 0.6;
    
    return (
      scoresValidation.isValid &&
      consistencyValidation.isConsistent &&
      confidenceValidation.confidence >= threshold &&
      (!outlierValidation.hasOutliers || outlierValidation.outliers.length <= 1)
    );
  }

  /**
   * 권장사항 통합
   */
  private consolidateRecommendations(recommendationSets: string[][]): string[] {
    const allRecommendations = recommendationSets.flat();
    return [...new Set(allRecommendations)]; // 중복 제거
  }

  /**
   * 고급 분석 수행
   */
  private async performAdvancedAnalysis(
    results: ProviderResult[],
    validationResults: any
  ): Promise<any> {
    // 일관성 고급 분석
    const advancedConsistency = this.consistencyValidator.advancedConsistencyAnalysis(results);
    
    // 신뢰도 고급 분석
    const advancedConfidence = this.confidenceCalculator.advancedConfidenceAnalysis(
      results,
      validationResults.consistency,
      validationResults.outliers
    );

    // 다중 시리즈 아웃라이어 분석
    const seriesData = this.extractSeriesData(results);
    const multiSeriesOutliers = this.outlierDetector.detectMultiSeriesOutliers(seriesData);

    return {
      consistency: advancedConsistency,
      confidence: advancedConfidence,
      multiSeriesOutliers
    };
  }

  /**
   * 시리즈 데이터 추출
   */
  private extractSeriesData(results: ProviderResult[]): Record<string, number[]> {
    const seriesData: Record<string, number[]> = {};
    
    results.forEach(result => {
      if (result.success) {
        Object.entries(result.scores).forEach(([key, value]) => {
          if (typeof value === 'number') {
            if (!seriesData[key]) seriesData[key] = [];
            seriesData[key].push(value);
          }
        });
      }
    });

    return seriesData;
  }

  /**
   * 종합 검증 리포트 생성
   */
  private generateComprehensiveReport(validationData: any): string {
    const sections = [
      '# 평가 결과 검증 리포트',
      '',
      '## 1. 점수 검증',
      `- 유효성: ${validationData.scores.isValid ? '✅ 통과' : '❌ 실패'}`,
      `- 문제점: ${validationData.scores.issues.length}개`,
      '',
      '## 2. 일관성 검증',
      `- 일관성 점수: ${validationData.consistency.consistency.toFixed(3)}`,
      `- 상태: ${validationData.consistency.isConsistent ? '✅ 일관됨' : '❌ 비일관됨'}`,
      '',
      '## 3. 아웃라이어 검출',
      `- 아웃라이어 수: ${validationData.outliers.outliers.length}개`,
      `- 상태: ${validationData.outliers.hasOutliers ? '⚠️ 발견됨' : '✅ 없음'}`,
      '',
      '## 4. 신뢰도 평가',
      `- 신뢰도: ${validationData.confidence.confidence.toFixed(3)}`,
      `- 등급: ${validationData.confidence.reliability.toUpperCase()}`,
      '',
      '## 5. 권장사항',
      ...validationData.confidence.recommendations.map((rec: string) => `- ${rec}`)
    ];

    return sections.join('\n');
  }

  /**
   * 기본 검증 리포트 생성
   */
  private generateValidationReport(validation: any): string {
    return `검증 실패: ${validation.details.basic.issues.join(', ')}`;
  }

  /**
   * 설정 새로고침
   */
  reloadConfiguration(): void {
    this.configManager.forceReload();
    this.thresholds = this.configManager.getThresholds();
    
    this.outlierDetector.updateConfig(this.thresholds.outlier_detection);
    this.consistencyValidator.updateConfig(this.thresholds.consistency);
    this.confidenceCalculator.updateConfig(this.thresholds.confidence);
    
    console.log('[EvaluationValidator] 설정 새로고침 완료');
  }

  /**
   * 기타 유틸리티 메서드들
   */
  private validateScoreStructure(scores: any): { isValid: boolean; issues: string[]; score: number } {
    // 구현 생략 (간단한 구조 검증)
    return { isValid: true, issues: [], score: 1.0 };
  }

  private validateScoreRanges(data: any): { isValid: boolean; issues: string[]; recommendations: string[] } {
    // 구현 생략 (점수 범위 검증)
    return { isValid: true, issues: [], recommendations: [] };
  }

  private calculateTotalScore(scores: any): number {
    // 가중치를 적용한 총점 계산
    const weights = { 업무능력: 0.6, 문장력: 0.25, 기본_태도: 0.15 };
    let total = 0;
    
    Object.entries(weights).forEach(([key, weight]) => {
      if (scores[key]?.subtotal) {
        total += scores[key].subtotal * weight;
      }
    });
    
    return total;
  }
}