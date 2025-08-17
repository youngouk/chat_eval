import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EvaluationCriteria, ModelConfig, ThresholdConfig } from '@/lib/types/evaluation';

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private criteria: EvaluationCriteria | null = null;
  private models: ModelConfig | null = null;
  private thresholds: ThresholdConfig | null = null;
  private lastUpdate: Map<string, number> = new Map();

  private constructor() {
    this.configPath = join(process.cwd(), 'config');
  }

  static getInstance(): ConfigManager {
    if (!this.instance) {
      this.instance = new ConfigManager();
    }
    return this.instance;
  }

  /**
   * 평가 기준 설정 로드
   */
  getEvaluationCriteria(version = '1.0'): EvaluationCriteria {
    const filePath = join(this.configPath, 'evaluation', `criteria-v${version}.json`);
    
    if (!existsSync(filePath)) {
      throw new Error(`평가 기준 파일을 찾을 수 없습니다: ${filePath}`);
    }

    // 파일 변경 감지
    const stat = require('fs').statSync(filePath);
    const lastModified = stat.mtime.getTime();
    const cacheKey = `criteria-${version}`;

    if (!this.criteria || this.lastUpdate.get(cacheKey) !== lastModified) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        this.criteria = JSON.parse(content);
        this.lastUpdate.set(cacheKey, lastModified);
        console.log(`[Config] 평가 기준 로드됨: v${version}`);
      } catch (error) {
        console.error(`[Config] 평가 기준 로드 실패:`, error);
        // 이전 버전으로 롤백 시도
        if (this.criteria) {
          console.log(`[Config] 이전 버전 사용: v${this.criteria.version}`);
          return this.criteria;
        }
        throw new Error(`평가 기준 로드 실패: ${error}`);
      }
    }

    if (!this.criteria) {
      throw new Error('평가 기준을 로드할 수 없습니다');
    }
    return this.criteria;
  }

  /**
   * 모델 설정 로드
   */
  getModelConfig(): ModelConfig {
    const filePath = join(this.configPath, 'models.json');
    
    if (!existsSync(filePath)) {
      throw new Error(`모델 설정 파일을 찾을 수 없습니다: ${filePath}`);
    }

    const stat = require('fs').statSync(filePath);
    const lastModified = stat.mtime.getTime();
    const cacheKey = 'models';

    if (!this.models || this.lastUpdate.get(cacheKey) !== lastModified) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        this.models = JSON.parse(content);
        this.lastUpdate.set(cacheKey, lastModified);
        console.log(`[Config] 모델 설정 로드됨`);
      } catch (error) {
        console.error(`[Config] 모델 설정 로드 실패:`, error);
        if (this.models) {
          return this.models;
        }
        throw new Error(`모델 설정 로드 실패: ${error}`);
      }
    }

    if (!this.models) {
      throw new Error('모델 설정을 로드할 수 없습니다');
    }
    return this.models;
  }

  /**
   * 임계값 설정 로드
   */
  getThresholds(): ThresholdConfig {
    const filePath = join(this.configPath, 'evaluation', 'thresholds.json');
    
    if (!existsSync(filePath)) {
      throw new Error(`임계값 설정 파일을 찾을 수 없습니다: ${filePath}`);
    }

    const stat = require('fs').statSync(filePath);
    const lastModified = stat.mtime.getTime();
    const cacheKey = 'thresholds';

    if (!this.thresholds || this.lastUpdate.get(cacheKey) !== lastModified) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        this.thresholds = JSON.parse(content);
        this.lastUpdate.set(cacheKey, lastModified);
        console.log(`[Config] 임계값 설정 로드됨`);
      } catch (error) {
        console.error(`[Config] 임계값 설정 로드 실패:`, error);
        if (this.thresholds) {
          return this.thresholds;
        }
        throw new Error(`임계값 설정 로드 실패: ${error}`);
      }
    }

    if (!this.thresholds) {
      throw new Error('임계값 설정을 로드할 수 없습니다');
    }
    return this.thresholds;
  }

  /**
   * 프롬프트 템플릿 로드
   */
  getPromptTemplate(): any {
    const filePath = join(this.configPath, 'prompts', 'base-template.json');
    
    if (!existsSync(filePath)) {
      throw new Error(`프롬프트 템플릿을 찾을 수 없습니다: ${filePath}`);
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`프롬프트 템플릿 로드 실패: ${error}`);
    }
  }

  /**
   * 설정 유효성 검증
   */
  validateConfig(): boolean {
    try {
      const criteria = this.getEvaluationCriteria();
      const models = this.getModelConfig();
      const thresholds = this.getThresholds();

      // 기본 유효성 검사
      if (!criteria.version || !models.providers || !thresholds.consistency) {
        return false;
      }

      // 가중치 합계 검사
      const totalWeight = criteria.evaluation_criteria.업무능력.weight +
                         criteria.evaluation_criteria.문장력.weight +
                         criteria.evaluation_criteria.기본_태도.weight;
      
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        console.warn(`[Config] 가중치 합계 오류: ${totalWeight}`);
        return false;
      }

      // 활성화된 Provider 확인
      const enabledProviders = Object.values(models.providers).filter(p => p.enabled);
      if (enabledProviders.length === 0) {
        console.warn(`[Config] 활성화된 Provider가 없습니다`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[Config] 설정 검증 실패:`, error);
      return false;
    }
  }

  /**
   * 설정 정보 반환
   */
  getConfigInfo() {
    try {
      const criteria = this.getEvaluationCriteria();
      const models = this.getModelConfig();
      
      return {
        criteria_version: criteria.version,
        last_updated: criteria.lastUpdated,
        enabled_providers: Object.entries(models.providers)
          .filter(([_, config]) => config.enabled)
          .map(([name, config]) => ({
            name,
            model: config.model,
            temperature: config.temperature
          })),
        multi_llm_enabled: models.evaluation_mode.multi_llm
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 강제 리로드
   */
  forceReload() {
    this.criteria = null;
    this.models = null;
    this.thresholds = null;
    this.lastUpdate.clear();
    console.log(`[Config] 설정 강제 리로드`);
  }
}