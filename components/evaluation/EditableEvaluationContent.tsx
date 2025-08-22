"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Edit3, Save, X, History, Clock } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface ModificationHistory {
  timestamp: string
  type: string
  details: string
  modified_by: string
}

interface EvaluationData {
  overall_comment: string
  comprehensive_feedback: {
    strengths: string[]
    weaknesses: string[]
    improvement_priorities: string[]
  }
}

interface EditableEvaluationContentProps {
  evaluation: EvaluationData
  modificationHistory?: ModificationHistory[]
  onSave?: (updatedEvaluation: EvaluationData) => void
}

export function EditableEvaluationContent({ evaluation, modificationHistory, onSave }: EditableEvaluationContentProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editedData, setEditedData] = useState<EvaluationData>(evaluation)

  const handleSave = () => {
    if (onSave) {
      onSave(editedData)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedData(evaluation)
    setIsEditing(false)
  }

  const updateStrengths = (value: string) => {
    const strengths = value.split(/\n---\n|^---|---$/)
      .map(s => s.trim())
      .filter(s => s && s !== '---')
    setEditedData(prev => ({
      ...prev,
      comprehensive_feedback: {
        ...prev.comprehensive_feedback,
        strengths
      }
    }))
  }

  const updateWeaknesses = (value: string) => {
    const weaknesses = value.split(/\n---\n|^---|---$/)
      .map(s => s.trim())
      .filter(s => s && s !== '---')
    setEditedData(prev => ({
      ...prev,
      comprehensive_feedback: {
        ...prev.comprehensive_feedback,
        weaknesses
      }
    }))
  }

  const updatePriorities = (value: string) => {
    const priorities = value.split(/\n---\n|^---|---$/)
      .map(s => s.trim())
      .filter(s => s && s !== '---')
    setEditedData(prev => ({
      ...prev,
      comprehensive_feedback: {
        ...prev.comprehensive_feedback,
        improvement_priorities: priorities
      }
    }))
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        {/* 편집 모드 헤더 */}
        <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
          <h3 className="font-medium text-blue-800">📝 평가 내용 편집 중</h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-1" />
              저장
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1" />
              취소
            </Button>
          </div>
        </div>

        {/* 종합 평가 편집 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2 text-blue-800">💬 종합 평가</h4>
          <Textarea
            value={editedData.overall_comment}
            onChange={(e) => setEditedData(prev => ({ ...prev, overall_comment: e.target.value }))}
            className="min-h-[80px] bg-white"
            placeholder="종합 평가를 입력하세요..."
          />
        </div>

        {/* 강점과 약점 편집 */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium mb-3 text-green-800">💪 강점</h4>
            <p className="text-xs text-green-700 mb-2">각 항목은 "---"로 구분하세요. 항목 내에서는 엔터키로 줄바꿈 가능합니다.</p>
            <Textarea
              value={editedData.comprehensive_feedback.strengths.join('\n---\n')}
              onChange={(e) => updateStrengths(e.target.value)}
              className="min-h-[120px] bg-white"
              placeholder="강점을 입력하세요. 항목 구분은 --- 사용"
            />
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="font-medium mb-3 text-orange-800">🔧 개선점</h4>
            <p className="text-xs text-orange-700 mb-2">각 항목은 "---"로 구분하세요. 항목 내에서는 엔터키로 줄바꿈 가능합니다.</p>
            <Textarea
              value={editedData.comprehensive_feedback.weaknesses.join('\n---\n')}
              onChange={(e) => updateWeaknesses(e.target.value)}
              className="min-h-[120px] bg-white"
              placeholder="개선점을 입력하세요. 항목 구분은 --- 사용"
            />
          </div>
        </div>

        {/* 개선 우선순위 편집 */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3 text-yellow-800">🎯 개선 우선순위</h4>
          <p className="text-xs text-yellow-700 mb-2">각 항목은 "---"로 구분하세요. 항목 내에서는 엔터키로 줄바꿈 가능합니다.</p>
          <Textarea
            value={editedData.comprehensive_feedback.improvement_priorities.join('\n---\n')}
            onChange={(e) => updatePriorities(e.target.value)}
            className="min-h-[80px] bg-white"
            placeholder="개선 우선순위를 입력하세요. 항목 구분은 --- 사용"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 보기 모드 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {modificationHistory && modificationHistory.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowHistory(!showHistory)}>
              <History className="w-4 h-4 mr-1" />
              수정 이력 ({modificationHistory.length})
            </Button>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
          <Edit3 className="w-4 h-4 mr-1" />
          편집
        </Button>
      </div>

      {/* 수정 이력 표시 */}
      {showHistory && modificationHistory && modificationHistory.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h4 className="font-medium mb-3 text-gray-800 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            수정 이력
          </h4>
          <div className="space-y-2">
            {modificationHistory
              .filter(h => h.type === "manual_edit")
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 5)
              .map((history, i) => (
                <div key={i} className="text-sm bg-white p-3 rounded border">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-blue-600">{history.modified_by}</span>
                    <span className="text-gray-500 text-xs">
                      {new Date(history.timestamp).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-gray-700">{history.details}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 종합 평가 */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium mb-2 text-blue-800">💬 종합 평가</h4>
        <p className="text-sm text-blue-900 whitespace-pre-wrap">{evaluation.overall_comment}</p>
      </div>

      {/* 강점과 약점 */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3 text-green-800 flex items-center gap-2">
            💪 강점 ({evaluation.comprehensive_feedback.strengths.length}개)
          </h4>
          <ul className="text-sm space-y-2">
            {evaluation.comprehensive_feedback.strengths.map((strength, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-green-600 mt-1">•</span>
                <span className="text-green-900 whitespace-pre-wrap">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3 text-orange-800 flex items-center gap-2">
            🔧 개선점 ({evaluation.comprehensive_feedback.weaknesses.length}개)
          </h4>
          <ul className="text-sm space-y-2">
            {evaluation.comprehensive_feedback.weaknesses.map((weakness, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-orange-600 mt-1">•</span>
                <span className="text-orange-900 whitespace-pre-wrap">{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 개선 우선순위 */}
      {evaluation.comprehensive_feedback.improvement_priorities.length > 0 && (
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3 text-yellow-800">🎯 개선 우선순위</h4>
          <ol className="text-sm space-y-2">
            {evaluation.comprehensive_feedback.improvement_priorities.map((priority, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-yellow-700 font-medium">{i + 1}.</span>
                <span className="text-yellow-900 whitespace-pre-wrap">{priority}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}