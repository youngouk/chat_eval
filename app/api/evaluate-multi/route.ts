import type { NextRequest } from "next/server";
import { MultiLLMEvaluationService } from "@/lib/application/services/multi-llm-evaluation-service";
import { ChatSession, Message } from "@/lib/types/evaluation";

/**
 * Multi-LLM 평가 API 엔드포인트
 * 새로운 5-Layer 아키텍처 기반 평가 시스템
 */

// 텍스트 디코딩 함수
function decodeText(text: string): string {
  if (!text) return "";

  try {
    const htmlDecoded = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    return htmlDecoded.trim().replace(/\s+/g, " ");
  } catch (error) {
    console.error("텍스트 디코딩 오류:", error);
    return text;
  }
}

// 상담원 이름 매핑
const MANAGER_NAMES: Record<string, string> = {
  "5": "이하늘",
  "6": "강지희", 
  "8": "김예림",
  "10": "이지영",
  "1": "CX",
};

// 레거시 데이터를 ChatSession으로 변환
function convertToMTUChatSession(
  userData: any[],
  chatData: any[],
  messageData: any[],
  targetChatId: string
): ChatSession | null {
  // 해당 채팅 찾기
  const chat = chatData.find(c => 
    (c.chatId || c.chat_id || c.id) === targetChatId
  );
  
  if (!chat) {
    throw new Error(`채팅 ID ${targetChatId}를 찾을 수 없습니다.`);
  }

  const managerId = chat.managerId || chat.manager_id || chat.counselor_id;
  const userId = chat.userId || chat.user_id;
  
  // 해당 채팅의 메시지들 찾기
  const messages = messageData.filter((msg: any) => 
    (msg.chatId || msg.chat_id || msg.id) === targetChatId
  );

  if (messages.length === 0) {
    throw new Error(`채팅 ID ${targetChatId}에 대한 메시지를 찾을 수 없습니다.`);
  }

  // 사용자 정보 찾기
  const user = userData.find((u: any) => 
    (u.userId || u.user_id) === userId
  );

  // 메시지 정렬 및 변환
  const sortedMessages: Message[] = messages
    .sort((a: any, b: any) => {
      const timeA = Number.parseInt(a.createdAt || a.created_at) || new Date(a.date).getTime();
      const timeB = Number.parseInt(b.createdAt || b.created_at) || new Date(b.date).getTime();
      return timeA - timeB;
    })
    .map((msg: any) => ({
      type: (msg.type || msg.sender_type || "manager") as 'user' | 'manager' | 'bot',
      text: decodeText(msg.text || msg.content || msg.message || ""),
      timestamp: new Date(Number.parseInt(msg.createdAt || msg.created_at) || new Date(msg.date).getTime()),
      createdAt: msg.createdAt || msg.created_at,
      date: msg.date
    }));

  // 태그 처리
  const tagsString = chat.tags || "";
  const tags = tagsString
    ? tagsString.split(",").map((t: string) => t.trim()).filter((t: string) => t.length > 0)
    : [];

  // ChatSession 객체 생성
  const chatSession: ChatSession = {
    chatId: targetChatId,
    userId: userId || "unknown",
    managerId: managerId || "unknown",
    messages: sortedMessages,
    metadata: {
      startTime: new Date(chat.createdAt || chat.created_at || chat.date),
      endTime: sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].timestamp : undefined,
      device: user?.device,
      channel: user?.channel_type || user?.channelType || "unknown",
      tags,
      rating: Number.parseFloat(chat.rating) || undefined,
      duration: undefined // 계산 가능하지만 현재는 생략
    }
  };

  return chatSession;
}

