'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Settings, Zap, Brain, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProviderConfig {
  enabled: boolean;
  model: string;
  temperature: number;
  max_tokens?: number;
  reasoningEffort?: string;
  verbosity?: string;
  top_p?: number;
  top_k?: number;
}

interface ModelConfig {
  providers: Record<string, ProviderConfig>;
  evaluation_mode: {
    multi_llm: boolean;
    comparison_mode: string;
  };
}

interface SettingsPageProps {}

export default function SettingsPage(): JSX.Element {
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 모델 정보 정의
  const modelInfo = {
    'openai-gpt5': {
      name: 'GPT-5-mini',
      icon: <Brain className="w-4 h-4" />,
      description: 'OpenAI의 최신 GPT-5-mini 모델 (Responses API)',
      features: ['고성능 추론', '비용 효율적', 'CoT 지원'],
      options: {
        reasoningEffort: ['minimal', 'low', 'medium', 'high'],
        verbosity: ['low', 'medium', 'high']
      }
    },
    'gemini-25': {
      name: 'Gemini 2.5',
      icon: <Zap className="w-4 h-4" />,
      description: 'Google의 Gemini 2.5 Pro/Flash 모델',
      features: ['빠른 처리', '문화적 감수성', '다각적 관점'],
      options: {
        model: ['models/gemini-2.5-pro', 'models/gemini-2.5-flash']
      }
    },
    'openai': {
      name: 'GPT-4',
      icon: <MessageSquare className="w-4 h-4" />,
      description: '레거시 GPT-4 모델 (호환성용)',
      features: ['검증된 성능', '안정성'],
      options: {}
    }
  };

  // 설정 로드
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/settings/models');
      if (!response.ok) {
        throw new Error(`설정 로드 실패: ${response.status}`);
      }
      
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setError(errorMessage);
      console.error('설정 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  // 설정 저장
  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/settings/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`설정 저장 실패: ${response.status}`);
      }

      setSuccess('설정이 성공적으로 저장되었습니다.');
      
      // 성공 메시지를 3초 후 제거
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다';
      setError(errorMessage);
      console.error('설정 저장 오류:', err);
    } finally {
      setSaving(false);
    }
  };

  // Provider 활성화/비활성화 토글
  const toggleProvider = (providerId: string) => {
    if (!config) return;

    setConfig({
      ...config,
      providers: {
        ...config.providers,
        [providerId]: {
          ...config.providers[providerId],
          enabled: !config.providers[providerId].enabled
        }
      }
    });
  };

  // Provider 설정 업데이트
  const updateProviderConfig = (providerId: string, key: string, value: any) => {
    if (!config) return;

    setConfig({
      ...config,
      providers: {
        ...config.providers,
        [providerId]: {
          ...config.providers[providerId],
          [key]: value
        }
      }
    });
  };

  // Multi-LLM 모드 토글
  const toggleMultiLLM = () => {
    if (!config) return;

    setConfig({
      ...config,
      evaluation_mode: {
        ...config.evaluation_mode,
        multi_llm: !config.evaluation_mode.multi_llm
      }
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Settings className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-lg text-gray-600">설정을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchConfig}
              className="ml-2"
            >
              다시 시도
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const enabledProviders = config ? Object.entries(config.providers).filter(([_, provider]) => provider.enabled) : [];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          <Settings className="inline-block w-8 h-8 mr-3" />
          AI 모델 설정
        </h1>
        <p className="text-gray-600">
          평가에 사용할 AI 모델을 선택하고 설정을 조정하세요.
        </p>
      </div>

      {/* 알림 메시지 */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {config && (
        <>
          {/* 전역 설정 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                평가 모드 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Multi-LLM 평가</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    여러 AI 모델을 동시에 사용하여 더 정확한 평가를 수행합니다.
                  </p>
                </div>
                <Switch 
                  checked={config.evaluation_mode.multi_llm}
                  onCheckedChange={toggleMultiLLM}
                />
              </div>
              
              {config.evaluation_mode.multi_llm && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>활성화된 모델:</strong> {enabledProviders.length}개
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {enabledProviders.map(([id, provider]) => (
                      <Badge key={id} variant="secondary" className="bg-blue-100 text-blue-800">
                        {modelInfo[id as keyof typeof modelInfo]?.name || id} - {provider.model}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Provider 설정 */}
          <div className="space-y-6">
            {Object.entries(config.providers).map(([providerId, providerConfig]) => {
              const info = modelInfo[providerId as keyof typeof modelInfo];
              
              return (
                <Card key={providerId} className={`${providerConfig.enabled ? 'ring-2 ring-blue-200' : 'opacity-60'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {info?.icon}
                        <div>
                          <CardTitle className="text-lg">{info?.name || providerId}</CardTitle>
                          <p className="text-sm text-gray-600 mt-1">{info?.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {providerConfig.enabled ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            활성화
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            <XCircle className="w-3 h-3 mr-1" />
                            비활성화
                          </Badge>
                        )}
                        <Switch 
                          checked={providerConfig.enabled}
                          onCheckedChange={() => toggleProvider(providerId)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  
                  {providerConfig.enabled && (
                    <CardContent className="space-y-4">
                      {/* 기능 배지 */}
                      {info?.features && (
                        <div className="flex flex-wrap gap-2">
                          {info.features.map((feature) => (
                            <Badge key={feature} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <Separator />

                      {/* 모델별 상세 설정 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 기본 설정 */}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">기본 설정</Label>
                          
                          <div>
                            <Label htmlFor={`model-${providerId}`} className="text-xs text-gray-600">모델</Label>
                            {info?.options?.model ? (
                              <Select 
                                value={providerConfig.model} 
                                onValueChange={(value) => updateProviderConfig(providerId, 'model', value)}
                              >
                                <SelectTrigger id={`model-${providerId}`} className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {info.options.model.map((model) => (
                                    <SelectItem key={model} value={model}>
                                      {model.includes('pro') ? '🚀 Pro (고성능)' : 
                                       model.includes('flash') ? '⚡ Flash (고속)' : model}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                {providerConfig.model}
                              </div>
                            )}
                          </div>

                          <div>
                            <Label htmlFor={`temp-${providerId}`} className="text-xs text-gray-600">Temperature</Label>
                            <Select 
                              value={providerConfig.temperature.toString()} 
                              onValueChange={(value) => updateProviderConfig(providerId, 'temperature', parseFloat(value))}
                            >
                              <SelectTrigger id={`temp-${providerId}`} className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0.0">0.0 (결정적)</SelectItem>
                                <SelectItem value="0.1">0.1 (매우 일관성)</SelectItem>
                                <SelectItem value="0.3">0.3 (일관성)</SelectItem>
                                <SelectItem value="0.7">0.7 (균형)</SelectItem>
                                <SelectItem value="1.0">1.0 (창의적)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* 고급 설정 */}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">고급 설정</Label>
                          
                          {/* GPT-5 전용 설정 */}
                          {providerId === 'openai-gpt5' && (
                            <>
                              <div>
                                <Label htmlFor={`reasoning-${providerId}`} className="text-xs text-gray-600">Reasoning Effort</Label>
                                <Select 
                                  value={providerConfig.reasoningEffort || 'medium'} 
                                  onValueChange={(value) => updateProviderConfig(providerId, 'reasoningEffort', value)}
                                >
                                  <SelectTrigger id={`reasoning-${providerId}`} className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="minimal">Minimal (최소)</SelectItem>
                                    <SelectItem value="low">Low (낮음)</SelectItem>
                                    <SelectItem value="medium">Medium (기본)</SelectItem>
                                    <SelectItem value="high">High (높음)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor={`verbosity-${providerId}`} className="text-xs text-gray-600">Verbosity</Label>
                                <Select 
                                  value={providerConfig.verbosity || 'medium'} 
                                  onValueChange={(value) => updateProviderConfig(providerId, 'verbosity', value)}
                                >
                                  <SelectTrigger id={`verbosity-${providerId}`} className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low (간결)</SelectItem>
                                    <SelectItem value="medium">Medium (기본)</SelectItem>
                                    <SelectItem value="high">High (상세)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}

                          {/* Gemini 전용 설정 */}
                          {providerId === 'gemini-25' && (
                            <>
                              <div>
                                <Label htmlFor={`top-p-${providerId}`} className="text-xs text-gray-600">Top-P</Label>
                                <Select 
                                  value={providerConfig.top_p?.toString() || '0.95'} 
                                  onValueChange={(value) => updateProviderConfig(providerId, 'top_p', parseFloat(value))}
                                >
                                  <SelectTrigger id={`top-p-${providerId}`} className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0.8">0.8 (보수적)</SelectItem>
                                    <SelectItem value="0.95">0.95 (기본)</SelectItem>
                                    <SelectItem value="0.99">0.99 (창의적)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor={`top-k-${providerId}`} className="text-xs text-gray-600">Top-K</Label>
                                <Select 
                                  value={providerConfig.top_k?.toString() || '40'} 
                                  onValueChange={(value) => updateProviderConfig(providerId, 'top_k', parseInt(value))}
                                >
                                  <SelectTrigger id={`top-k-${providerId}`} className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="20">20 (제한적)</SelectItem>
                                    <SelectItem value="40">40 (기본)</SelectItem>
                                    <SelectItem value="100">100 (다양함)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={fetchConfig}
              disabled={saving}
            >
              초기화
            </Button>
            <Button 
              onClick={saveConfig}
              disabled={saving || enabledProviders.length === 0}
              className="px-6"
            >
              {saving ? (
                <>
                  <Settings className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  설정 저장
                </>
              )}
            </Button>
          </div>

          {enabledProviders.length === 0 && (
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-amber-800">
                최소 하나의 AI 모델을 활성화해야 합니다.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}