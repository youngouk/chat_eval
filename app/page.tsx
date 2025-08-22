"use client"

import { useState, useEffect, useRef } from "react"
import {
  Upload,
  FileText,
  CheckCircle,
  RefreshCw,
  MessageSquare,
  Edit3,
  FileSpreadsheet,
  Target,
  User,
  AlertTriangle,
  Users,
  Bot,
  Download,
  Archive,
  Eye,
  EyeOff,
  Settings,
  Camera,
  Image,
} from "lucide-react"
import { EditableEvaluationContent } from "@/components/evaluation/EditableEvaluationContent"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

// 상담원 이름 매핑
const MANAGER_NAMES: Record<string, string> = {
  "5": "이하늘",
  "6": "강지희",
  "8": "김예림",
  "10": "이지영",
  "1": "CX",
}

// 사용자 제공 원본 프롬프트 기반 + 5점 체계 적용
const DEFAULT_GUIDELINES = `🧠 핀다 CX 상담 평가 AI 프롬프트 (v1.1 - 평가 대상 명확화)

🎯 CORE MISSION
상담원별 전체 상담 데이터를 분석하여 평균 이하 상담 건에 대한 구체적 개선 피드백 제공

⚠️ CRITICAL RULES (절대 준수)
1. **평가 대상: 오직 '상담원'의 메시지만 평가합니다. 고객의 메시지는 상황 파악을 위한 문맥으로만 사용하며, 고객의 언어 사용(예: ㅎㅎ)이나 태도는 평가에 절대 반영하지 않습니다.**
2. 자동 메시지 완전 제외: "15분 자동 메시지", "30분 자동 메시지"
3. 서포트봇 메시지 제외: "안녕하세요 고객님, 핀다 고객경험팀 [상담원명]입니다" 이전 모든 메시지 (상담원명: 이하늘, 강지희, 김예림, 이지영)
4. 상황 공감 = 상황 파악 + 해결 방향 제시 (감정 표현 ≠ 상황 공감)
5. 문제 파악 적극 노력 = 필수 가점 요소
6. 점수 다양성 확보 (1.0-5.0 전 범위 활용)
7. 상담 조기 종료 시 가점 부여

🎯 **문제가 되는 상담 식별 기준:**
1. **총점 기준**: 총점 3.8점 미만인 모든 상담
2. **개별 항목별 세부 기준**: 
   - 업무능력: 3.5점 미만
   - 문장력: 3.0점 미만  
   - 기본태도: 3.0점 미만
3. **상대적 품질 기준**: 해당 상담원 평균보다 0.3점 이상 낮은 상담
4. **구체적 문제점이 발견된 상담**: 가이드라인 위반, 부적절한 응답, 고객 불만족 야기 등
5. **심각도 분류**: 높음(즉시 개선 필요), 중간(주의 필요), 낮음(경미한 개선점)`

// 새로운 평가 항목에 맞춘 상담원별 종합 평가 결과 타입
interface CounselorEvaluation {
  counselor_id: string
  counselor_name: string
  evaluation_date: string
  total_chats_analyzed: number
  scores: {
    업무능력: {
      고객_질문_내용_파악: number
      파악_및_해결_적극성: number
      답변의_정확성_및_적합성: number
      도메인_전문성: number
      신속한_응대: number
      상황_공감: number
      subtotal: number
    }
    문장력: {
      정확한_맞춤법: number
      적절한_언어_표현: number
      쉬운_표현_사용: number
      단계별_안내: number
      subtotal: number
    }
    기본_태도: {
      인사_및_추가_문의: number
      양해_표현_사용: number
      subtotal: number
    }
    total_score: number
  }
  // 수기 조정된 점수 (원본 점수와 별도 관리)
  adjusted_scores?: {
    업무능력: {
      고객_질문_내용_파악: number
      파악_및_해결_적극성: number
      답변의_정확성_및_적합성: number
      도메인_전문성: number
      신속한_응대: number
      상황_공감: number
      subtotal: number
    }
    문장력: {
      정확한_맞춤법: number
      적절한_언어_표현: number
      쉬운_표현_사용: number
      단계별_안내: number
      subtotal: number
    }
    기본_태도: {
      인사_및_추가_문의: number
      양해_표현_사용: number
      subtotal: number
    }
    total_score: number
  }
  comprehensive_feedback: {
    strengths: string[]
    weaknesses: string[]
    improvement_priorities: string[]
  }
  problematic_chats: Array<{
    chat_id: string
    issues: string[]
    severity: string
    is_excluded?: boolean
    full_conversation?: Array<{
      type: string
      text: string
      createdAt?: string
      date?: string
      is_problematic?: boolean
      is_excluded?: boolean
    }>
    reason?: string
  }>
  overall_comment: string
  modification_history?: Array<{
    timestamp: string
    type: "score_adjustment" | "problem_exclusion" | "message_selection" | "message_exclusion"
    details: string
    modified_by?: string
  }>
}

interface ArchiveItem {
  id: string
  filename: string
  url: string
  size: number
  uploadedAt: string
  downloadUrl: string
  type: "feedback" | "chat"
}

// 진행상황 상세 정보 타입
interface ProgressDetails {
  current?: number
  total?: number
  chatId?: string
  managerName?: string
  managerId?: string
  totalChats?: number
  date?: string
  percentage?: number
  totalCounselors?: number
  counselorNames?: string[]
}

