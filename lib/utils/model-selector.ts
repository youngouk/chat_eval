/**
 * 모델 선택기 유틸리티
 * 사용자가 다양한 모델을 선택할 수 있는 기능 제공
 */

export interface ModelOption {
  id: string;
  name: string;
  display_name: string;
  description: string;
  provider: string;
  cost: {
    input_per_1k: number;
    output_per_1k: number;
  };
  features: string[];
  performance: {
    speed: 'fast' | 'medium' | 'slow';
    accuracy: 'basic' | 'good' | 'high' | 'excellent';
    cost_efficiency: 'low' | 'medium' | 'high';
  };
}

export interface ModelCategory {
  category: string;
  description: string;
  models: ModelOption[];
}

/**
 * 사용 가능한 모든 모델 옵션
 */
export const availableModels: ModelOption[] = [
  // OpenAI 모델들
  {
    id: 'openai-gpt5-mini',
    name: 'gpt-5-mini',
    display_name: 'GPT-5 Mini',
    description: 'OpenAI의 최신 추론 모델, 빠르고 정확한 평가',
    provider: 'openai-gpt5',
    cost: {
      input_per_1k: 0.0002,
      output_per_1k: 0.0004
    },
    features: ['추론 제어', '응답 길이 조절', 'Responses API', '향상된 정확도'],
    performance: {
      speed: 'medium',
      accuracy: 'excellent',
      cost_efficiency: 'high'
    }
  },
  {
    id: 'openai-gpt4o',
    name: 'gpt-4o',
    display_name: 'GPT-4o (Legacy)',
    description: 'OpenAI GPT-4o 모델 (레거시 지원)',
    provider: 'openai',
    cost: {
      input_per_1k: 0.0025,
      output_per_1k: 0.01
    },
    features: ['안정적 성능', '호환성'],
    performance: {
      speed: 'medium',
      accuracy: 'high',
      cost_efficiency: 'medium'
    }
  },
  
  // Gemini 모델들
  {
    id: 'gemini-25-pro',
    name: 'gemini-2.5-pro',
    display_name: 'Gemini 2.5 Pro',
    description: '고성능 추론 및 복잡한 분석 작업에 최적화',
    provider: 'gemini-25',
    cost: {
      input_per_1k: 0.0005,
      output_per_1k: 0.001
    },
    features: ['심층 분석', '복잡한 추론', '상세한 피드백', '문화적 감수성'],
    performance: {
      speed: 'slow',
      accuracy: 'excellent',
      cost_efficiency: 'medium'
    }
  },
  {
    id: 'gemini-25-flash',
    name: 'gemini-2.5-flash',
    display_name: 'Gemini 2.5 Flash',
    description: '빠른 응답과 효율적인 처리에 최적화',
    provider: 'gemini-25',
    cost: {
      input_per_1k: 0.0001,
      output_per_1k: 0.0002
    },
    features: ['빠른 응답', '효율적 처리', '실시간 평가', '다각적 관점'],
    performance: {
      speed: 'fast',
      accuracy: 'high',
      cost_efficiency: 'high'
    }
  },
  {
    id: 'gemini-20-flash',
    name: 'gemini-2.0-flash-exp',
    display_name: 'Gemini 2.0 Flash (Legacy)',
    description: 'Gemini 2.0 Flash 실험 모델 (레거시 지원)',
    provider: 'gemini',
    cost: {
      input_per_1k: 0.00,
      output_per_1k: 0.00
    },
    features: ['무료 사용', '실험적 기능'],
    performance: {
      speed: 'fast',
      accuracy: 'good',
      cost_efficiency: 'high'
    }
  }
];

/**
 * 카테고리별 모델 분류
 */
export const modelCategories: ModelCategory[] = [
  {
    category: 'recommended',
    description: '추천 모델 - 성능과 비용의 최적 균형',
    models: availableModels.filter(m => 
      m.id === 'openai-gpt5-mini' || m.id === 'gemini-25-flash'
    )
  },
  {
    category: 'high-performance',
    description: '고성능 모델 - 최고 정확도가 필요한 경우',
    models: availableModels.filter(m => 
      m.performance.accuracy === 'excellent'
    )
  },
  {
    category: 'fast',
    description: '빠른 응답 모델 - 실시간 처리가 필요한 경우',
    models: availableModels.filter(m => 
      m.performance.speed === 'fast'
    )
  },
  {
    category: 'cost-effective',
    description: '비용 효율적 모델 - 대량 처리에 적합',
    models: availableModels.filter(m => 
      m.performance.cost_efficiency === 'high'
    )
  }
];

