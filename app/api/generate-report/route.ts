import type { NextRequest } from "next/server"
import { put } from "@vercel/blob"

export async function POST(request: NextRequest) {
  try {
    const { counselorEvaluations, format } = await request.json()

    if (!counselorEvaluations || counselorEvaluations.length === 0) {
      return Response.json({
        success: false,
        error: "상담원별 평가 결과가 필요합니다.",
      })
    }

    // HTML 보고서 생성
    const htmlContent = generateHTMLReport(counselorEvaluations)

    // Vercel Blob에 저장
    const filename = `상담평가보고서_${new Date().toISOString().split("T")[0]}_${Date.now()}.html`
    const blob = await put(filename, htmlContent, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      allowOverwrite: true,
    })

    return Response.json({
      success: true,
      message: "HTML 보고서가 생성되었습니다.",
      report: {
        filename,
        url: blob.url,
        downloadUrl: blob.downloadUrl || blob.url,
        size: 0, // Vercel Blob API does not provide size directly
      },
    })
  } catch (error) {
    console.error("보고서 생성 오류:", error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "보고서 생성 중 오류가 발생했습니다.",
    })
  }
}

function generateHTMLReport(counselorEvaluations: any[]): string {
  const currentDate = new Date().toLocaleDateString("ko-KR")

  // 수기 조정된 점수 사용 (adjusted_scores가 있으면 우선 사용)
  const evaluationsWithAdjustedScores = counselorEvaluations.map((evaluation) => ({
    ...evaluation,
    display_scores: evaluation.adjusted_scores || evaluation.scores,
    has_adjustments: !!evaluation.adjusted_scores,
  }))

  const teamAverage =
    evaluationsWithAdjustedScores.reduce((sum, e) => sum + e.display_scores.total_score, 0) /
    evaluationsWithAdjustedScores.length
  const totalChats = evaluationsWithAdjustedScores.reduce((sum, e) => sum + e.total_chats_analyzed, 0)

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>핀다 CX팀 상담 평가 보고서</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .summary-card {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #e2e8f0;
        }
        
        .summary-card h3 {
            color: #4f46e5;
            font-size: 2rem;
            margin-bottom: 8px;
            font-weight: 700;
        }
        
        .summary-card p {
            color: #64748b;
            font-weight: 500;
        }
        
        .counselor-section {
            margin-bottom: 40px;
        }
        
        .counselor-card {
            background: #fff;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            margin-bottom: 30px;
            overflow: hidden;
            transition: all 0.3s ease;
        }
        
        .counselor-card:hover {
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            transform: translateY(-2px);
        }
        
        .counselor-card.modified {
            border-color: #3b82f6;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        }
        
        .counselor-header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .counselor-card.modified .counselor-header {
            background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
        }
        
        .counselor-info h3 {
            font-size: 1.5rem;
            margin-bottom: 5px;
        }
        
        .counselor-info p {
            opacity: 0.8;
        }
        
        .total-score {
            text-align: right;
        }
        
        .total-score .score {
            font-size: 3rem;
            font-weight: 700;
            line-height: 1;
        }
        
        .total-score .grade {
            font-size: 1rem;
            opacity: 0.8;
        }
        
        .original-score {
            font-size: 0.9rem;
            opacity: 0.7;
            margin-top: 5px;
        }
        
        .modification-badge {
            background: #3b82f6;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-left: 10px;
        }
        
        .counselor-body {
            padding: 30px;
        }
        
        .scores-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .score-card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            border: 2px solid transparent;
            transition: all 0.3s ease;
        }
        
        .score-card:hover {
            border-color: #4f46e5;
            transform: translateY(-2px);
        }
        
        .score-card.excellent { background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); }
        .score-card.good { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); }
        .score-card.average { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); }
        .score-card.poor { background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); }
        
        .score-card h4 {
            color: #374151;
            margin-bottom: 10px;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .score-card .score {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .score-card .grade {
            font-size: 0.8rem;
            color: #6b7280;
        }
        
        .feedback-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 30px;
        }
        
        .feedback-card {
            padding: 25px;
            border-radius: 12px;
            border: 2px solid #e5e7eb;
        }
        
        .strengths {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border-color: #10b981;
        }
        
        .weaknesses {
            background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
            border-color: #f59e0b;
        }
        
        .feedback-card h4 {
            margin-bottom: 15px;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .feedback-card ul {
            list-style: none;
        }
        
        .feedback-card li {
            margin-bottom: 8px;
            padding-left: 20px;
            position: relative;
        }
        
        .feedback-card li:before {
            content: "•";
            position: absolute;
            left: 0;
            font-weight: bold;
        }
        
        .strengths li:before { color: #10b981; }
        .weaknesses li:before { color: #f59e0b; }
        
        .comment-section {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            padding: 25px;
            border-radius: 12px;
            border: 2px solid #3b82f6;
            margin-bottom: 25px;
        }
        
        .comment-section h4 {
            color: #1e40af;
            margin-bottom: 15px;
            font-size: 1.1rem;
        }
        
        .priorities {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 20px;
        }
        
        .priority-tag {
            background: #fbbf24;
            color: #92400e;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
        }
        
        .problematic-chats {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            border: 2px solid #ef4444;
            border-radius: 12px;
            padding: 25px;
            margin-top: 25px;
        }
        
        .problematic-chats h4 {
            color: #dc2626;
            margin-bottom: 15px;
            font-size: 1.1rem;
        }
        
        .chat-item {
            background: white;
            border: 1px solid #fca5a5;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }
        
        .chat-item:last-child {
            margin-bottom: 0;
        }
        
        .chat-id {
            font-weight: 600;
            color: #dc2626;
            margin-bottom: 8px;
        }
        
        .issues {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .issue-tag {
            background: #dc2626;
            color: white;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 0.8rem;
        }
        
        .modification-history {
            background: #f1f5f9;
            border: 2px solid #64748b;
            border-radius: 12px;
            padding: 20px;
            margin-top: 20px;
        }
        
        .modification-history h4 {
            color: #475569;
            margin-bottom: 15px;
            font-size: 1rem;
        }
        
        .history-item {
            background: white;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 10px;
            font-size: 0.9rem;
        }
        
        .history-item:last-child {
            margin-bottom: 0;
        }
        
        .history-time {
            color: #64748b;
            font-size: 0.8rem;
            float: right;
        }
        
        .footer {
            background: #1f2937;
            color: white;
            text-align: center;
            padding: 30px;
            margin-top: 40px;
        }
        
        .print-only {
            display: none;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                border-radius: 0;
            }
            
            .counselor-card {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            
            .print-only {
                display: block;
            }
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .content {
                padding: 20px;
            }
            
            .feedback-section {
                grid-template-columns: 1fr;
            }
            
            .counselor-header {
                flex-direction: column;
                text-align: center;
                gap: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 핀다 CX팀 상담 평가 보고서</h1>
            <p>생성일: ${currentDate} | 평가 대상: ${evaluationsWithAdjustedScores.length}명 상담원</p>
        </div>
        
        <div class="content">
            <!-- 팀 전체 요약 -->
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>${evaluationsWithAdjustedScores.length}</h3>
                    <p>평가된 상담원</p>
                </div>
                <div class="summary-card">
                    <h3>${totalChats}</h3>
                    <p>총 분석 상담</p>
                </div>
                <div class="summary-card">
                    <h3>${teamAverage.toFixed(2)}</h3>
                    <p>팀 평균 점수</p>
                </div>
                <div class="summary-card">
                    <h3>${evaluationsWithAdjustedScores.filter((e) => e.display_scores.total_score < teamAverage).length}</h3>
                    <p>개선 필요 상담원</p>
                </div>
            </div>
            
            <!-- 상담원별 상세 평가 -->
            <div class="counselor-section">
                <h2 style="margin-bottom: 30px; color: #1f2937; font-size: 2rem;">👥 상담원별 상세 평가</h2>
                
                ${evaluationsWithAdjustedScores
                  .map((evaluation) => {
                    const scoreClass =
                      evaluation.display_scores.total_score >= 4.5
                        ? "excellent"
                        : evaluation.display_scores.total_score >= 3.5
                          ? "good"
                          : evaluation.display_scores.total_score >= 2.5
                            ? "average"
                            : "poor"

                    const gradeText =
                      evaluation.display_scores.total_score >= 4.5
                        ? "우수"
                        : evaluation.display_scores.total_score >= 3.5
                          ? "양호"
                          : evaluation.display_scores.total_score >= 2.5
                            ? "보통"
                            : evaluation.display_scores.total_score >= 1.5
                              ? "미흡"
                              : "매우 부족"

                    return `
                    <div class="counselor-card ${evaluation.has_adjustments ? "modified" : ""}">
                        <div class="counselor-header">
                            <div class="counselor-info">
                                <h3>${evaluation.counselor_name}
                                    ${evaluation.has_adjustments ? '<span class="modification-badge">수정됨</span>' : ""}
                                </h3>
                                <p>ID: ${evaluation.counselor_id} | 분석 상담: ${evaluation.total_chats_analyzed}건 | 평가일: ${evaluation.evaluation_date}</p>
                            </div>
                            <div class="total-score">
                                <div class="score">${evaluation.display_scores.total_score.toFixed(2)}</div>
                                <div class="grade">/ 5.0 (${gradeText})</div>
                                ${evaluation.has_adjustments ? `<div class="original-score">원본: ${evaluation.scores.total_score.toFixed(2)}</div>` : ""}
                            </div>
                        </div>
                        
                        <div class="counselor-body">
                            <!-- 영역별 점수 -->
                            <div class="scores-grid">
                                <div class="score-card ${evaluation.display_scores.업무능력.subtotal >= 4.5 ? "excellent" : evaluation.display_scores.업무능력.subtotal >= 3.5 ? "good" : evaluation.display_scores.업무능력.subtotal >= 2.5 ? "average" : "poor"}">
                                    <h4>업무능력 (60%)</h4>
                                    <div class="score">${evaluation.display_scores.업무능력.subtotal.toFixed(2)}</div>
                                    <div class="grade">${evaluation.display_scores.업무능력.subtotal >= 4.5 ? "우수" : evaluation.display_scores.업무능력.subtotal >= 3.5 ? "양호" : evaluation.display_scores.업무능력.subtotal >= 2.5 ? "보통" : evaluation.display_scores.업무능력.subtotal >= 1.5 ? "미흡" : "매우 부족"}</div>
                                    ${evaluation.has_adjustments ? `<div style="font-size: 0.8rem; color: #3b82f6; margin-top: 5px;">원본: ${evaluation.scores.업무능력.subtotal.toFixed(2)}</div>` : ""}
                                </div>
                                <div class="score-card ${evaluation.display_scores.문장력.subtotal >= 4.5 ? "excellent" : evaluation.display_scores.문장력.subtotal >= 3.5 ? "good" : evaluation.display_scores.문장력.subtotal >= 2.5 ? "average" : "poor"}">
                                    <h4>문장력 (25%)</h4>
                                    <div class="score">${evaluation.display_scores.문장력.subtotal.toFixed(2)}</div>
                                    <div class="grade">${evaluation.display_scores.문장력.subtotal >= 4.5 ? "우수" : evaluation.display_scores.문장력.subtotal >= 3.5 ? "양호" : evaluation.display_scores.문장력.subtotal >= 2.5 ? "보통" : evaluation.display_scores.문장력.subtotal >= 1.5 ? "미흡" : "매우 부족"}</div>
                                    ${evaluation.has_adjustments ? `<div style="font-size: 0.8rem; color: #3b82f6; margin-top: 5px;">원본: ${evaluation.scores.문장력.subtotal.toFixed(2)}</div>` : ""}
                                </div>
                                <div class="score-card ${evaluation.display_scores.기본_태도.subtotal >= 4.5 ? "excellent" : evaluation.display_scores.기본_태도.subtotal >= 3.5 ? "good" : evaluation.display_scores.기본_태도.subtotal >= 2.5 ? "average" : "poor"}">
                                    <h4>기본 태도 (15%)</h4>
                                    <div class="score">${evaluation.display_scores.기본_태도.subtotal.toFixed(2)}</div>
                                    <div class="grade">${evaluation.display_scores.기본_태도.subtotal >= 4.5 ? "우수" : evaluation.display_scores.기본_태도.subtotal >= 3.5 ? "양호" : evaluation.display_scores.기본_태도.subtotal >= 2.5 ? "보통" : evaluation.display_scores.기본_태도.subtotal >= 1.5 ? "미흡" : "매우 부족"}</div>
                                    ${evaluation.has_adjustments ? `<div style="font-size: 0.8rem; color: #3b82f6; margin-top: 5px;">원본: ${evaluation.scores.기본_태도.subtotal.toFixed(2)}</div>` : ""}
                                </div>
                            </div>
                            
                            <!-- 종합 코멘트 -->
                            <div class="comment-section">
                                <h4>💬 종합 평가</h4>
                                <p>${evaluation.overall_comment}</p>
                                
                                ${
                                  evaluation.comprehensive_feedback.improvement_priorities.length > 0
                                    ? `
                                    <div class="priorities">
                                        ${evaluation.comprehensive_feedback.improvement_priorities
                                          .map(
                                            (priority: any, i: number) => `<span class="priority-tag">${i + 1}. ${priority}</span>`,
                                          )
                                          .join("")}
                                    </div>
                                    `
                                    : ""
                                }
                            </div>
                            
                            <!-- 강점과 약점 -->
                            <div class="feedback-section">
                                <div class="feedback-card strengths">
                                    <h4>💪 강점 (${evaluation.comprehensive_feedback.strengths.length}개)</h4>
                                    <ul>
                                        ${evaluation.comprehensive_feedback.strengths.map((strength: any) => `<li>${strength}</li>`).join("")}
                                    </ul>
                                </div>
                                <div class="feedback-card weaknesses">
                                    <h4>🔧 개선점 (${evaluation.comprehensive_feedback.weaknesses.length}개)</h4>
                                    <ul>
                                        ${evaluation.comprehensive_feedback.weaknesses.map((weakness: any) => `<li>${weakness}</li>`).join("")}
                                    </ul>
                                </div>
                            </div>
                            
                            <!-- 문제가 되는 상담 -->
                            ${
                              evaluation.problematic_chats && evaluation.problematic_chats.length > 0
                                ? `
                                <div class="problematic-chats">
                                    <h4>⚠️ 문제가 되는 상담 (${evaluation.problematic_chats.filter((chat: any) => !chat.is_excluded).length}/${evaluation.problematic_chats.length}건)</h4>
                                    ${evaluation.problematic_chats
                                      .filter((chat: any) => !chat.is_excluded)
                                      .map(
                                        (chat: any) => `
                                        <div class="chat-item">
                                            <div class="chat-id">ChatID: ${chat.chat_id} (심각도: ${chat.severity})</div>
                                            <div class="issues">
                                                ${chat.issues.map((issue: string) => `<span class="issue-tag">${issue}</span>`).join("")}
                                            </div>
                                        </div>
                                    `,
                                      )
                                      .join("")}
                                </div>
                                `
                                : ""
                            }
                            
                            <!-- 수정 이력 -->
                            ${
                              evaluation.modification_history && evaluation.modification_history.length > 0
                                ? `
                                <div class="modification-history">
                                    <h4>📝 수정 이력 (${evaluation.modification_history.length}건)</h4>
                                    ${evaluation.modification_history
                                      .slice(0, 5)
                                      .map(
                                        (history: any) => `
                                        <div class="history-item">
                                            ${history.details}
                                            <span class="history-time">${new Date(history.timestamp).toLocaleString("ko-KR")}</span>
                                        </div>
                                    `,
                                      )
                                      .join("")}
                                    ${evaluation.modification_history.length > 5 ? '<div style="text-align: center; color: #64748b; font-size: 0.9rem; margin-top: 10px;">... 및 기타 수정사항</div>' : ""}
                                </div>
                                `
                                : ""
                            }
                        </div>
                    </div>
                  `
                  })
                  .join("")}
                </div>
            </div>
            
            <div class="footer">
                <p>© 2025 핀다 CX팀 상담 평가 시스템 v1.1 | 생성일: ${new Date().toLocaleString("ko-KR")}</p>
                <p style="margin-top: 10px; font-size: 0.9rem; opacity: 0.8;">
                    이 보고서는 AI 기반 평가 시스템으로 생성되었으며, 수기 조정 내용이 반영되었습니다.
                </p>
            </div>
        </div>
    </body>
    </html>`
}
