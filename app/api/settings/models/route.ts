import { NextRequest, NextResponse } from 'next/server';
import { ConfigManager } from '@/lib/config/manager';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * 모델 설정 조회 API
 * GET /api/settings/models
 */
export async function GET() {
  try {
    const configManager = ConfigManager.getInstance();
    const modelConfig = configManager.getModelConfig();
    
    return NextResponse.json(modelConfig, { status: 200 });
  } catch (error) {
    console.error('[Settings] 모델 설정 조회 실패:', error);
    
    return NextResponse.json(
      { 
        error: '모델 설정을 조회할 수 없습니다',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 모델 설정 저장 API
 * POST /api/settings/models
 */
export async function POST(request: NextRequest) {
  try {
    const newConfig = await request.json();
    
    // 설정 유효성 검증
    const validationResult = validateModelConfig(newConfig);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { 
          error: '유효하지 않은 설정입니다',
          details: validationResult.errors
        },
        { status: 400 }
      );
    }

    // 설정 파일 경로
    const configPath = join(process.cwd(), 'config', 'models.json');
    
    // 기존 설정 백업
    if (existsSync(configPath)) {
      const backupPath = join(process.cwd(), 'config', `models.backup.${Date.now()}.json`);
      try {
        const currentConfig = require('fs').readFileSync(configPath, 'utf-8');
        writeFileSync(backupPath, currentConfig);
        console.log(`[Settings] 설정 백업 완료: ${backupPath}`);
      } catch (backupError) {
        console.warn('[Settings] 설정 백업 실패:', backupError);
      }
    }

    // 새 설정 저장
    const formattedConfig = {
      ...newConfig,
      lastUpdated: new Date().toISOString(),
      version: "2.0"
    };

    writeFileSync(configPath, JSON.stringify(formattedConfig, null, 2));
    console.log('[Settings] 모델 설정 저장 완료');

    // ConfigManager 강제 리로드
    const configManager = ConfigManager.getInstance();
    configManager.forceReload();

    // 변경된 설정 검증
    try {
      const updatedConfig = configManager.getModelConfig();
      const isValid = configManager.validateConfig();
      
      if (!isValid) {
        console.warn('[Settings] 저장된 설정의 유효성 검증 실패');
      }

      return NextResponse.json({
        success: true,
        message: '설정이 성공적으로 저장되었습니다',
        config: updatedConfig,
        validation: {
          isValid,
          enabledProviders: Object.entries(updatedConfig.providers)
            .filter(([_, provider]) => provider.enabled)
            .length
        }
      });
    } catch (verificationError) {
      console.error('[Settings] 저장 후 검증 실패:', verificationError);
      
      return NextResponse.json({
        success: true,
        message: '설정이 저장되었지만 검증에 실패했습니다',
        warning: '다음 평가 시 설정을 확인해주세요'
      });
    }
  } catch (error) {
    console.error('[Settings] 모델 설정 저장 실패:', error);
    
    return NextResponse.json(
      { 
        error: '설정 저장에 실패했습니다',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 모델 설정 유효성 검증
 */
function validateModelConfig(config: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 기본 구조 검증
  if (!config || typeof config !== 'object') {
    errors.push('설정 객체가 유효하지 않습니다');
    return { isValid: false, errors };
  }

  // providers 필드 검증
  if (!config.providers || typeof config.providers !== 'object') {
    errors.push('providers 설정이 누락되었습니다');
  } else {
    // 각 provider 검증
    for (const [providerId, provider] of Object.entries(config.providers)) {
      if (!provider || typeof provider !== 'object') {
        errors.push(`Provider ${providerId}의 설정이 유효하지 않습니다`);
        continue;
      }

      const p = provider as any;

      // 필수 필드 검증
      if (typeof p.enabled !== 'boolean') {
        errors.push(`Provider ${providerId}의 enabled 설정이 누락되었습니다`);
      }

      if (!p.model || typeof p.model !== 'string') {
        errors.push(`Provider ${providerId}의 model 설정이 누락되었습니다`);
      }

      if (typeof p.temperature !== 'number' || p.temperature < 0 || p.temperature > 2) {
        errors.push(`Provider ${providerId}의 temperature 설정이 유효하지 않습니다 (0-2 범위)`);
      }

      // GPT-5 전용 설정 검증
      if (providerId === 'openai-gpt5') {
        if (p.reasoningEffort && !['minimal', 'low', 'medium', 'high'].includes(p.reasoningEffort)) {
          errors.push(`Provider ${providerId}의 reasoningEffort 설정이 유효하지 않습니다`);
        }
        
        if (p.verbosity && !['low', 'medium', 'high'].includes(p.verbosity)) {
          errors.push(`Provider ${providerId}의 verbosity 설정이 유효하지 않습니다`);
        }
      }

      // Gemini 전용 설정 검증
      if (providerId === 'gemini-25') {
        if (p.top_p && (typeof p.top_p !== 'number' || p.top_p < 0 || p.top_p > 1)) {
          errors.push(`Provider ${providerId}의 top_p 설정이 유효하지 않습니다 (0-1 범위)`);
        }
        
        if (p.top_k && (typeof p.top_k !== 'number' || p.top_k < 1 || p.top_k > 100)) {
          errors.push(`Provider ${providerId}의 top_k 설정이 유효하지 않습니다 (1-100 범위)`);
        }
      }
    }

    // 활성화된 provider 최소 1개 검증
    const enabledProviders = Object.values(config.providers).filter(
      (p: any) => p.enabled === true
    );
    
    if (enabledProviders.length === 0) {
      errors.push('최소 하나의 Provider가 활성화되어야 합니다');
    }
  }

  // evaluation_mode 필드 검증
  if (!config.evaluation_mode || typeof config.evaluation_mode !== 'object') {
    errors.push('evaluation_mode 설정이 누락되었습니다');
  } else {
    if (typeof config.evaluation_mode.multi_llm !== 'boolean') {
      errors.push('evaluation_mode.multi_llm 설정이 유효하지 않습니다');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 설정 초기화 API
 * DELETE /api/settings/models
 */
export async function DELETE() {
  try {
    const configManager = ConfigManager.getInstance();
    
    // 기본 설정으로 복원
    const defaultConfig = getDefaultModelConfig();
    
    const configPath = join(process.cwd(), 'config', 'models.json');
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    
    // ConfigManager 강제 리로드
    configManager.forceReload();
    
    console.log('[Settings] 모델 설정이 기본값으로 초기화되었습니다');
    
    return NextResponse.json({
      success: true,
      message: '설정이 기본값으로 초기화되었습니다',
      config: defaultConfig
    });
  } catch (error) {
    console.error('[Settings] 설정 초기화 실패:', error);
    
    return NextResponse.json(
      { 
        error: '설정 초기화에 실패했습니다',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 기본 모델 설정 반환
 */
function getDefaultModelConfig() {
  return {
    version: "2.0",
    lastUpdated: new Date().toISOString(),
    providers: {
      "openai-gpt5": {
        enabled: true,
        model: "gpt-5-mini",
        temperature: 0.1,
        max_tokens: 4000,
        reasoningEffort: "medium",
        verbosity: "medium",
        endpoint: "https://api.openai.com/v1/responses"
      },
      "gemini-25": {
        enabled: true,
        model: "models/gemini-2.5-flash",
        temperature: 0.1,
        max_tokens: 4000,
        top_p: 0.95,
        top_k: 40
      },
      "openai": {
        enabled: false,
        model: "gpt-4o",
        temperature: 0.1,
        max_tokens: 4000
      }
    },
    evaluation_mode: {
      multi_llm: true,
      comparison_mode: "weighted_average",
      confidence_threshold: 0.8
    }
  };
}