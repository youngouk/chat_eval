// 평가 관련 타입 정의
export interface EvaluationCriteria {
  version: string;
  lastUpdated: string;
  author: string;
  evaluation_criteria: {
    업무능력: CriteriaSection;
    문장력: CriteriaSection;
    기본_태도: CriteriaSection;
  };
  scoring: ScoringConfig;
  filters: FilterConfig;
}

export interface CriteriaSection {
  weight: number;
  subcriteria: Record<string, SubCriteria>;
}

export interface SubCriteria {
  weight: number;
  description: string;
  evaluation_points?: string[];
}

export interface ScoringConfig {
  scale: {
    min: number;
    max: number;
    step: number;
  };
  thresholds: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
  problematic_criteria: {
    total_score: number;
    업무능력: number;
    문장력: number;
    기본태도: number;
    relative_threshold: number;
  };
}

export interface FilterConfig {
  exclude_patterns: string[];
  exclude_tags: string[];
  include_tags: string[];
}

export interface ChatSession {
  chatId: string;
  userId: string;
  managerId: string;
  messages: Message[];
  metadata: {
    startTime: Date;
    endTime?: Date;
    device?: string;
    channel?: string;
    tags?: string[];
    rating?: number;
    duration?: number;
  };
}

export interface Message {
  type: 'user' | 'manager' | 'bot';
  text: string;
  timestamp: Date;
  createdAt?: string;
  date?: string;
}

export interface EvaluationResult {
  scores: {
    업무능력: ScoreDetail;
    문장력: ScoreDetail;
    기본_태도: ScoreDetail;
    total_score: number;
  };
  evidence: Evidence;
  improvements: string[];
  problematic: boolean;
  severity: 'high' | 'medium' | 'low' | 'none';
  provider?: string;
  model?: string;
  responseTime?: number;
  tokens?: number;
  cost?: number;
}

export interface ScoreDetail {
  value?: number;
  subtotal: number;
  [key: string]: number | undefined;
}

export interface Evidence {
  positive: string[];
  negative: string[];
  quotes: string[];
}

export interface ConsolidatedResult {
  scores: {
    업무능력: number;
    문장력: number;
    기본_태도: number;
    총점: number;
  };
  validation: {
    consistency: number;
    confidence: number;
    reliability: 'high' | 'medium' | 'low';
    outliers: number[];
  };
  providers: ProviderResult[];
  evidence: Evidence;
  metadata: {
    criteriaVersion: string;
    processingTime: number;
    timestamp: string;
  };
}

export interface ProviderResult {
  name: string;
  model: string;
  scores: Record<string, number>;
  responseTime: number;
  tokens: number;
  cost: number;
  success: boolean;
  error?: string;
}

export interface ModelConfig {
  providers: Record<string, ProviderConfig>;
  default_settings: DefaultSettings;
  evaluation_mode: {
    multi_llm: boolean;
    min_providers: number;
    fallback_to_single: boolean;
  };
}

export interface ProviderConfig {
  enabled: boolean;
  model: string;
  temperature: number;
  max_tokens: number;
  timeout: number;
  retry: RetryConfig;
  cost: CostConfig;
  endpoint: string;
}

export interface RetryConfig {
  max_attempts: number;
  backoff_multiplier: number;
  initial_delay: number;
}

export interface CostConfig {
  input_per_1k: number;
  output_per_1k: number;
}

export interface DefaultSettings {
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  response_format: {
    type: string;
  };
}

export interface ThresholdConfig {
  consistency: {
    target: number;
    minimum: number;
    calculation: string;
  };
  confidence: {
    target: number;
    minimum: number;
    factors: {
      consistency_weight: number;
      outlier_weight: number;
      sample_size_weight: number;
    };
  };
  outlier_detection: {
    method: string;
    multiplier: number;
    min_samples: number;
  };
  validation: {
    score_range: {
      min: number;
      max: number;
    };
    max_deviation: number;
    required_fields: string[];
  };
  performance: {
    timeout_per_provider: number;
    total_timeout: number;
    max_retries: number;
    backoff_base: number;
  };
}

// Multi-LLM 평가를 위한 요청 타입
export interface EvaluationRequest {
  session: ChatSession;
  criteria: EvaluationCriteria;
  options?: {
    providers?: string[];
    timeout?: number;
    retries?: number;
  };
}