export async function POST(request: NextRequest) {
  console.log("=== Multi-LLM 평가 API 시작 ===");

  try {
    const body = await request.json();
    const { 
      userData, 
      chatData, 
      messageData, 
      guidelines,
      chatId,
      mode = "single", // single, batch, stream
      options = {}
    } = body;

    // 환경변수 확인
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GOOGLE_AI_API_KEY;

    console.log("환경변수 확인:");
    console.log("- OPENAI_API_KEY 존재:", !!openaiKey);
    console.log("- GOOGLE_AI_API_KEY 존재:", !!geminiKey);

    if (!openaiKey && !geminiKey) {
      return Response.json(
        { error: "최소한 하나의 API 키(OpenAI 또는 Google AI)가 필요합니다." },
        { status: 400 }
      );
    }

    // Multi-LLM 평가 서비스 초기화
    const evaluationService = MultiLLMEvaluationService.getInstance();
    await evaluationService.initialize();

    // 스트리밍 응답 설정
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const sendProgress = (progress: number, message: string, details?: any) => {
            const data = `data: ${JSON.stringify({ type: "progress", progress, message, details })}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          const sendDebug = (info: string) => {
            console.log(info);
            const data = `data: ${JSON.stringify({ type: "debug", info })}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          const sendResult = (result: any) => {
            const data = `data: ${JSON.stringify({ type: "result", ...result })}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          const sendError = (message: string) => {
            const data = `data: ${JSON.stringify({ type: "error", message })}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          sendProgress(10, "Multi-LLM 평가 시스템 초기화 완료");
          sendDebug("=== Multi-LLM 평가 시작 ===");

          if (mode === "single") {
            // 단일 상담 평가
            if (!chatId) {
              throw new Error("단일 평가 모드에서는 chatId가 필요합니다.");
            }

            sendProgress(20, `채팅 ID ${chatId} 데이터 변환 중...`);

            // 레거시 데이터를 ChatSession으로 변환
            const chatSession = convertToMTUChatSession(userData, chatData, messageData, chatId);
            
            if (!chatSession) {
              throw new Error(`채팅 ID ${chatId}를 처리할 수 없습니다.`);
            }

            sendDebug(`변환 완료: ${chatSession.messages.length}개 메시지, 상담원: ${MANAGER_NAMES[chatSession.managerId] || chatSession.managerId}`);

            sendProgress(40, "Multi-LLM 평가 실행 중...");

            // Multi-LLM 평가 실행
            const evaluationResult = await evaluationService.evaluateChat(chatSession, {
              strictValidation: options.strictValidation || false,
              generateReport: options.generateReport || true,
              includeAdvancedAnalysis: options.includeAdvancedAnalysis || false,
              timeout: options.timeout || 60000
            });

            sendProgress(80, "평가 결과 처리 중...");

            // 레거시 호환 결과 변환
            const legacyCompatibleResult = {
              chatId: chatSession.chatId,
              managerId: chatSession.managerId,
              managerName: MANAGER_NAMES[chatSession.managerId] || `상담원 ${chatSession.managerId}`,
              
              // Multi-LLM 평가 결과
              multiLLMResult: {
                scores: evaluationResult.result.scores,
                validation: evaluationResult.validation,
                providers: evaluationResult.result.providers.map(p => ({
                  name: p.name,
                  model: p.model,
                  success: p.success,
                  responseTime: p.responseTime,
                  cost: p.cost
                })),
                metadata: evaluationResult.result.metadata
              },

              // 호환성을 위한 기존 형식 점수
              evaluation: {
                overall_score: evaluationResult.result.scores.총점,
                empathy_score: evaluationResult.result.scores.기본_태도,
                process_score: evaluationResult.result.scores.업무능력,
                clarity_score: evaluationResult.result.scores.문장력,
                friendliness_score: evaluationResult.result.scores.기본_태도,
                feedback_comment: evaluationResult.validation.recommendations.join(" "),
                improvement_points: evaluationResult.validation.recommendations,
                good_points: evaluationResult.result.evidence?.positive || []
              },

              // 추가 정보
              processingInfo: {
                processingTime: evaluationResult.metadata.processingTime,
                providersUsed: evaluationResult.metadata.providersUsed,
                confidence: evaluationResult.validation.confidence,
                reliability: evaluationResult.validation.reliability
              }
            };

            sendProgress(95, "결과 전송 중...");
            sendDebug(`평가 완료 - 신뢰도: ${evaluationResult.validation.confidence.toFixed(2)}, 처리시간: ${evaluationResult.metadata.processingTime}ms`);

            sendResult({
              mode: "single",
              result: legacyCompatibleResult,
              summary: {
                confidence: evaluationResult.validation.confidence,
                reliability: evaluationResult.validation.reliability,
                providersUsed: evaluationResult.metadata.providersUsed.length,
                processingTime: evaluationResult.metadata.processingTime
              }
            });

          } else if (mode === "batch") {
            // 배치 평가 (향후 구현)
            sendError("배치 모드는 아직 구현되지 않았습니다.");
            
          } else if (mode === "stream") {
            // 스트림 평가 (향후 구현)
            sendError("스트림 모드는 아직 구현되지 않았습니다.");
            
          } else {
            throw new Error(`지원하지 않는 모드: ${mode}`);
          }

          sendProgress(100, "Multi-LLM 평가 완료!");

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
          console.error("Multi-LLM 평가 오류:", errorMessage);
          
          const sendError = (message: string) => {
            const data = `data: ${JSON.stringify({ type: "error", message })}\n\n`;
            controller.enqueue(encoder.encode(data));
          };
          
          sendError(errorMessage);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });

  } catch (error) {
    console.error("Multi-LLM API 초기 오류:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "서버 오류가 발생했습니다.",
        details: error instanceof Error ? error.stack : "상세 정보 없음",
      },
      { status: 500 }
    );
  }
}

/**
 * 헬스 체크 엔드포인트
 */
export async function GET(request: NextRequest) {
  try {
    const evaluationService = MultiLLMEvaluationService.getInstance();
    const status = await evaluationService.getServiceStatus();
    
    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: status,
      version: "1.0.0"
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "알 수 없는 오류"
      },
      { status: 500 }
    );
  }
}