export default function FintechFeedbackSystem() {
  // 중단 기능 관련
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // 수정된 가이드라인 (문제점 해결)
  const [guidelines, setGuidelines] = useState(DEFAULT_GUIDELINES)

  // 가이드라인 관련 상태 추가
  const [isEditingGuidelines, setIsEditingGuidelines] = useState(false)
  const [tempGuidelines, setTempGuidelines] = useState("")

  // 파일 업로드 관련
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [organizedData, setOrganizedData] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)

  // 상담원별 종합 평가 관련 (새로운 방식)
  const [isProcessingCounselor, setIsProcessingCounselor] = useState(false)
  const [counselorProgress, setCounselorProgress] = useState(0)
  const [counselorProgressText, setCounselorProgressText] = useState("대기 중...")
  const [counselorProgressDetails, setCounselorProgressDetails] = useState<ProgressDetails>({})
  const [counselorEvaluations, setCounselorEvaluations] = useState<CounselorEvaluation[]>([])
  const [tempStorageStatus, setTempStorageStatus] = useState("")

  // 공통
  const [error, setError] = useState("")
  const [debugInfo, setDebugInfo] = useState<string>("")

  // 아카이빙 관련
  const [archiveStatus, setArchiveStatus] = useState("")
  const [archives, setArchives] = useState<ArchiveItem[]>([])
  const [isLoadingArchives, setIsLoadingArchives] = useState(false)

  // 확장된 상담원 ID 추가
  const [expandedCounselorId, setExpandedCounselorId] = useState<string | null>(null)

  // 환경 상태 확인
  const [environmentStatus, setEnvironmentStatus] = useState<string>("")

  // 문제 상담 표시 관련
  const [expandedProblemChats, setExpandedProblemChats] = useState<Record<string, boolean>>({})

  // 보고서 생성 관련
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  // 수기 조정 관련 상태 추가
  const [hasModifications, setHasModifications] = useState(false)
  const [isSavingModifications, setIsSavingModifications] = useState(false)

  // AI 모델 설정 관련 상태
  const [modelConfig, setModelConfig] = useState<any>(null)
  const [isLoadingModelConfig, setIsLoadingModelConfig] = useState(false)
  const [isSavingModelConfig, setIsSavingModelConfig] = useState(false)
  const [modelConfigError, setModelConfigError] = useState<string | null>(null)
  const [modelConfigSuccess, setModelConfigSuccess] = useState<string | null>(null)

  // PNG 추출 관련
  const evaluationResultsRef = useRef<HTMLDivElement>(null)
  const [isExportingPNG, setIsExportingPNG] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [activeTab, setActiveTab] = useState("upload")

  // 환경 상태 확인 함수
  const checkEnvironment = async () => {
    try {
      const response = await fetch("/api/test-environment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      })

      const result = await response.json()

      if (result.success) {
        setEnvironmentStatus("✅ 환경 설정 정상")
      } else {
        setEnvironmentStatus(`❌ 환경 문제: ${result.error}`)
      }
    } catch (err) {
      setEnvironmentStatus("❌ 환경 확인 실패")
    }
  }

  // 아카이브 목록 로드
  const loadArchives = async () => {
    setIsLoadingArchives(true)
    try {
      const response = await fetch("/api/archive")
      const result = await response.json()
      if (result.success) {
        setArchives(result.archives)
      }
    } catch (err) {
      console.error("아카이브 목록 로드 오류:", err)
    } finally {
      setIsLoadingArchives(false)
    }
  }

  // 모델 설정 로드
  const loadModelConfig = async () => {
    setIsLoadingModelConfig(true)
    setModelConfigError(null)
    try {
      const response = await fetch("/api/settings/models")
      if (!response.ok) {
        throw new Error(`설정 로드 실패: ${response.status}`)
      }
      const data = await response.json()
      setModelConfig(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '설정 로드 중 오류가 발생했습니다'
      setModelConfigError(errorMessage)
      console.error('모델 설정 로드 오류:', err)
    } finally {
      setIsLoadingModelConfig(false)
    }
  }

  // 모델 설정 저장
  const saveModelConfig = async () => {
    if (!modelConfig) return

    setIsSavingModelConfig(true)
    setModelConfigError(null)
    setModelConfigSuccess(null)

    try {
      const response = await fetch("/api/settings/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(modelConfig),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `설정 저장 실패: ${response.status}`)
      }

      const result = await response.json()
      setModelConfigSuccess("✅ 모델 설정이 성공적으로 저장되었습니다. 다음 평가부터 적용됩니다.")
      
      // 성공 메시지를 5초 후 제거
      setTimeout(() => setModelConfigSuccess(null), 5000)

      // 환경 상태 다시 확인
      await checkEnvironment()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다'
      setModelConfigError(errorMessage)
      console.error('모델 설정 저장 오류:', err)
    } finally {
      setIsSavingModelConfig(false)
    }
  }

  // Provider 활성화/비활성화 토글
  const toggleProvider = (providerId: string) => {
    if (!modelConfig) return

    setModelConfig({
      ...modelConfig,
      providers: {
        ...modelConfig.providers,
        [providerId]: {
          ...modelConfig.providers[providerId],
          enabled: !modelConfig.providers[providerId].enabled
        }
      }
    })
  }

  // Provider 설정 업데이트
  const updateProviderConfig = (providerId: string, key: string, value: any) => {
    if (!modelConfig) return

    setModelConfig({
      ...modelConfig,
      providers: {
        ...modelConfig.providers,
        [providerId]: {
          ...modelConfig.providers[providerId],
          [key]: value
        }
      }
    })
  }

  // Multi-LLM 모드 토글
  const toggleMultiLLM = () => {
    if (!modelConfig) return

    setModelConfig({
      ...modelConfig,
      evaluation_mode: {
        ...modelConfig.evaluation_mode,
        multi_llm: !modelConfig.evaluation_mode.multi_llm
      }
    })
  }

  // PNG 추출 함수
  const exportToPNG = async () => {
    if (!evaluationResultsRef.current) {
      alert('평가 결과가 없습니다.')
      return
    }

    setIsExportingPNG(true)
    
    try {
      // html2canvas 동적 import
      const html2canvas = (await import('html2canvas')).default
      
      // 캔버스 생성 옵션
      const canvas = await html2canvas(evaluationResultsRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // 고화질을 위한 스케일 증가
        useCORS: true,
        allowTaint: true,
        width: evaluationResultsRef.current.scrollWidth,
        height: evaluationResultsRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc: Document) => {
          // 클론된 문서에서 스타일 조정
          const clonedElement = clonedDoc.querySelector('[data-export-target]') as HTMLElement
          if (clonedElement) {
            clonedElement.style.minHeight = 'auto'
            clonedElement.style.overflow = 'visible'
          }
          
          // 다운로드 버튼들 숨기기
          const buttons = clonedDoc.querySelectorAll('.print\\:hidden')
          buttons.forEach(button => {
            (button as HTMLElement).style.display = 'none'
          })
          
          // 더 나은 인쇄 스타일링
          const style = clonedDoc.createElement('style')
          style.textContent = `
            * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            .print\\:hidden { display: none !important; }
            body { margin: 0; padding: 20px; }
          `
          clonedDoc.head.appendChild(style)
        }
      })

      // 이미지 다운로드
      const link = document.createElement('a')
      link.download = `상담원별_평가결과_${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL('image/png', 1.0)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log('PNG 추출 완료')
    } catch (error) {
      console.error('PNG 추출 실패:', error)
      alert('PNG 추출에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsExportingPNG(false)
    }
  }

  // 아카이브 저장 함수
  const saveToArchive = async () => {
    if (!counselorEvaluations || counselorEvaluations.length === 0) {
      alert('저장할 평가 결과가 없습니다.')
      return
    }

    setIsArchiving(true)
    
    try {
      const archiveData = {
        timestamp: new Date().toISOString(),
        type: 'comprehensive_evaluation',
        data: {
          counselorEvaluations,
          uploadedFiles: uploadedFiles?.map(f => ({ name: f.name, size: f.size })),
          evaluationSettings: {
            modelsUsed: Object.keys(modelConfig).filter(k => modelConfig[k].enabled),
            evaluationDate: new Date().toLocaleString('ko-KR')
          }
        },
        metadata: {
          totalCounselors: counselorEvaluations.length,
          averageScore: (counselorEvaluations.reduce((sum, evaluation) => sum + (evaluation.adjusted_scores || evaluation.scores).total_score, 0) / counselorEvaluations.length).toFixed(2),
          hasModifications: hasModifications
        }
      }

      const response = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comprehensive_evaluation',
          data: archiveData,
          filename: `종합평가결과_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`
        })
      })

      const result = await response.json()
      
      if (result.success) {
        const shouldRedirect = confirm(`✅ 평가 결과가 아카이브에 저장되었습니다.\n파일명: ${result.archive.filename}\n\n아카이브 페이지로 이동하시겠습니까?`)
        
        // 아카이브 목록 새로고침
        await loadArchives()
        
        if (shouldRedirect) {
          // 아카이브 탭으로 이동
          setActiveTab('archive')
        }
      } else {
        throw new Error(result.error || '아카이브 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('아카이브 저장 실패:', error)
      alert(`❌ 아카이브 저장에 실패했습니다.\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setIsArchiving(false)
    }
  }

  // 컴포넌트 마운트 시 아카이브 목록 및 모델 설정 로드
  useEffect(() => {
    loadArchives()
    checkEnvironment()
    loadModelConfig()
  }, [])

  // 자동 저장 함수 추가
  const autoSaveData = async (type: string, data: any, description?: string) => {
    try {
      const response = await fetch("/api/auto-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, description }),
      })

      const result = await response.json()
      if (result.success) {
        setArchiveStatus(`✅ ${result.message}`)
        await loadArchives()
        setTimeout(() => setArchiveStatus(""), 3000)
      }
    } catch (err) {
      console.error("자동 저장 오류:", err)
    }
  }

  // handleFileUpload 함수에 자동 저장 추가
  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return

    setIsUploading(true)
    setError("")

    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => {
        formData.append("files", file)
      })

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setUploadedFiles(result.files)
        setOrganizedData(result.organizedData)

        // 업로드된 데이터 자동 저장
        await autoSaveData(
          "uploaded_data",
          {
            files: result.files,
            organizedData: result.organizedData,
            uploadedAt: new Date().toISOString(),
          },
          "업로드된 원본 데이터",
        )
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError("파일 업로드 중 오류가 발생했습니다.")
    } finally {
      setIsUploading(false)
    }
  }

  // 상담원별 종합 평가 처리 (새로운 방식)
  const processCounselorEvaluation = async () => {
    if (
      !organizedData ||
      (uploadedFiles.length === 0 &&
        (!organizedData.user.length || !organizedData.chat.length || !organizedData.message.length))
    ) {
      setError("먼저 파일을 업로드하고 데이터가 올바르게 구성되었는지 확인해주세요.")
      return
    }

    const controller = new AbortController()
    setAbortController(controller)

    setIsProcessingCounselor(true)
    setError("")
    setCounselorProgress(0)
    setCounselorProgressText("상담원별 종합 평가 시작...")
    setCounselorProgressDetails({})
    setDebugInfo("")

    try {
      const userData = organizedData?.user || uploadedFiles.find((f) => f.fileName.includes("user"))?.data || []
      const chatData = organizedData?.chat || uploadedFiles.find((f) => f.fileName.includes("chat"))?.data || []
      const messageData =
        organizedData?.message || uploadedFiles.find((f) => f.fileName.includes("message"))?.data || []

      const response = await fetch("/api/analyze-counselor-comprehensive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userData, chatData, messageData, guidelines }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        throw new Error(errorData.error || `API 오류: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          if (controller.signal.aborted) {
            throw new Error("분석이 사용자에 의해 중단되었습니다.")
          }

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6).trim()
                if (jsonStr) {
                  const data = JSON.parse(jsonStr)

                  if (data.type === "progress") {
                    setCounselorProgress(data.progress)
                    setCounselorProgressText(data.message)
                    if (data.details) {
                      setCounselorProgressDetails(data.details)
                    }
                  } else if (data.type === "debug") {
                    setDebugInfo((prev) => prev + data.info + "\n")
                  } else if (data.type === "result") {
                    setCounselorEvaluations(data.evaluations)
                    setCounselorProgress(100)
                    setCounselorProgressText("상담원별 종합 평가 완료!")

                    await autoSaveData(
                      "counselor_evaluations",
                      {
                        evaluations: data.evaluations,
                        analyzedAt: new Date().toISOString(),
                        totalCounselors: data.evaluations.length,
                      },
                      "상담원별 종합 평가 결과",
                    )

                    setTempStorageStatus("✅ 상담원별 종합 평가 완료 - 결과가 임시 저장되었습니다.")
                  } else if (data.type === "error") {
                    throw new Error(data.message)
                  }
                }
              } catch (parseError) {
                console.warn("JSON 파싱 오류 (무시):", parseError)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("상담원별 종합 평가 오류:", err)

      if (err instanceof Error && err.name === "AbortError") {
        setError("분석이 중단되었습니다.")
        setCounselorProgressText("분석 중단됨")
      } else {
        const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
        setError(`❌ ${errorMessage}`)
      }
    } finally {
      setIsProcessingCounselor(false)
      setAbortController(null)
    }
  }

  // 분석 중단 함수
  const stopAnalysis = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }

  // 가이드라인 편집 관련 함수
  const startEditingGuidelines = () => {
    setTempGuidelines(guidelines)
    setIsEditingGuidelines(true)
  }

  const saveGuidelines = () => {
    setGuidelines(tempGuidelines)
    setIsEditingGuidelines(false)
    autoSaveData(
      "guidelines",
      {
        guidelines: tempGuidelines,
        updatedAt: new Date().toISOString(),
      },
      "상담 가이드라인 설정",
    )
  }

  const cancelEditingGuidelines = () => {
    setTempGuidelines("")
    setIsEditingGuidelines(false)
  }

  const resetGuidelines = () => {
    if (confirm("가이드라인을 기본값으로 초기화하시겠습니까?")) {
      setGuidelines(DEFAULT_GUIDELINES)
      setIsEditingGuidelines(false)
    }
  }

  const downloadResults = (data: any, filename: string) => {
    const dataStr = JSON.stringify(data, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return "text-green-600"
    if (score >= 3.5) return "text-blue-600"
    if (score >= 2.5) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreGrade = (score: number) => {
    if (score >= 4.5) return "우수"
    if (score >= 3.5) return "양호"
    if (score >= 2.5) return "보통"
    if (score >= 1.5) return "미흡"
    return "매우 부족"
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎯 핀다 상담 피드백 시스템 v1.1</h1>
          <p className="text-lg text-gray-600">상담원별 개별 평가 시스템</p>

          {/* 환경 상태 표시 */}
          {environmentStatus && (
            <div className="mt-2">
              <Badge variant={environmentStatus.includes("✅") ? "default" : "destructive"}>{environmentStatus}</Badge>
              <Button onClick={checkEnvironment} variant="ghost" size="sm" className="ml-2">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="upload">📁 데이터 업로드 & 평가</TabsTrigger>
            <TabsTrigger value="results">📋 평가 결과</TabsTrigger>
            <TabsTrigger value="system-info">ℹ️ 시스템 정보</TabsTrigger>
            <TabsTrigger value="archive">📦 아카이브</TabsTrigger>
            <TabsTrigger value="settings">⚙️ AI 모델 설정</TabsTrigger>
          </TabsList>

          {/* 데이터 업로드 & 평가 통합 탭 */}
          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  파일 업로드 (CSV 또는 Excel)
                </CardTitle>
                <CardDescription>
                  CSV 파일 3개 또는 3개 시트가 포함된 Excel 파일을 업로드하세요.
                  <br />
                  Excel 시트명: user_data, user_chat_data, message_data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => document.getElementById("fileInput")?.click()}
                  >
                    <div className="flex justify-center gap-4 mb-4">
                      <FileText className="w-12 h-12 text-blue-500" />
                      <FileSpreadsheet className="w-12 h-12 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">CSV 또는 Excel 파일을 선택하거나 드래그하세요</h3>
                    <p className="text-gray-600">
                      CSV: user_data.csv, user_chat_data.csv, message_data.csv
                      <br />
                      Excel: 3개 시트가 포함된 하나의 파일
                    </p>
                    <input
                      id="fileInput"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    />
                  </div>

                  {isUploading && (
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-sm text-gray-600">파일 업로드 및 파싱 중...</p>
                    </div>
                  )}

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">업로드된 파일:</h4>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="bg-green-50 p-3 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {file.fileName}
                              {file.sheetName && ` - ${file.sheetName} 시트`}
                            </span>
                            <div className="flex gap-2">
                              <Badge variant="secondary">{file.recordCount}개 레코드</Badge>
                              <Badge variant={file.fileType === "excel" ? "default" : "outline"}>
                                {file.fileType === "excel" ? "Excel" : "CSV"}
                              </Badge>
                              <Badge variant="outline">{file.dataType}</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600">컬럼: {file.headers.join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {organizedData && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>데이터 구성 완료:</strong>
                        <br />• User 데이터: {organizedData.user.length}개
                        <br />• Chat 데이터: {organizedData.chat.length}개
                        <br />• Message 데이터: {organizedData.message.length}개
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    상담 평가 가이드라인 (v1.1)
                  </div>
                  <div className="flex gap-2">
                    {!isEditingGuidelines ? (
                      <>
                        <Button onClick={startEditingGuidelines} variant="outline" size="sm">
                          <Edit3 className="w-4 h-4 mr-2" />
                          수정
                        </Button>
                        <Button onClick={resetGuidelines} variant="outline" size="sm">
                          초기화
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={saveGuidelines} size="sm">
                          저장
                        </Button>
                        <Button onClick={cancelEditingGuidelines} variant="outline" size="sm">
                          취소
                        </Button>
                      </>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  핀다 CX팀의 상담 평가 기준입니다. 업무능력(60%) + 문장력(25%) + 기본태도(15%) 구조로
                  업데이트되었습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="guidelines">상담 가이드라인</Label>
                  <Textarea
                    id="guidelines"
                    rows={30}
                    value={isEditingGuidelines ? tempGuidelines : guidelines}
                    onChange={(e) => isEditingGuidelines && setTempGuidelines(e.target.value)}
                    readOnly={!isEditingGuidelines}
                    className={`text-sm ${isEditingGuidelines ? "bg-white border-blue-300" : "bg-gray-50"}`}
                    placeholder="상담 가이드라인을 입력하세요..."
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500">
                      {isEditingGuidelines
                        ? "⚠️ 수정 중입니다. 저장하면 다음 분석부터 적용됩니다."
                        : "💡 v1.1 개선사항: 평가 대상을 '상담원 메시지'로 명확화하여 AI 정확도 향상"}
                    </p>
                    {isEditingGuidelines && <div className="text-xs text-gray-500">{tempGuidelines.length} 문자</div>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 상담원별 평가 섹션 - 업로드 탭에 통합 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  상담원별 종합 평가
                </CardTitle>
                <CardDescription>
                  업무능력(60%) + 문장력(25%) + 기본태도(15%) 구조로 상담원별 종합 평가를 수행합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <Bot className="h-4 w-4" />
                    <AlertDescription>
                      <strong>🎯 평가 항목 구조:</strong>
                      <br />• <strong>업무능력 (60%):</strong> 고객질문파악(15%) + 적극성(10%) + 답변정확성(15%) +
                      도메인전문성(5%) + 신속응대(10%) + 상황공감(5%)
                      <br />• <strong>문장력 (25%):</strong> 맞춤법(5%) + 언어표현(5%) + 쉬운표현(10%) + 단계별안내(5%)
                      <br />• <strong>기본태도 (15%):</strong> 인사및추가문의(10%) + 양해표현(5%)
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2">
                    <Button
                      onClick={processCounselorEvaluation}
                      disabled={isProcessingCounselor || (!organizedData && uploadedFiles.length === 0)}
                      size="lg"
                    >
                      {isProcessingCounselor ? "상담원별 평가 진행 중..." : "상담원별 종합 평가 시작"}
                    </Button>
                    {isProcessingCounselor && (
                      <Button onClick={stopAnalysis} variant="destructive" size="lg">
                        분석 중단
                      </Button>
                    )}
                  </div>

                  {isProcessingCounselor && (
                    <div className="space-y-4">
                      <Progress value={counselorProgress} className="w-full" />
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 mb-2">{counselorProgressText}</p>

                        {/* 상세 진행상황 표시 */}
                        {counselorProgressDetails.totalCounselors && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="bg-white p-2 rounded">
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-gray-500" />
                                <span className="text-gray-600">총 상담원</span>
                              </div>
                              <div className="font-semibold">{counselorProgressDetails.totalCounselors}명</div>
                            </div>

                            {counselorProgressDetails.current && counselorProgressDetails.total && (
                              <div className="bg-white p-2 rounded">
                                <div className="flex items-center gap-1">
                                  <Target className="w-3 h-3 text-blue-500" />
                                  <span className="text-gray-600">진행률</span>
                                </div>
                                <div className="font-semibold text-blue-600">
                                  {counselorProgressDetails.current}/{counselorProgressDetails.total}(
                                  {counselorProgressDetails.percentage || 0}%)
                                </div>
                              </div>
                            )}

                            {counselorProgressDetails.managerName && (
                              <div className="bg-white p-2 rounded">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-green-500" />
                                  <span className="text-gray-600">현재 상담원</span>
                                </div>
                                <div className="font-semibold text-green-600">
                                  {counselorProgressDetails.managerName}
                                </div>
                              </div>
                            )}

                            {counselorProgressDetails.totalChats && (
                              <div className="bg-white p-2 rounded">
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3 text-purple-500" />
                                  <span className="text-gray-600">상담 건수</span>
                                </div>
                                <div className="font-semibold text-purple-600">
                                  {counselorProgressDetails.totalChats}건
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 상담원 목록 표시 */}
                        {counselorProgressDetails.counselorNames &&
                          counselorProgressDetails.counselorNames.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-600 mb-1">발견된 상담원:</p>
                              <div className="flex flex-wrap gap-1">
                                {counselorProgressDetails.counselorNames.map((counselor, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {counselor}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {tempStorageStatus && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>{tempStorageStatus}</AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="whitespace-pre-line">{error}</div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {debugInfo && (
                    <Alert>
                      <AlertDescription>
                        <details>
                          <summary className="cursor-pointer font-semibold">처리 과정 (클릭하여 펼치기)</summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">{debugInfo}</pre>
                        </details>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* 상담원별 평가 완료 후 요약 정보 */}
                  {!isProcessingCounselor && counselorEvaluations.length > 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>✅ 상담원별 종합 평가 완료!</strong>
                        <br />• 평가된 상담원: {counselorEvaluations.length}명
                        <br />• 평균 점수:{" "}
                        {(
                          counselorEvaluations.reduce(
                            (sum, evalItem) =>
                              sum + (evalItem.adjusted_scores?.total_score || evalItem.scores.total_score),
                            0,
                          ) / counselorEvaluations.length
                        ).toFixed(2)}
                        점 / 5.00점
                        <br />• 총 분석된 상담:{" "}
                        {counselorEvaluations.reduce((sum, evalItem) => sum + evalItem.total_chats_analyzed, 0)}건
                        {modelConfig && (
                          <>
                            <br />• 사용된 AI 모델: {Object.entries(modelConfig.providers)
                              .filter(([_, provider]: [string, any]) => provider.enabled)
                              .map(([providerId, _]: [string, any]) => 
                                providerId === 'openai-gpt5' ? 'GPT-5-mini' : 
                                providerId === 'gemini-25' ? 'Gemini 2.5' : 
                                providerId === 'openai' ? 'GPT-4' : providerId
                              ).join(', ')}
                            <br />• 평가 방식: {modelConfig.evaluation_mode?.multi_llm ? 'Multi-LLM 교차 검증' : '단일 모델 평가'}
                          </>
                        )}
                        <br />• 임시 저장 완료 - 평가 결과 탭에서 상세 내용을 확인하세요.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
            {/* 수정 사항 저장 버튼 - 상담원별 평가 결과 하단에 추가 */}
            {hasModifications && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-blue-800">수정 사항이 있습니다</h3>
                    <p className="text-sm text-blue-600">변경된 내용을 저장하시겠습니까?</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setCounselorEvaluations(
                          counselorEvaluations.map((evaluation) => ({
                            ...evaluation,
                            modification_history: undefined,
                          })),
                        )
                        setHasModifications(false)
                      }}
                      variant="outline"
                      disabled={isSavingModifications}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={async () => {
                        setIsSavingModifications(true)
                        try {
                          await autoSaveData(
                            "counselor_evaluations_modified",
                            {
                              evaluations: counselorEvaluations,
                              modifiedAt: new Date().toISOString(),
                              totalCounselors: counselorEvaluations.length,
                            },
                            "수정된 상담원별 종합 평가 결과",
                          )
                          setHasModifications(false)
                        } catch (error) {
                          console.error("저장 오류:", error)
                        } finally {
                          setIsSavingModifications(false)
                        }
                      }}
                      disabled={isSavingModifications}
                    >
                      {isSavingModifications ? "저장 중..." : "수정 사항 저장"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 평가 결과 탭 */}
          <TabsContent value="results" className="space-y-6">
            {counselorEvaluations.length > 0 && (
              <div ref={evaluationResultsRef} data-export-target className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">👥 상담원별 종합 평가 결과</h2>
                  <div className="flex gap-2 print:hidden">
                    <Button
                      onClick={exportToPNG}
                      disabled={isExportingPNG}
                      variant="outline"
                      className="gap-2 bg-transparent"
                    >
                      {isExportingPNG ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          PNG 생성 중...
                        </>
                      ) : (
                        <>
                          <Image className="w-4 h-4" />
                          PNG 다운로드
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() =>
                        downloadResults(
                          counselorEvaluations,
                          `상담원별종합평가_${new Date().toISOString().split("T")[0]}.json`,
                        )
                      }
                      variant="outline"
                      className="gap-2 bg-transparent"
                    >
                      <Download className="w-4 h-4" />
                      JSON 다운로드
                    </Button>
                    <Button
                      onClick={saveToArchive}
                      disabled={isArchiving}
                      variant="outline"
                      className="gap-2 bg-transparent"
                    >
                      {isArchiving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        <>
                          <Archive className="w-4 h-4" />
                          아카이브에 저장
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* 평가에 사용된 모델 정보 */}
                {modelConfig && (
                  <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Bot className="w-5 h-5" />
                        평가에 사용된 AI 모델 설정
                      </CardTitle>
                      <CardDescription>
                        이 평가 결과는 다음 모델 설정으로 생성되었습니다.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* 평가 모드 정보 */}
                        <div className="bg-white p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Settings className="w-4 h-4 text-blue-600" />
                            <h4 className="font-medium">평가 모드</h4>
                          </div>
                          <ul className="text-sm space-y-1">
                            <li>• <strong>Multi-LLM:</strong> {modelConfig.evaluation_mode?.multi_llm ? '✅ 활성화' : '❌ 비활성화'}</li>
                            <li>• <strong>활성 모델 수:</strong> {Object.entries(modelConfig.providers).filter(([_, provider]: [string, any]) => provider.enabled).length}개</li>
                            <li>• <strong>비교 모드:</strong> {modelConfig.evaluation_mode?.comparison_mode || 'weighted_average'}</li>
                          </ul>
                        </div>

                        {/* 사용된 모델 목록 */}
                        <div className="bg-white p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-green-600" />
                            <h4 className="font-medium">사용된 모델</h4>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(modelConfig.providers)
                              .filter(([_, provider]: [string, any]) => provider.enabled)
                              .map(([providerId, providerConfig]: [string, any]) => (
                                <div key={providerId} className="text-sm">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {providerId === 'openai-gpt5' ? 'GPT-5-mini' : 
                                       providerId === 'gemini-25' ? 'Gemini 2.5' : 
                                       providerId === 'openai' ? 'GPT-4' : providerId}
                                    </Badge>
                                    <span className="text-gray-600">{providerConfig.model}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 ml-1 mt-1">
                                    Temperature: {providerConfig.temperature}
                                    {providerId === 'openai-gpt5' && (
                                      <> | Reasoning: {providerConfig.reasoningEffort || 'medium'} | Verbosity: {providerConfig.verbosity || 'medium'}</>
                                    )}
                                    {providerId === 'gemini-25' && (
                                      <> | Top-P: {providerConfig.top_p || 0.95} | Top-K: {providerConfig.top_k || 40}</>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* 평가 정보 */}
                      <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="font-medium text-amber-800">평가 정보</span>
                        </div>
                        <p className="text-sm text-amber-700">
                          • 평가 시점: {counselorEvaluations[0]?.evaluation_date}
                          <br />• 총 평가 상담원: {counselorEvaluations.length}명
                          <br />• 총 분석 상담: {counselorEvaluations.reduce((sum, e) => sum + e.total_chats_analyzed, 0)}건
                          <br />• 평가 방식: {modelConfig.evaluation_mode?.multi_llm ? 'Multi-LLM 교차 검증' : '단일 모델 평가'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 팀 전체 요약 */}
                <Card>
                  <CardHeader>
                    <CardTitle>📊 팀 전체 요약</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{counselorEvaluations.length}</div>
                        <div className="text-sm text-gray-600">평가된 상담원</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {counselorEvaluations.reduce((sum, e) => sum + e.total_chats_analyzed, 0)}
                        </div>
                        <div className="text-sm text-gray-600">총 분석 상담</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div
                          className={`text-2xl font-bold ${getScoreColor(
                            counselorEvaluations.reduce(
                              (sum, e) => sum + (e.adjusted_scores?.total_score || e.scores.total_score),
                              0,
                            ) / counselorEvaluations.length,
                          )}`}
                        >
                          {(
                            counselorEvaluations.reduce(
                              (sum, e) => sum + (e.adjusted_scores?.total_score || e.scores.total_score),
                              0,
                            ) / counselorEvaluations.length
                          ).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">팀 평균 점수</div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {
                            counselorEvaluations.filter(
                              (e) =>
                                (e.adjusted_scores?.total_score || e.scores.total_score) <
                                counselorEvaluations.reduce(
                                  (sum, e) => sum + (e.adjusted_scores?.total_score || e.scores.total_score),
                                  0,
                                ) /
                                  counselorEvaluations.length,
                            ).length
                          }
                        </div>
                        <div className="text-sm text-gray-600">개선 필요 상담원</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 상담원별 상세 평가 결과 */}
                <div className="space-y-4">
                  {counselorEvaluations.map((evaluation) => {
                    const currentScores = evaluation.adjusted_scores || evaluation.scores
                    const hasAdjustments = !!evaluation.adjusted_scores

                    return (
                      <Card
                        key={evaluation.counselor_id}
                        className={hasAdjustments ? "border-blue-300 bg-blue-50/30" : ""}
                      >
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-semibold text-lg flex items-center gap-2">
                                {evaluation.counselor_name}
                                <Badge variant="outline" className="text-xs">
                                  ID: {evaluation.counselor_id}
                                </Badge>
                                {hasAdjustments && (
                                  <Badge variant="default" className="text-xs bg-blue-600">
                                    수정됨
                                  </Badge>
                                )}
                              </h3>
                              <p className="text-sm text-gray-600">
                                분석 상담: {evaluation.total_chats_analyzed}건 | 평가일: {evaluation.evaluation_date}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`text-3xl font-bold ${getScoreColor(currentScores.total_score)}`}>
                                {currentScores.total_score.toFixed(2)}
                              </div>
                              <div className="text-sm text-gray-500">
                                / 5.00 ({getScoreGrade(currentScores.total_score)})
                              </div>
                              {hasAdjustments && (
                                <div className="text-xs text-blue-600">
                                  원본: {evaluation.scores.total_score.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-6">
                            {/* EditableEvaluationContent 컴포넌트 사용 */}
                            <EditableEvaluationContent 
                              evaluation={{
                                overall_comment: evaluation.overall_comment,
                                comprehensive_feedback: evaluation.comprehensive_feedback
                              }}
                              modificationHistory={evaluation.modification_history}
                              onSave={(updatedEvaluation) => {
                                // 평가 내용 업데이트
                                const updatedEvaluations = counselorEvaluations.map((evalItem) => {
                                  if (evalItem.counselor_id === evaluation.counselor_id) {
                                    return {
                                      ...evalItem,
                                      overall_comment: updatedEvaluation.overall_comment,
                                      comprehensive_feedback: updatedEvaluation.comprehensive_feedback,
                                      modification_history: [
                                        ...(evalItem.modification_history || []),
                                        {
                                          timestamp: new Date().toISOString(),
                                          type: "manual_edit" as const,
                                          details: "평가 내용 수동 편집 (종합평가, 강점, 개선점)",
                                          modified_by: "관리자"
                                        }
                                      ]
                                    }
                                  }
                                  return evalItem
                                })
                                setCounselorEvaluations(updatedEvaluations)
                                setHasModifications(true)
                              }}
                            />

                            {/* 문제가 되는 상담 */}
                            {evaluation.problematic_chats && evaluation.problematic_chats.length > 0 && (
                              <div className="bg-red-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <h4 className="font-medium text-red-800 flex items-center gap-2">
                                      ⚠️ 문제가 되는 상담 (
                                      {evaluation.problematic_chats.filter((chat) => !chat.is_excluded).length}/
                                      {evaluation.problematic_chats.length}건)
                                    </h4>
                                  </div>
                                  <Button
                                    onClick={() =>
                                      setExpandedProblemChats((prev) => ({
                                        ...prev,
                                        [evaluation.counselor_id]: !prev[evaluation.counselor_id],
                                      }))
                                    }
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    {expandedProblemChats[evaluation.counselor_id] ? (
                                      <>
                                        <EyeOff className="w-4 h-4 mr-1" />
                                        숨기기
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="w-4 h-4 mr-1" />
                                        상세보기
                                      </>
                                    )}
                                  </Button>
                                </div>

                                {expandedProblemChats[evaluation.counselor_id] && (
                                  <div className="space-y-3">
                                    {evaluation.problematic_chats.map((problemChat, i) => (
                                      <div
                                        key={i}
                                        className={`border rounded p-3 ${
                                          problemChat.is_excluded
                                            ? "bg-gray-100 opacity-60 border-gray-300"
                                            : "bg-white border-red-200"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                              ChatID: {problemChat.chat_id}
                                            </Badge>
                                            <Badge
                                              variant={
                                                problemChat.severity === "높음"
                                                  ? "destructive"
                                                  : problemChat.severity === "중간"
                                                    ? "default"
                                                    : "secondary"
                                              }
                                              className="text-xs"
                                            >
                                              {problemChat.severity}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-1 text-xs">
                                              <input
                                                type="checkbox"
                                                checked={problemChat.is_excluded || false}
                                                onChange={(e) => {
                                                  const updatedEvaluations = counselorEvaluations.map((evalItem) => {
                                                    if (evalItem.counselor_id === evaluation.counselor_id) {
                                                      return {
                                                        ...evalItem,
                                                        problematic_chats: evalItem.problematic_chats.map((chat) =>
                                                          chat.chat_id === problemChat.chat_id
                                                            ? { ...chat, is_excluded: e.target.checked }
                                                            : chat,
                                                        ),
                                                        modification_history: [
                                                          ...(evalItem.modification_history || []),
                                                          {
                                                            timestamp: new Date().toISOString(),
                                                            type: "problem_exclusion" as const,
                                                            details: `문제 상담 ${problemChat.chat_id} ${e.target.checked ? "제외" : "포함"} 처리`,
                                                            modified_by: "관리자",
                                                          },
                                                        ],
                                                      }
                                                    }
                                                    return evalItem
                                                  })
                                                  setCounselorEvaluations(updatedEvaluations)
                                                  setHasModifications(true)
                                                }}
                                                className="rounded"
                                              />
                                              문제없음
                                            </label>
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {problemChat.issues.map((issue, j) => (
                                            <Badge key={j} variant="destructive" className="text-xs">
                                              {issue}
                                            </Badge>
                                          ))}
                                        </div>

                                        {problemChat.reason && (
                                          <p className="text-sm text-red-800 mb-3 bg-red-100 p-2 rounded">
                                            <strong>문제 사유:</strong> {problemChat.reason}
                                          </p>
                                        )}

                                        {/* 전체 대화 내용 표시 */}
                                        {problemChat.full_conversation && (
                                          <div className="mt-3">
                                            <Button
                                              onClick={() =>
                                                setExpandedProblemChats((prev) => ({
                                                  ...prev,
                                                  [`${evaluation.counselor_id}_${problemChat.chat_id}`]:
                                                    !prev[`${evaluation.counselor_id}_${problemChat.chat_id}`],
                                                }))
                                              }
                                              variant="outline"
                                              size="sm"
                                              className="mb-2"
                                            >
                                              {expandedProblemChats[`${evaluation.counselor_id}_${problemChat.chat_id}`]
                                                ? "대화 내용 숨기기"
                                                : "대화 내용 보기"}
                                            </Button>

                                            {expandedProblemChats[
                                              `${evaluation.counselor_id}_${problemChat.chat_id}`
                                            ] && (
                                              <div className="bg-gray-50 p-3 rounded max-h-96 overflow-y-auto">
                                                <h5 className="font-medium mb-2 text-gray-800">전체 대화 내용:</h5>
                                                <div className="space-y-2">
                                                  {problemChat.full_conversation.map((msg, msgIdx) => (
                                                    <div
                                                      key={msgIdx}
                                                      className={`p-2 rounded text-sm ${
                                                        msg.type === "user"
                                                          ? "bg-blue-100 ml-4"
                                                          : msg.is_problematic
                                                            ? "bg-red-100 mr-4 border-l-4 border-red-500"
                                                            : "bg-green-100 mr-4"
                                                      } ${msg.is_excluded ? "opacity-50" : ""}`}
                                                    >
                                                      <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                          <span className="font-medium">
                                                            {msg.type === "user" ? "👤 고객" : "🎧 상담원"}
                                                          </span>
                                                          {msg.type === "manager" && (
                                                            <div className="flex items-center gap-1">
                                                              <label className="flex items-center gap-1 text-xs">
                                                                <input
                                                                  type="checkbox"
                                                                  checked={msg.is_problematic || false}
                                                                  onChange={(e) => {
                                                                    const updatedEvaluations = counselorEvaluations.map(
                                                                      (evalItem) => {
                                                                        if (
                                                                          evalItem.counselor_id ===
                                                                          evaluation.counselor_id
                                                                        ) {
                                                                          return {
                                                                            ...evalItem,
                                                                            problematic_chats:
                                                                              evalItem.problematic_chats.map((chat) =>
                                                                                chat.chat_id === problemChat.chat_id
                                                                                  ? {
                                                                                      ...chat,
                                                                                      full_conversation:
                                                                                        chat.full_conversation?.map(
                                                                                          (convMsg, convIdx) =>
                                                                                            convIdx === msgIdx
                                                                                              ? {
                                                                                                  ...convMsg,
                                                                                                  is_problematic:
                                                                                                    e.target.checked,
                                                                                                }
                                                                                              : convMsg,
                                                                                        ),
                                                                                    }
                                                                                  : chat,
                                                                              ),
                                                                            modification_history: [
                                                                              ...(evalItem.modification_history || []),
                                                                              {
                                                                                timestamp: new Date().toISOString(),
                                                                                type: "message_selection" as const,
                                                                                details: `메시지 ${msgIdx + 1} ${e.target.checked ? "문제로 표시" : "문제 해제"}`,
                                                                                modified_by: "관리자",
                                                                              },
                                                                            ],
                                                                          }
                                                                        }
                                                                        return evalItem
                                                                      },
                                                                    )
                                                                    setCounselorEvaluations(updatedEvaluations)
                                                                    setHasModifications(true)
                                                                  }}
                                                                  className="rounded"
                                                                />
                                                                문제
                                                              </label>
                                                              <label className="flex items-center gap-1 text-xs">
                                                                <input
                                                                  type="checkbox"
                                                                  checked={msg.is_excluded || false}
                                                                  onChange={(e) => {
                                                                    const updatedEvaluations = counselorEvaluations.map(
                                                                      (evalItem) => {
                                                                        if (
                                                                          evalItem.counselor_id ===
                                                                          evaluation.counselor_id
                                                                        ) {
                                                                          return {
                                                                            ...evalItem,
                                                                            problematic_chats:
                                                                              evalItem.problematic_chats.map((chat) =>
                                                                                chat.chat_id === problemChat.chat_id
                                                                                  ? {
                                                                                      ...chat,
                                                                                      full_conversation:
                                                                                        chat.full_conversation?.map(
                                                                                          (convMsg, convIdx) =>
                                                                                            convIdx === msgIdx
                                                                                              ? {
                                                                                                  ...convMsg,
                                                                                                  is_excluded:
                                                                                                    e.target.checked,
                                                                                                }
                                                                                              : convMsg,
                                                                                        ),
                                                                                    }
                                                                                  : chat,
                                                                              ),
                                                                            modification_history: [
                                                                              ...(evalItem.modification_history || []),
                                                                              {
                                                                                timestamp: new Date().toISOString(),
                                                                                type: "message_exclusion" as const,
                                                                                details: `메시지 ${msgIdx + 1} ${e.target.checked ? "제외" : "포함"} 처리`,
                                                                                modified_by: "관리자",
                                                                              },
                                                                            ],
                                                                          }
                                                                        }
                                                                        return evalItem
                                                                      },
                                                                    )
                                                                    setCounselorEvaluations(updatedEvaluations)
                                                                    setHasModifications(true)
                                                                  }}
                                                                  className="rounded"
                                                                />
                                                                문제없음
                                                              </label>
                                                            </div>
                                                          )}
                                                        </div>
                                                        {msg.createdAt && (
                                                          <span className="text-xs text-gray-500">
                                                            {new Date(
                                                              Number.parseInt(msg.createdAt),
                                                            ).toLocaleTimeString()}
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div className="text-gray-800">{msg.text}</div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* 시스템 정보 탭 */}
          <TabsContent value="system-info" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Multi-LLM 평가 시스템 정보
                </CardTitle>
                <CardDescription>
                  현재 평가 시스템의 구조와 사용되는 AI 모델 정보를 확인합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 시스템 아키텍처 */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">🏗️ 시스템 아키텍처</h3>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                    <div>
                      <h4 className="font-medium text-blue-800 mb-2">5-Layer Clean Architecture</h4>
                      <ul className="text-sm space-y-1 text-gray-700">
                        <li>• <strong>Domain Layer:</strong> 핵심 비즈니스 로직 (평가 기준, 점수 계산)</li>
                        <li>• <strong>Application Layer:</strong> 유즈케이스 구현 (평가 서비스, 오케스트레이션)</li>
                        <li>• <strong>Infrastructure Layer:</strong> AI Provider 통합 (OpenAI, Gemini)</li>
                        <li>• <strong>Interface Layer:</strong> API 엔드포인트 (REST API)</li>
                        <li>• <strong>Presentation Layer:</strong> Next.js UI (React 컴포넌트)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* AI 모델 정보 - 실시간 모델 설정에서 가져오기 */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">🤖 현재 설정된 AI 모델</h3>
                  {isLoadingModelConfig ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                      <span>모델 설정을 불러오는 중...</span>
                    </div>
                  ) : modelConfig ? (
                    <div className="space-y-4">
                      {/* Multi-LLM 모드 상태 */}
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Settings className="w-5 h-5 text-blue-600" />
                          <h4 className="font-medium text-blue-800">평가 모드</h4>
                        </div>
                        <p className="text-sm text-blue-700">
                          <strong>Multi-LLM 모드:</strong> {modelConfig.evaluation_mode?.multi_llm ? "✅ 활성화" : "❌ 비활성화"}
                          {modelConfig.evaluation_mode?.multi_llm && (
                            <span className="ml-2">
                              (활성 모델: {Object.entries(modelConfig.providers).filter(([_, provider]: [string, any]) => provider.enabled).length}개)
                            </span>
                          )}
                        </p>
                      </div>

                      {/* 활성화된 모델들 */}
                      <div className="grid gap-4">
                        {Object.entries(modelConfig.providers)
                          .filter(([_, provider]: [string, any]) => provider.enabled)
                          .map(([providerId, providerConfig]: [string, any]) => {
                            const modelInfo = {
                              'openai-gpt5': {
                                name: 'GPT-5-mini',
                                color: 'green',
                                description: 'OpenAI의 최신 GPT-5-mini 모델',
                                features: ['Responses API', 'Chain of Thought', '고성능 추론'],
                                pricing: '입력: $0.15/1M, 출력: $0.60/1M 토큰',
                                tokenLimit: '128,000 토큰'
                              },
                              'gemini-25': {
                                name: 'Gemini 2.5',
                                color: 'purple',
                                description: 'Google의 Gemini 2.5 Pro/Flash 모델',
                                features: ['빠른 응답', '문화적 감수성', '다각적 관점'],
                                pricing: providerConfig.model?.includes('pro') 
                                  ? '입력: $0.0005/1K, 출력: $0.001/1K 토큰'
                                  : '입력: $0.0001/1K, 출력: $0.0002/1K 토큰',
                                tokenLimit: '1,000,000 토큰'
                              },
                              'openai': {
                                name: 'GPT-4',
                                color: 'orange',
                                description: '레거시 GPT-4 모델',
                                features: ['검증된 성능', '안정성', '호환성'],
                                pricing: '입력: $2.50/1M, 출력: $10.00/1M 토큰',
                                tokenLimit: '128,000 토큰'
                              }
                            }

                            const info = modelInfo[providerId as keyof typeof modelInfo]
                            const bgColor = info?.color === 'green' ? 'bg-green-50' : 
                                           info?.color === 'purple' ? 'bg-purple-50' : 'bg-orange-50'
                            const textColor = info?.color === 'green' ? 'text-green-800' : 
                                             info?.color === 'purple' ? 'text-purple-800' : 'text-orange-800'

                            return (
                              <div key={providerId} className={`${bgColor} p-4 rounded-lg`}>
                                <h4 className={`font-medium ${textColor} mb-2 flex items-center gap-2`}>
                                  <CheckCircle className="w-4 h-4" />
                                  {info?.name} - {providerConfig.model}
                                </h4>
                                <ul className="text-sm space-y-1 text-gray-700">
                                  <li>• <strong>설명:</strong> {info?.description}</li>
                                  <li>• <strong>특징:</strong> {info?.features?.join(', ')}</li>
                                  <li>• <strong>토큰 한도:</strong> {info?.tokenLimit}</li>
                                  <li>• <strong>비용:</strong> {info?.pricing}</li>
                                  <li>• <strong>Temperature:</strong> {providerConfig.temperature}</li>
                                  {providerId === 'openai-gpt5' && (
                                    <>
                                      <li>• <strong>Reasoning Effort:</strong> {providerConfig.reasoningEffort || 'medium'}</li>
                                      <li>• <strong>Verbosity:</strong> {providerConfig.verbosity || 'medium'}</li>
                                    </>
                                  )}
                                  {providerId === 'gemini-25' && (
                                    <>
                                      <li>• <strong>Top-P:</strong> {providerConfig.top_p || 0.95}</li>
                                      <li>• <strong>Top-K:</strong> {providerConfig.top_k || 40}</li>
                                    </>
                                  )}
                                  <li>• <strong>상태:</strong> {environmentStatus.includes("✅") ? "✅ API 연결 정상" : "⚠️ API 키 확인 필요"}</li>
                                </ul>
                              </div>
                            )
                          })}
                      </div>

                      {/* 비활성화된 모델들 */}
                      {Object.entries(modelConfig.providers).some(([_, provider]: [string, any]) => !provider.enabled) && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-medium text-gray-700 mb-2">⭕ 비활성화된 모델</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(modelConfig.providers)
                              .filter(([_, provider]: [string, any]) => !provider.enabled)
                              .map(([providerId, providerConfig]: [string, any]) => (
                                <Badge key={providerId} variant="secondary" className="bg-gray-200 text-gray-600">
                                  {providerId === 'openai-gpt5' ? 'GPT-5-mini' : 
                                   providerId === 'gemini-25' ? 'Gemini 2.5' : 
                                   providerId === 'openai' ? 'GPT-4' : providerId}
                                </Badge>
                              ))}
                          </div>
                          <p className="text-xs text-gray-600 mt-2">
                            비활성화된 모델은 평가에 사용되지 않습니다. "⚙️ AI 모델 설정" 탭에서 활성화할 수 있습니다.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-red-800">⚠️ 모델 설정을 불러올 수 없습니다.</p>
                      <Button onClick={loadModelConfig} variant="outline" size="sm" className="mt-2">
                        다시 시도
                      </Button>
                    </div>
                  )}
                </div>

                {/* 평가 프로세스 */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">⚙️ 평가 프로세스</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <ol className="space-y-3">
                      <li className="flex items-start gap-3">
                        <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                        <div>
                          <strong>데이터 수집</strong>
                          <p className="text-sm text-gray-600">CSV/Excel 파일에서 상담 데이터 추출</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                        <div>
                          <strong>전처리</strong>
                          <p className="text-sm text-gray-600">자동 메시지 제거, 상담원 메시지 필터링</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                        <div>
                          <strong>Multi-LLM 평가</strong>
                          <p className="text-sm text-gray-600">여러 AI 모델을 통한 동시 평가</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
                        <div>
                          <strong>결과 종합</strong>
                          <p className="text-sm text-gray-600">평균 점수 계산, 신뢰도 검증</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">5</span>
                        <div>
                          <strong>피드백 생성</strong>
                          <p className="text-sm text-gray-600">개선점 및 우선순위 도출</p>
                        </div>
                      </li>
                    </ol>
                  </div>
                </div>

                {/* 평가 기준 */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">📊 평가 기준 (v1.1)</h3>
                  <div className="space-y-3">
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <strong className="text-orange-800">업무능력 (60%)</strong>
                        <Badge variant="outline" className="bg-orange-100">60점</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>• 고객 질문 내용 파악: 15%</div>
                        <div>• 파악 및 해결 적극성: 10%</div>
                        <div>• 답변의 정확성 및 적합성: 15%</div>
                        <div>• 도메인 전문성: 5%</div>
                        <div>• 신속한 응대: 10%</div>
                        <div>• 상황 공감: 5%</div>
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <strong className="text-yellow-800">문장력 (25%)</strong>
                        <Badge variant="outline" className="bg-yellow-100">25점</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>• 정확한 맞춤법: 5%</div>
                        <div>• 적절한 언어 표현: 5%</div>
                        <div>• 쉬운 표현 사용: 10%</div>
                        <div>• 단계별 안내: 5%</div>
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <strong className="text-green-800">기본 태도 (15%)</strong>
                        <Badge variant="outline" className="bg-green-100">15점</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>• 인사 및 추가 문의: 10%</div>
                        <div>• 양해 표현 사용: 5%</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 시스템 특징 */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">✨ 시스템 특징</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <strong className="text-sm">Multi-LLM 검증</strong>
                        <p className="text-xs text-gray-600">여러 AI 모델로 교차 검증하여 정확도 향상</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <strong className="text-sm">실시간 스트리밍</strong>
                        <p className="text-xs text-gray-600">평가 진행 상황을 실시간으로 확인</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <strong className="text-sm">자동 아카이빙</strong>
                        <p className="text-xs text-gray-600">평가 결과 자동 저장 및 버전 관리</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <strong className="text-sm">수기 조정 가능</strong>
                        <p className="text-xs text-gray-600">AI 평가 결과 수동 보정 지원</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 아카이브 탭 */}
          <TabsContent value="archive" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="w-5 h-5" />
                  데이터 아카이브 관리
                </CardTitle>
                <CardDescription>
                  분석 결과와 업로드된 데이터를 Vercel Blob Storage에 저장하고 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 아카이브 상태 */}
                  {archiveStatus && (
                    <Alert>
                      <AlertDescription>{archiveStatus}</AlertDescription>
                    </Alert>
                  )}

                  {/* 아카이브 목록 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold">저장된 아카이브 ({archives.length}개)</h4>
                      <Button onClick={loadArchives} variant="ghost" size="sm" disabled={isLoadingArchives}>
                        <RefreshCw className={`w-4 h-4 ${isLoadingArchives ? "animate-spin" : ""}`} />
                      </Button>
                    </div>

                    {archives.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">저장된 아카이브가 없습니다.</div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {archives.map((archive) => (
                          <div key={archive.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{archive.filename}</div>
                              <div className="text-xs text-gray-600">
                                {formatFileSize(archive.size)} • {formatDate(archive.uploadedAt)} •{" "}
                                <Badge variant="outline" className="text-xs">
                                  {archive.type}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => window.open(archive.downloadUrl, "_blank")}
                                variant="outline"
                                size="sm"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI 모델 설정 탭 */}
          <TabsContent value="settings" className="space-y-6">
            {/* 성공/오류 메시지 */}
            {modelConfigSuccess && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription className="text-green-800">{modelConfigSuccess}</AlertDescription>
              </Alert>
            )}

            {modelConfigError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-800">{modelConfigError}</AlertDescription>
              </Alert>
            )}

            {/* 전역 설정 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  평가 모드 설정
                </CardTitle>
                <CardDescription>
                  Multi-LLM 평가 모드를 활성화하면 여러 AI 모델을 동시에 사용하여 더 정확한 평가를 수행합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingModelConfig ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    <span>설정을 불러오는 중...</span>
                  </div>
                ) : modelConfig ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Multi-LLM 평가</Label>
                        <p className="text-sm text-gray-600 mt-1">
                          여러 AI 모델을 동시에 사용하여 더 정확한 평가를 수행합니다.
                        </p>
                      </div>
                      <Switch 
                        checked={modelConfig.evaluation_mode?.multi_llm || false}
                        onCheckedChange={toggleMultiLLM}
                      />
                    </div>
                    
                    {modelConfig.evaluation_mode?.multi_llm && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>활성화된 모델:</strong> {Object.entries(modelConfig.providers).filter(([_, provider]: [string, any]) => provider.enabled).length}개
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(modelConfig.providers).filter(([_, provider]: [string, any]) => provider.enabled).map(([id, provider]: [string, any]) => (
                            <Badge key={id} variant="secondary" className="bg-blue-100 text-blue-800">
                              {id === 'openai-gpt5' ? 'GPT-5-mini' : 
                               id === 'gemini-25' ? 'Gemini 2.5' : 
                               id === 'openai' ? 'GPT-4' : id} - {provider.model}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    설정을 불러올 수 없습니다.
                    <Button onClick={loadModelConfig} variant="outline" size="sm" className="ml-2">
                      다시 시도
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI 모델 설정 */}
            {modelConfig && (
              <>
                {Object.entries(modelConfig.providers).map(([providerId, providerConfig]: [string, any]) => {
                  const modelInfo = {
                    'openai-gpt5': {
                      name: 'GPT-5-mini',
                      icon: <Bot className="w-4 h-4" />,
                      description: 'OpenAI의 최신 GPT-5-mini 모델 (Responses API)',
                      features: ['고성능 추론', '비용 효율적', 'CoT 지원']
                    },
                    'gemini-25': {
                      name: 'Gemini 2.5',
                      icon: <Target className="w-4 h-4" />,
                      description: 'Google의 Gemini 2.5 Pro/Flash 모델',
                      features: ['빠른 처리', '문화적 감수성', '다각적 관점']
                    },
                    'openai': {
                      name: 'GPT-4',
                      icon: <MessageSquare className="w-4 h-4" />,
                      description: '레거시 GPT-4 모델 (호환성용)',
                      features: ['검증된 성능', '안정성']
                    }
                  }

                  const info = modelInfo[providerId as keyof typeof modelInfo]
                  
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
                                <CheckCircle className="w-3 h-3 mr-1" />
                                활성화
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
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

                          {/* 모델별 설정 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 기본 설정 */}
                            <div className="space-y-3">
                              <Label className="text-sm font-medium">기본 설정</Label>
                              
                              {/* 모델 선택 */}
                              {providerId === 'gemini-25' && (
                                <div>
                                  <Label className="text-xs text-gray-600">모델 타입</Label>
                                  <Select 
                                    value={providerConfig.model} 
                                    onValueChange={(value) => updateProviderConfig(providerId, 'model', value)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="models/gemini-2.5-pro">🚀 Pro (고성능)</SelectItem>
                                      <SelectItem value="models/gemini-2.5-flash">⚡ Flash (고속)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              <div>
                                <Label className="text-xs text-gray-600">Temperature</Label>
                                <Select 
                                  value={providerConfig.temperature.toString()} 
                                  onValueChange={(value) => updateProviderConfig(providerId, 'temperature', parseFloat(value))}
                                >
                                  <SelectTrigger className="h-8">
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
                                    <Label className="text-xs text-gray-600">Reasoning Effort</Label>
                                    <Select 
                                      value={providerConfig.reasoningEffort || 'medium'} 
                                      onValueChange={(value) => updateProviderConfig(providerId, 'reasoningEffort', value)}
                                    >
                                      <SelectTrigger className="h-8">
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
                                    <Label className="text-xs text-gray-600">Verbosity</Label>
                                    <Select 
                                      value={providerConfig.verbosity || 'medium'} 
                                      onValueChange={(value) => updateProviderConfig(providerId, 'verbosity', value)}
                                    >
                                      <SelectTrigger className="h-8">
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
                                    <Label className="text-xs text-gray-600">Top-P</Label>
                                    <Select 
                                      value={providerConfig.top_p?.toString() || '0.95'} 
                                      onValueChange={(value) => updateProviderConfig(providerId, 'top_p', parseFloat(value))}
                                    >
                                      <SelectTrigger className="h-8">
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
                                    <Label className="text-xs text-gray-600">Top-K</Label>
                                    <Select 
                                      value={providerConfig.top_k?.toString() || '40'} 
                                      onValueChange={(value) => updateProviderConfig(providerId, 'top_k', parseInt(value))}
                                    >
                                      <SelectTrigger className="h-8">
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
                  )
                })}

                {/* 저장 버튼 및 상태 */}
                <div className="flex justify-between items-center pt-6 border-t">
                  <div className="text-sm text-gray-600">
                    {Object.entries(modelConfig.providers).filter(([_, provider]: [string, any]) => provider.enabled).length > 0 ? (
                      `활성화된 모델: ${Object.entries(modelConfig.providers).filter(([_, provider]: [string, any]) => provider.enabled).length}개`
                    ) : (
                      "⚠️ 최소 하나의 모델을 활성화해야 합니다"
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={loadModelConfig}
                      disabled={isSavingModelConfig || isLoadingModelConfig}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingModelConfig ? 'animate-spin' : ''}`} />
                      초기화
                    </Button>
                    <Button 
                      onClick={saveModelConfig}
                      disabled={isSavingModelConfig || Object.entries(modelConfig.providers).filter(([_, provider]: [string, any]) => provider.enabled).length === 0}
                      className="px-6"
                    >
                      {isSavingModelConfig ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          설정 저장
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* 주의사항 */}
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-amber-800">
                    <strong>⚠️ 설정 변경 시 주의사항</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>모델 설정 변경은 다음 평가부터 적용됩니다</li>
                      <li>최소 하나의 AI 모델은 활성화되어 있어야 합니다</li>
                      <li>Multi-LLM 모드 비활성화 시 더 빠르지만 정확도가 다소 낮아질 수 있습니다</li>
                      <li>설정 변경 후 반드시 검증 테스트를 수행하시기 바랍니다</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
