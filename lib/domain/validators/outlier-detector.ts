import { ThresholdConfig } from '@/lib/types/evaluation';

/**
 * IQR 기반 아웃라이어 검출 알고리즘
 * Interquartile Range를 사용하여 통계적 이상값을 식별
 */
export class OutlierDetector {
  private config: ThresholdConfig['outlier_detection'];

  constructor(config: ThresholdConfig['outlier_detection']) {
    this.config = config;
  }

  /**
   * IQR 방법으로 아웃라이어 검출
   */
  detectOutliers(values: number[]): {
    outliers: number[];
    outlierIndices: number[];
    statistics: {
      q1: number;
      q3: number;
      iqr: number;
      lowerBound: number;
      upperBound: number;
      outlierCount: number;
      outlierPercentage: number;
    };
    filteredValues: number[];
  } {
    if (values.length < this.config.min_samples) {
      return this.getEmptyResult(values);
    }

    // 값 정렬 (원본 배열 보존)
    const sortedValues = [...values].sort((a, b) => a - b);
    const n = sortedValues.length;

    // 사분위수 계산
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = this.calculateQuartile(sortedValues, 0.25);
    const q3 = this.calculateQuartile(sortedValues, 0.75);
    const iqr = q3 - q1;

    // 아웃라이어 경계 계산
    const multiplier = this.config.multiplier;
    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;

    // 아웃라이어 식별
    const outliers: number[] = [];
    const outlierIndices: number[] = [];
    const filteredValues: number[] = [];

    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        outliers.push(value);
        outlierIndices.push(index);
      } else {
        filteredValues.push(value);
      }
    });

    const statistics = {
      q1,
      q3,
      iqr,
      lowerBound,
      upperBound,
      outlierCount: outliers.length,
      outlierPercentage: (outliers.length / values.length) * 100
    };

    return {
      outliers,
      outlierIndices,
      statistics,
      filteredValues
    };
  }

  /**
   * 다중 시리즈 아웃라이어 검출
   * 여러 평가 시리즈에서 일관된 아웃라이어를 식별
   */
  detectMultiSeriesOutliers(seriesData: Record<string, number[]>): {
    seriesOutliers: Record<string, any>;
    consistentOutliers: number[];
    summary: {
      totalSeries: number;
      seriesWithOutliers: number;
      averageOutlierRate: number;
    };
  } {
    const seriesOutliers: Record<string, any> = {};
    const outlierCounts: Record<number, number> = {};

    // 각 시리즈별 아웃라이어 검출
    Object.entries(seriesData).forEach(([seriesName, values]) => {
      const result = this.detectOutliers(values);
      seriesOutliers[seriesName] = result;

      // 아웃라이어 인덱스 카운트
      result.outlierIndices.forEach(index => {
        outlierCounts[index] = (outlierCounts[index] || 0) + 1;
      });
    });

    // 일관된 아웃라이어 식별 (50% 이상의 시리즈에서 아웃라이어로 식별된 경우)
    const seriesCount = Object.keys(seriesData).length;
    const threshold = Math.ceil(seriesCount * 0.5);
    const consistentOutliers = Object.entries(outlierCounts)
      .filter(([_, count]) => count >= threshold)
      .map(([index, _]) => parseInt(index));

    // 요약 통계
    const seriesWithOutliers = Object.values(seriesOutliers)
      .filter((result: any) => result.outliers.length > 0).length;
    
    const totalOutlierRate = Object.values(seriesOutliers)
      .reduce((sum: number, result: any) => sum + result.statistics.outlierPercentage, 0);
    const averageOutlierRate = totalOutlierRate / Object.keys(seriesData).length;

    return {
      seriesOutliers,
      consistentOutliers,
      summary: {
        totalSeries: seriesCount,
        seriesWithOutliers,
        averageOutlierRate
      }
    };
  }

  /**
   * 적응형 아웃라이어 검출
   * 데이터 분포에 따라 멀티플라이어를 동적으로 조정
   */
  adaptiveOutlierDetection(values: number[]): {
    baseResult: any;
    adaptedResult: any;
    adaptedMultiplier: number;
    recommendation: string;
  } {
    if (values.length < this.config.min_samples) {
      const emptyResult = this.getEmptyResult(values);
      return {
        baseResult: emptyResult,
        adaptedResult: emptyResult,
        adaptedMultiplier: this.config.multiplier,
        recommendation: '샘플 크기가 너무 작아 적응형 검출을 수행할 수 없습니다.'
      };
    }

    // 기본 검출
    const baseResult = this.detectOutliers(values);
    
    // 데이터 분포 분석
    const distribution = this.analyzeDistribution(values);
    
    // 적응형 멀티플라이어 계산
    const adaptedMultiplier = this.calculateAdaptedMultiplier(distribution);
    
    // 적응형 검출 수행
    const originalMultiplier = this.config.multiplier;
    this.config.multiplier = adaptedMultiplier;
    const adaptedResult = this.detectOutliers(values);
    this.config.multiplier = originalMultiplier; // 원복

    // 권장사항 생성
    const recommendation = this.generateRecommendation(baseResult, adaptedResult, distribution);

    return {
      baseResult,
      adaptedResult,
      adaptedMultiplier,
      recommendation
    };
  }

  /**
   * 정확한 사분위수 계산 (선형 보간)
   */
  private calculateQuartile(sortedValues: number[], percentile: number): number {
    const n = sortedValues.length;
    const position = (n - 1) * percentile;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    
    if (lowerIndex === upperIndex) {
      return sortedValues[lowerIndex];
    }
    
    const fraction = position - lowerIndex;
    return sortedValues[lowerIndex] * (1 - fraction) + sortedValues[upperIndex] * fraction;
  }

  /**
   * 데이터 분포 분석
   */
  private analyzeDistribution(values: number[]): {
    mean: number;
    median: number;
    standardDeviation: number;
    skewness: number;
    kurtosis: number;
    isNormal: boolean;
  } {
    const n = values.length;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = this.calculateQuartile(sortedValues, 0.5);
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);
    
    // 왜도 계산
    const skewness = values.reduce((sum, val) => sum + Math.pow((val - mean) / standardDeviation, 3), 0) / n;
    
    // 첨도 계산
    const kurtosis = values.reduce((sum, val) => sum + Math.pow((val - mean) / standardDeviation, 4), 0) / n - 3;
    
    // 정규성 검증 (간단한 규칙 기반)
    const isNormal = Math.abs(skewness) < 0.5 && Math.abs(kurtosis) < 0.5;
    
    return {
      mean,
      median,
      standardDeviation,
      skewness,
      kurtosis,
      isNormal
    };
  }

  /**
   * 적응형 멀티플라이어 계산
   */
  private calculateAdaptedMultiplier(distribution: any): number {
    let multiplier = this.config.multiplier;
    
    // 왜도에 따른 조정
    if (Math.abs(distribution.skewness) > 1.0) {
      multiplier *= 1.2; // 더 관대하게
    }
    
    // 첨도에 따른 조정
    if (Math.abs(distribution.kurtosis) > 2.0) {
      multiplier *= 1.1; // 더 관대하게
    }
    
    // 정규분포가 아닌 경우 더 관대하게
    if (!distribution.isNormal) {
      multiplier *= 1.1;
    }
    
    // 범위 제한
    return Math.max(1.0, Math.min(3.0, multiplier));
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendation(baseResult: any, adaptedResult: any, distribution: any): string {
    const baseOutlierRate = baseResult.statistics.outlierPercentage;
    const adaptedOutlierRate = adaptedResult.statistics.outlierPercentage;
    
    if (baseOutlierRate > 20) {
      return '아웃라이어 비율이 높습니다. 데이터 품질을 검토하거나 더 관대한 기준을 적용하는 것을 고려하세요.';
    }
    
    if (adaptedOutlierRate < baseOutlierRate * 0.5) {
      return '적응형 검출이 더 합리적인 결과를 제공합니다. 적응형 결과 사용을 권장합니다.';
    }
    
    if (!distribution.isNormal) {
      return '데이터가 정규분포를 따르지 않습니다. 비모수적 방법을 고려하세요.';
    }
    
    return '기본 설정이 적절합니다.';
  }

  /**
   * 빈 결과 반환
   */
  private getEmptyResult(values: number[]): any {
    return {
      outliers: [],
      outlierIndices: [],
      statistics: {
        q1: 0,
        q3: 0,
        iqr: 0,
        lowerBound: 0,
        upperBound: 0,
        outlierCount: 0,
        outlierPercentage: 0
      },
      filteredValues: [...values]
    };
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: ThresholdConfig['outlier_detection']): void {
    this.config = config;
  }

  /**
   * 현재 설정 반환
   */
  getConfig(): ThresholdConfig['outlier_detection'] {
    return { ...this.config };
  }
}