/**
 * 모델 ID로 모델 정보 조회
 */
export function getModelById(modelId: string): ModelOption | undefined {
  return availableModels.find(model => model.id === modelId);
}

/**
 * Provider별 모델 목록 조회
 */
export function getModelsByProvider(provider: string): ModelOption[] {
  return availableModels.filter(model => model.provider === provider);
}

/**
 * 성능 기준으로 모델 필터링
 */
export function filterModelsByPerformance(
  speed?: 'fast' | 'medium' | 'slow',
  accuracy?: 'basic' | 'good' | 'high' | 'excellent',
  costEfficiency?: 'low' | 'medium' | 'high'
): ModelOption[] {
  return availableModels.filter(model => {
    if (speed && model.performance.speed !== speed) return false;
    if (accuracy && model.performance.accuracy !== accuracy) return false;
    if (costEfficiency && model.performance.cost_efficiency !== costEfficiency) return false;
    return true;
  });
}

/**
 * 사용 목적에 따른 모델 추천
 */
export function getRecommendedModels(purpose: 'speed' | 'accuracy' | 'cost' | 'balanced'): ModelOption[] {
  switch (purpose) {
    case 'speed':
      return filterModelsByPerformance('fast');
    
    case 'accuracy':
      return filterModelsByPerformance(undefined, 'excellent');
    
    case 'cost':
      return filterModelsByPerformance(undefined, undefined, 'high');
    
    case 'balanced':
    default:
      return modelCategories.find(cat => cat.category === 'recommended')?.models || [];
  }
}

/**
 * 비용 계산 (1000 토큰 기준)
 */
export function calculateCost(model: ModelOption, inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * model.cost.input_per_1k;
  const outputCost = (outputTokens / 1000) * model.cost.output_per_1k;
  return inputCost + outputCost;
}

/**
 * 모델 비교 정보
 */
export interface ModelComparison {
  models: ModelOption[];
  comparison: {
    feature: string;
    values: { [modelId: string]: string };
  }[];
}

/**
 * 모델들을 비교하는 테이블 데이터 생성
 */
export function compareModels(modelIds: string[]): ModelComparison {
  const models = modelIds.map(id => getModelById(id)).filter(Boolean) as ModelOption[];
  
  const comparison = [
    {
      feature: '속도',
      values: Object.fromEntries(models.map(m => [m.id, m.performance.speed]))
    },
    {
      feature: '정확도',
      values: Object.fromEntries(models.map(m => [m.id, m.performance.accuracy]))
    },
    {
      feature: '비용 효율성',
      values: Object.fromEntries(models.map(m => [m.id, m.performance.cost_efficiency]))
    },
    {
      feature: 'Input 비용 (1K 토큰)',
      values: Object.fromEntries(models.map(m => [m.id, `$${m.cost.input_per_1k.toFixed(4)}`]))
    },
    {
      feature: 'Output 비용 (1K 토큰)',
      values: Object.fromEntries(models.map(m => [m.id, `$${m.cost.output_per_1k.toFixed(4)}`]))
    }
  ];

  return { models, comparison };
}

/**
 * 모델 설정을 Provider Factory에서 사용할 형태로 변환
 */
export function convertToProviderConfig(modelOption: ModelOption, overrides: any = {}): any {
  const baseConfig = {
    enabled: true,
    model: modelOption.name.startsWith('models/') ? modelOption.name : `models/${modelOption.name}`,
    temperature: 0.1,
    max_tokens: 4000,
    timeout: 30000,
    retry: {
      max_attempts: 3,
      backoff_multiplier: 2,
      initial_delay: 1000
    },
    cost: modelOption.cost,
    ...overrides
  };

  // Provider별 특화 설정
  if (modelOption.provider === 'openai-gpt5') {
    baseConfig.reasoningEffort = 'medium';
    baseConfig.verbosity = 'medium';
    baseConfig.endpoint = 'https://api.openai.com/v1/responses';
  } else if (modelOption.provider.startsWith('gemini')) {
    baseConfig.top_p = 0.95;
    baseConfig.top_k = 40;
    baseConfig.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  return baseConfig;
}