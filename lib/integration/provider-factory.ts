import { ConfigManager } from '@/lib/config/manager';
import { BaseProvider } from './providers/base-provider';
import { OpenAIProvider } from './providers/openai-provider';
import { OpenAIGPT5Provider } from './providers/openai-gpt5-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { Gemini25Provider } from './providers/gemini-25-provider';
import { ModelConfig, ProviderConfig } from '@/lib/types/evaluation';

/**
 * Provider Factory 클래스
 * 설정에 따라 적절한 LLM Provider 인스턴스를 생성하고 관리
 */
export class ProviderFactory {
  private static instance: ProviderFactory;
  private configManager: ConfigManager;
  private providers: Map<string, BaseProvider> = new Map();

  private constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  static getInstance(): ProviderFactory {
    if (!this.instance) {
      this.instance = new ProviderFactory();
    }
    return this.instance;
  }

  /**
   * 모든 활성화된 Provider 초기화
   */
  async initializeProviders(): Promise<void> {
    try {
      const modelConfig = this.configManager.getModelConfig();
      
      console.log('[ProviderFactory] Provider 초기화 시작');
      
      // 기존 Provider들 정리
      this.providers.clear();
      
      // 각 Provider 설정을 확인하고 초기화
      for (const [providerName, config] of Object.entries(modelConfig.providers)) {
        if (config.enabled) {
          try {
            const provider = this.createProvider(providerName, config);
            
            // Provider 설정 검증
            await this.validateProvider(provider);
            
            this.providers.set(providerName, provider);
            console.log(`[ProviderFactory] ${providerName} Provider 초기화 완료`);
          } catch (error) {
            console.error(`[ProviderFactory] ${providerName} Provider 초기화 실패:`, error);
            // 개별 Provider 실패가 전체 시스템을 멈추지 않도록 함
          }
        } else {
          console.log(`[ProviderFactory] ${providerName} Provider 비활성화됨`);
        }
      }

      if (this.providers.size === 0) {
        throw new Error('사용 가능한 Provider가 없습니다.');
      }

      console.log(`[ProviderFactory] 총 ${this.providers.size}개 Provider 초기화 완료`);
    } catch (error) {
      console.error('[ProviderFactory] Provider 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 Provider 생성
   */
  private createProvider(name: string, config: ProviderConfig): BaseProvider {
    switch (name.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'openai-gpt5':
        return new OpenAIGPT5Provider(config);
      case 'gemini':
        return new GeminiProvider(config);
      case 'gemini-25':
        return new Gemini25Provider(config);
      default:
        throw new Error(`지원하지 않는 Provider: ${name}`);
    }
  }

  /**
   * Provider 유효성 검증
   */
  private async validateProvider(provider: BaseProvider): Promise<void> {
    const config = provider.getConfig();
    
    // 설정 검증
    if (!config.model) {
      throw new Error(`${provider.getName()} Provider의 모델이 설정되지 않았습니다.`);
    }

    if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
      throw new Error(`${provider.getName()} Provider의 temperature 설정이 유효하지 않습니다: ${config.temperature}`);
    }

    if (!config.max_tokens || config.max_tokens <= 0) {
      throw new Error(`${provider.getName()} Provider의 max_tokens 설정이 유효하지 않습니다: ${config.max_tokens}`);
    }

    // API 키 검증 (환경변수)
    if ((provider.getName() === 'openai' || provider.getName() === 'openai-gpt5') && !process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    if ((provider.getName() === 'gemini' || provider.getName() === 'gemini-25') && !process.env.GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    console.log(`[ProviderFactory] ${provider.getName()} Provider 검증 완료`);
  }

  /**
   * 활성화된 모든 Provider 반환
   */
  getActiveProviders(): BaseProvider[] {
    return Array.from(this.providers.values()).filter(provider => provider.isEnabled());
  }

  /**
   * 특정 Provider 반환
   */
  getProvider(name: string): BaseProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Provider 이름 목록 반환
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Multi-LLM 모드 사용 가능 여부 확인
   */
  isMultiLLMAvailable(): boolean {
    const modelConfig = this.configManager.getModelConfig();
    const activeProviders = this.getActiveProviders();
    
    return modelConfig.evaluation_mode.multi_llm && 
           activeProviders.length >= modelConfig.evaluation_mode.min_providers;
  }

  /**
   * 평가에 사용할 Provider들 선택
   */
  getProvidersForEvaluation(): BaseProvider[] {
    const modelConfig = this.configManager.getModelConfig();
    const activeProviders = this.getActiveProviders();

    if (activeProviders.length === 0) {
      throw new Error('사용 가능한 Provider가 없습니다.');
    }

    // Multi-LLM 모드인 경우
    if (this.isMultiLLMAvailable()) {
      console.log('[ProviderFactory] Multi-LLM 모드로 평가 실행');
      return activeProviders.slice(0, modelConfig.evaluation_mode.min_providers);
    }

    // Single LLM 모드인 경우 (첫 번째 활성화된 Provider 사용)
    if (modelConfig.evaluation_mode.fallback_to_single && activeProviders.length > 0) {
      console.log('[ProviderFactory] Single LLM 모드로 평가 실행');
      return [activeProviders[0]];
    }

    throw new Error('Multi-LLM 모드 요구사항을 만족하지 못했고, fallback도 비활성화되어 있습니다.');
  }

  /**
   * 모든 Provider 상태 확인
   */
  async healthCheckAll(): Promise<{[key: string]: any}> {
    const results: {[key: string]: any} = {};

    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        results[name] = {
          success: false,
          message: `Health check 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        };
      }
    }

    return results;
  }

  /**
   * Provider 통계 정보 수집
   */
  getProvidersStats(): {[key: string]: any} {
    const stats: {[key: string]: any} = {};

    for (const [name, provider] of this.providers) {
      stats[name] = provider.getStats();
    }

    return {
      totalProviders: this.providers.size,
      activeProviders: this.getActiveProviders().length,
      multiLLMAvailable: this.isMultiLLMAvailable(),
      providers: stats
    };
  }

  /**
   * 설정 새로고침 (hot-reload)
   */
  async reloadConfiguration(): Promise<void> {
    console.log('[ProviderFactory] 설정 새로고침 시작');
    
    try {
      // ConfigManager 강제 리로드
      this.configManager.forceReload();
      
      // Provider 재초기화
      await this.initializeProviders();
      
      console.log('[ProviderFactory] 설정 새로고침 완료');
    } catch (error) {
      console.error('[ProviderFactory] 설정 새로고침 실패:', error);
      throw error;
    }
  }

  /**
   * Provider Factory 상태 정보
   */
  getStatus(): {
    initialized: boolean;
    totalProviders: number;
    activeProviders: number;
    multiLLMAvailable: boolean;
    providers: string[];
  } {
    return {
      initialized: this.providers.size > 0,
      totalProviders: this.providers.size,
      activeProviders: this.getActiveProviders().length,
      multiLLMAvailable: this.isMultiLLMAvailable(),
      providers: this.getProviderNames()
    };
  }

  /**
   * 특정 Provider 비활성화
   */
  disableProvider(name: string): void {
    const provider = this.providers.get(name);
    if (provider) {
      this.providers.delete(name);
      console.log(`[ProviderFactory] ${name} Provider 비활성화됨`);
    }
  }

  /**
   * Factory 정리
   */
  cleanup(): void {
    this.providers.clear();
    console.log('[ProviderFactory] 정리 완료');
  }
}