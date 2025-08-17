import type { NextRequest } from "next/server"

// 상담원 이름 매핑
const MANAGER_NAMES: Record<string, string> = {
  "5": "이하늘",
  "6": "강지희",
  "8": "김예림",
  "10": "이지영",
}

// 텍스트 디코딩 함수
function decodeText(text: string): string {
  if (!text) return ""

  try {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim()
      .replace(/\s+/g, " ")
  } catch (error) {
    console.error("텍스트 디코딩 오류:", error)
    return text
  }
}

// 운영 시간 확인 함수 (KST 기준) - 타임스탬프 처리 개선
function isWithinOperatingHours(dateString: string): boolean {
  if (!dateString) return false

  try {
    let date: Date

    // 1. 숫자로만 이루어진 타임스탬프인지 확인
    if (/^\d+$/.test(dateString)) {
      const timestamp = Number.parseInt(dateString, 10)
      // 타임스탬프가 밀리초 단위인지 초 단위인지 판단
      // 1970년 이후 현재까지의 밀리초 타임스탬프는 13자리, 초 단위는 10자리
      if (timestamp > 1000000000000) {
        // 밀리초 타임스탬프
        date = new Date(timestamp)
      } else {
        // 초 단위 타임스탬프
        date = new Date(timestamp * 1000)
      }
    }
    // 2. ISO 형식 또는 일반적인 날짜 문자열
    else {
      date = new Date(dateString)

      // 파싱 실패 시 'YYYY-MM-DD HH:MM:SS' 형식 수동 파싱 시도
      if (isNaN(date.getTime())) {
        const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
        if (parts) {
          // KST(UTC+9)로 Date 객체 생성
          date = new Date(
            Date.UTC(
              Number.parseInt(parts[1], 10),
              Number.parseInt(parts[2], 10) - 1,
              Number.parseInt(parts[3], 10),
              Number.parseInt(parts[4], 10) - 9, // UTC로 변환
              Number.parseInt(parts[5], 10),
              Number.parseInt(parts[6], 10),
            ),
          )
        } else {
          throw new Error(`지원하지 않는 날짜 형식: ${dateString}`)
        }
      }
    }

    // 날짜 유효성 검증
    if (isNaN(date.getTime())) {
      throw new Error(`유효하지 않은 날짜: ${dateString}`)
    }

    // KST로 변환 (UTC+9)
    const kstTime = date.getTime() + 9 * 60 * 60 * 1000
    const kstDate = new Date(kstTime)

    const day = kstDate.getUTCDay() // 0 = Sun, 6 = Sat
    const hour = kstDate.getUTCHours()

    // 주말(토, 일) 확인
    if (day === 0 || day === 6) return false
    // 운영 시간(10:00 ~ 18:00) 확인
    if (hour < 10 || hour >= 18) return false
    // 점심 시간(13:00 ~ 14:00) 확인
    if (hour === 13) return false

    return true
  } catch (error) {
    console.error(`날짜 파싱 오류: ${dateString}`, error)
    return true // 파싱 실패 시 보수적으로 운영시간으로 간주
  }
}

// 자동 메시지 패턴 검증
function isAutomaticMessage(text: string): boolean {
  if (!text) return false

  const patterns = [
    /고객님,\s*궁금증\/불편사항은\s*모두\s*해결\s*되셨나요/,
    /다른\s*문의사항이\s*있다면.*상담사에게\s*알려주세요/,
    /대기\s*중인\s*고객분들의\s*상담을\s*위해.*자동\s*종료/,
    /일정시간\s*말씀이\s*없으셔서\s*상담이\s*자동종료/,
    /다른\s*문의가\s*있으실\s*경우.*다시\s*문의\s*해주세요/,
    /만족도\s*조사.*발송/,
    /상담이\s*자동\s*종료/,
    /자동\s*종료\s*됩니다/,
  ]

  return patterns.some((pattern) => pattern.test(text))
}

// 🔥 개선된 서포트봇 메시지 구분 함수
function filterRealManagerMessages(messages: any[], chatId: string): any[] {
  const managerMessages = messages.filter((m) => m.type === "manager")
  if (managerMessages.length === 0) return []

  console.log(`\n📝 ChatID ${chatId}: 전체 상담원 메시지 ${managerMessages.length}개 분석 시작`)

  // 🎯 정확한 인사 메시지 패턴들 (여러 변형 고려)
  const greetingPatterns = [
    // 기본 패턴 (정확한 매칭)
    /^안녕하세요\s+고객님,\s*핀다\s+고객경험팀\s+(이하늘|강지희|김예림|이지영)입니다\.\s*핀다를\s*찾아\s*주셔서\s*정말\s*감사합니다\s*😊$/,

    // 공백 변형 허용
    /안녕하세요\s*고객님,?\s*핀다\s*고객경험팀\s+(이하늘|강지희|김예림|이지영)\s*입니다\.?\s*핀다를?\s*찾아\s*주셔서\s*정말\s*감사합니다\s*😊?/,

    // 문장부호 변형 허용
    /안녕하세요.*고객님.*핀다.*고객경험팀.*(이하늘|강지희|김예림|이지영).*입니다.*핀다를.*찾아.*주셔서.*감사합니다.*😊?/,

    // 줄바꿈이 포함된 경우
    /안녕하세요[\s\n]*고객님,?[\s\n]*핀다[\s\n]*고객경험팀[\s\n]+(이하늘|강지희|김예림|이지영)[\s\n]*입니다\.?[\s\n]*핀다를?[\s\n]*찾아[\s\n]*주셔서[\s\n]*정말[\s\n]*감사합니다[\s\n]*😊?/,
  ]

  let greetingIndex = -1
  let foundCounselor = ""
  let matchedPattern = ""

  // 인사 메시지 찾기 (순차적으로 검색)
  for (let i = 0; i < managerMessages.length; i++) {
    const text = decodeText(managerMessages[i].text || "")
      .replace(/\n/g, " ")
      .trim()

    console.log(`  ${i + 1}. 메시지 분석: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`)

    // 각 패턴으로 매칭 시도
    for (let j = 0; j < greetingPatterns.length; j++) {
      const pattern = greetingPatterns[j]
      const match = text.match(pattern)

      if (match) {
        greetingIndex = i
        foundCounselor = match[1] || "알 수 없음"
        matchedPattern = `패턴 ${j + 1}`
        console.log(`✅ 인사 메시지 발견! 위치: ${i + 1}, 상담원: ${foundCounselor}, 매칭: ${matchedPattern}`)
        console.log(`   원본 텍스트: "${text}"`)
        break
      }
    }

    if (greetingIndex !== -1) break
  }

  // 인사 메시지를 찾지 못한 경우의 처리
  if (greetingIndex === -1) {
    console.log(`⚠️ ChatID ${chatId}: 정확한 인사 메시지를 찾을 수 없음`)

    // 대안: 상담원 이름이 포함된 첫 번째 메시지 찾기
    for (let i = 0; i < managerMessages.length; i++) {
      const text = decodeText(managerMessages[i].text || "")

      // 상담원 이름이 포함되어 있는지 확인
      const counselorNames = ["이하늘", "강지희", "김예림", "이지영"]
      const foundName = counselorNames.find((name) => text.includes(name))

      if (foundName && text.includes("핀다") && text.includes("고객경험팀")) {
        greetingIndex = i
        foundCounselor = foundName
        matchedPattern = "대안 패턴 (이름 + 핀다 + 고객경험팀)"
        console.log(`🔍 대안 패턴으로 인사 메시지 발견! 위치: ${i + 1}, 상담원: ${foundCounselor}`)
        break
      }
    }
  }

  // 여전히 찾지 못한 경우
  if (greetingIndex === -1) {
    console.log(`❌ ChatID ${chatId}: 인사 메시지를 전혀 찾을 수 없음 - 모든 메시지를 서포트봇으로 간주`)
    return []
  }

  // 🔥 핵심: 인사 메시지부터 시작하는 실제 상담원 메시지 추출
  const realManagerMessages = managerMessages.slice(greetingIndex)

  console.log(`📊 ChatID ${chatId} 결과:`)
  console.log(`  - 서포트봇 메시지: ${greetingIndex}개 (제외됨)`)
  console.log(`  - 실제 상담원 메시지: ${realManagerMessages.length}개 (인사 메시지 포함)`)
  console.log(`  - 발견된 상담원: ${foundCounselor}`)
  console.log(`  - 매칭 방식: ${matchedPattern}`)

  // 서포트봇으로 제외된 메시지들 상세 로그
  if (greetingIndex > 0) {
    console.log(`🤖 ChatID ${chatId} 서포트봇으로 제외된 메시지들:`)
    for (let i = 0; i < greetingIndex; i++) {
      const text = decodeText(managerMessages[i].text || "")
      console.log(`    ${i + 1}. "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`)
    }
  }

  // 자동 메시지 추가 필터링
  const finalMessages = realManagerMessages.filter((msg, index) => {
    const text = decodeText(msg.text || "")
    const isAuto = isAutomaticMessage(text)
    if (isAuto) {
      console.log(`🚫 ChatID ${chatId}: 자동 메시지 제외 - "${text.slice(0, 50)}..."`)
    }
    return !isAuto
  })

  console.log(`✅ ChatID ${chatId}: 최종 실제 상담원 메시지 ${finalMessages.length}개`)

  return finalMessages
}

// 태그 검증 함수 (평가 대상 여부 판단)
function isEvaluationTarget(tags: string[]): boolean {
  if (!tags || tags.length === 0) {
    return false
  }

  const hasTestTag = tags.some((tag) => {
    const trimmedTag = tag.trim()
    return trimmedTag === "기타_테스트" || trimmedTag.includes("기타_테스트") || trimmedTag.includes("테스트")
  })

  if (hasTestTag) {
    return false
  }

  const hasAutoClose = tags.some((tag) => {
    const trimmedTag = tag.trim()
    return (
      trimmedTag === "자동종료" ||
      trimmedTag.includes("자동종료") ||
      trimmedTag.includes("ڵ") ||
      /auto.*close/i.test(trimmedTag)
    )
  })

  const hasManualClose = tags.some((tag) => {
    const trimmedTag = tag.trim()
    return (
      trimmedTag === "수동종료" ||
      trimmedTag.includes("수동종료") ||
      trimmedTag.includes("") ||
      /manual.*close/i.test(trimmedTag)
    )
  })

  return hasAutoClose || hasManualClose
}

// OpenAI API 호출
async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90000)

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "system",
            content:
              "당신은 핀다 CX팀의 상담 품질을 평가하는 AI입니다. 당신의 임무는 고객과 상담원 간의 대화를 분석하고, 오직 '상담원'의 메시지만을 기준으로 평가 항목에 따라 점수를 매기는 것입니다. 고객의 메시지는 평가 대상이 아닙니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 오류: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content

    if (!result) {
      throw new Error("OpenAI API에서 빈 응답을 받았습니다.")
    }

    // 2초 지연
    await new Promise((resolve) => setTimeout(resolve, 2000))

    return result
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// 기본 점수 객체 생성 함수
function getDefaultScores() {
  return {
    업무능력: {
      고객_질문_내용_파악: 3.0,
      파악_및_해결_적극성: 3.0,
      답변의_정확성_및_적합성: 3.0,
      도메인_전문성: 3.0,
      신속한_응대: 3.0,
      상황_공감: 3.0,
      subtotal: 3.0,
    },
    문장력: {
      정확한_맞춤법: 3.0,
      적절한_언어_표현: 3.0,
      쉬운_표현_사용: 3.0,
      단계별_안내: 3.0,
      subtotal: 3.0,
    },
    기본_태도: {
      인사_및_추가_문의: 3.0,
      양해_표현_사용: 3.0,
      subtotal: 3.0,
    },
    total_score: 3.0,
  }
}

export async function POST(request: NextRequest) {
  console.log("=== 상담원별 종합 평가 API 시작 (v4.1 - 전체 상담 분석) ===")

  try {
    const body = await request.json()
    const { userData, chatData, messageData, guidelines } = body

    console.log("요청 데이터 확인:", {
      userData: userData?.length || 0,
      chatData: chatData?.length || 0,
      messageData: messageData?.length || 0,
      guidelines: guidelines?.length || 0,
    })

    // 환경변수 확인
    const apiKey = process.env.OPENAI_API_KEY
    console.log("환경변수 확인:", {
      hasApiKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyStart: apiKey?.substring(0, 7) || "없음",
    })

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
    }

    // 스트리밍 응답
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 헬퍼 함수들
          const sendData = (type: string, data: any) => {
            const message = `data: ${JSON.stringify({ type, ...data })}\n\n`
            controller.enqueue(encoder.encode(message))
          }

          const sendProgress = (progress: number, message: string, details?: any) => {
            sendData("progress", { progress, message, details })
          }

          const sendDebug = (info: string) => {
            console.log(info)
            sendData("debug", { info })
          }

          const sendResult = (evaluations: any[]) => {
            sendData("result", { evaluations })
          }

          const sendError = (message: string) => {
            sendData("error", { message })
          }

          sendProgress(5, "데이터 검증 중...")
          sendDebug("=== 상담원별 종합 평가 시작 (v4.1 - 전체 상담 분석) ===")

          // 데이터 검증
          if (!userData || !chatData || !messageData) {
            throw new Error("필수 데이터가 누락되었습니다.")
          }

          sendDebug(`데이터 현황: User(${userData.length}), Chat(${chatData.length}), Message(${messageData.length})`)

          // 상담원별 데이터 구성
          sendProgress(10, "상담원별 데이터 구성 중...")

          const counselorData: Record<string, any> = {}

          // 상담원 초기화
          Object.entries(MANAGER_NAMES).forEach(([id, name]) => {
            counselorData[id] = {
              counselor_id: id,
              counselor_name: name,
              chats: [],
              totalMessages: 0,
              totalManagerMessages: 0,
              totalRealManagerMessages: 0,
              totalSupportBotMessages: 0,
              supportBotStats: {
                totalChats: 0,
                chatsWithSupportBot: 0,
                averageSupportBotMessages: 0,
              },
            }
          })

          sendProgress(15, "상담원 초기화 완료", {
            totalCounselors: Object.keys(counselorData).length,
            counselorNames: Object.values(MANAGER_NAMES),
          })

          // 채팅 데이터 처리
          let processedChats = 0
          let totalSupportBotMessages = 0
          let chatsWithSupportBot = 0

          for (const chat of chatData) {
            const managerId = chat.manager_id?.toString() || chat.managerId?.toString()
            if (!managerId || !counselorData[managerId]) continue

            const chatId = chat.chat_id?.toString() || chat.chatId?.toString()
            if (!chatId) continue

            // 태그 검증 (평가 대상인지 확인)
            const tagsString = chat.tags || ""
            const tags = tagsString
              ? tagsString
                  .split(",")
                  .map((t: string) => t.trim())
                  .filter((t: string) => t.length > 0)
              : []

            if (!isEvaluationTarget(tags)) {
              sendDebug(`평가 대상 제외: ChatID ${chatId} - 태그: [${tags.join(", ")}]`)
              continue
            }

            // 해당 채팅의 메시지들
            const chatMessages = messageData.filter((msg: any) => {
              const msgChatId = msg.chat_id?.toString() || msg.chatId?.toString()
              return msgChatId === chatId
            })

            if (chatMessages.length === 0) continue

            const chatCreationTime = chat.createdAt || chat.created_at || chat.date
            const openedDuringOperatingHours = isWithinOperatingHours(chatCreationTime)

            console.log(
              `\n🔍 ChatID ${chatId} 분석 시작 (상담원: ${MANAGER_NAMES[managerId]}) - 운영시간 내 문의: ${openedDuringOperatingHours}`,
            )

            // 🔥 개선된 실제 상담원 메시지 필터링
            const allManagerMessages = chatMessages.filter((m: any) => m.type === "manager")
            const realManagerMessages = filterRealManagerMessages(chatMessages, chatId)
            const supportBotMessages = allManagerMessages.length - realManagerMessages.length

            // 통계 업데이트
            if (supportBotMessages > 0) {
              chatsWithSupportBot++
              totalSupportBotMessages += supportBotMessages
            }

            const conversation = chatMessages.map((msg: any) => ({
              type: msg.type || "manager",
              text: decodeText(msg.text || msg.content || msg.message || ""),
              createdAt: msg.createdAt || msg.created_at,
              date: msg.date,
            }))

            counselorData[managerId].chats.push({
              chat_id: chatId,
              messages: chatMessages,
              allManagerMessages,
              realManagerMessages,
              supportBotMessages,
              conversation,
              tags, // 태그 정보 추가
              opened_during_operating_hours: openedDuringOperatingHours, // 운영 시간 정보 추가
            })

            counselorData[managerId].totalMessages += chatMessages.length
            counselorData[managerId].totalManagerMessages += allManagerMessages.length
            counselorData[managerId].totalRealManagerMessages += realManagerMessages.length
            counselorData[managerId].totalSupportBotMessages += supportBotMessages
            counselorData[managerId].supportBotStats.totalChats++

            if (supportBotMessages > 0) {
              counselorData[managerId].supportBotStats.chatsWithSupportBot++
            }

            processedChats++
            if (processedChats % 10 === 0) {
              sendProgress(15 + (processedChats / chatData.length) * 10, `${processedChats}개 상담 처리 완료...`)
            }
          }

          // 상담원별 통계 계산 및 출력
          Object.values(counselorData).forEach((counselor: any) => {
            if (counselor.chats.length > 0) {
              counselor.supportBotStats.averageSupportBotMessages =
                counselor.totalSupportBotMessages / counselor.chats.length

              sendDebug(`📊 ${counselor.counselor_name} 상세 통계:`)
              sendDebug(`  - 총 상담: ${counselor.chats.length}건`)
              sendDebug(`  - 전체 상담원 메시지: ${counselor.totalManagerMessages}개`)
              sendDebug(`  - 서포트봇 메시지: ${counselor.totalSupportBotMessages}개 (제외됨)`)
              sendDebug(`  - 실제 상담원 메시지: ${counselor.totalRealManagerMessages}개 (평가 대상)`)
              sendDebug(
                `  - 서포트봇 포함 상담: ${counselor.supportBotStats.chatsWithSupportBot}/${counselor.chats.length}건`,
              )
              sendDebug(
                `  - 평균 서포트봇 메시지: ${counselor.supportBotStats.averageSupportBotMessages.toFixed(2)}개/상담`,
              )
              sendDebug(
                `  - 서포트봇 비율: ${((counselor.totalSupportBotMessages / counselor.totalManagerMessages) * 100).toFixed(2)}%`,
              )
            }
          })

          // 전체 서포트봇 통계
          sendDebug(`\n🤖 전체 서포트봇 통계:`)
          sendDebug(`  - 총 처리된 상담: ${processedChats}건`)
          sendDebug(
            `  - 서포트봇 포함 상담: ${chatsWithSupportBot}건 (${((chatsWithSupportBot / processedChats) * 100).toFixed(2)}%)`,
          )
          sendDebug(`  - 총 서포트봇 메시지: ${totalSupportBotMessages}개`)
          sendDebug(`  - 평균 서포트봇 메시지: ${(totalSupportBotMessages / processedChats).toFixed(2)}개/상담`)

          // 상담원별 진행상황 업데이트
          const counselorIds = Object.keys(counselorData).filter((id) => counselorData[id].chats.length > 0)

          sendProgress(30, "AI 평가 시작...", {
            totalCounselors: counselorIds.length,
            counselorNames: counselorIds.map((id) => MANAGER_NAMES[id]),
          })

          const evaluationResults: any[] = []

          // 각 상담원별 AI 평가
          for (let i = 0; i < counselorIds.length; i++) {
            const counselorId = counselorIds[i]
            const counselor = counselorData[counselorId]
            const counselorName = counselor.counselor_name

            sendProgress(30 + (i * 60) / counselorIds.length, `${counselorName} 상담원 AI 평가 중...`, {
              current: i + 1,
              total: counselorIds.length,
              managerName: counselorName,
              managerId: counselorId,
              totalChats: counselor.chats.length,
            })

            if (counselor.chats.length === 0) {
              sendDebug(`${counselorName}: 분석할 상담이 없어 건너뜀`)
              continue
            }

            try {
              // 🔥 전체 상담 데이터를 AI에게 전달 (slice 제한 제거)
              const evaluationPrompt = `당신은 핀다 CX팀의 상담 품질을 평가하는 AI입니다. 당신의 임무는 고객과 상담원 간의 대화를 분석하고, 오직 '🎧 상담원'의 메시지만을 기준으로 평가 항목에 따라 점수를 매기는 것입니다.

⚠️ **매우 중요한 규칙: 평가는 '🎧 상담원'이 보낸 메시지에 대해서만 수행하세요. '👤 고객'의 메시지는 상담원의 응대를 이해하기 위한 맥락으로만 사용해야 합니다. 고객이 비공식적인 언어(예: ㅎㅎ, ㅋㅋ)를 사용하더라도, 이를 상담원 평가에 절대로 반영해서는 안 됩니다.**

⏰ **운영시간 기준 (KST):**
- 평일: 10:00 ~ 18:00
- 점심시간 (미운영): 13:00 ~ 14:00
- 주말/공휴일: 미운영
- 이 기준에 따라 '신속한 응대' 항목을 평가하세요.

🎯 **문제가 되는 상담 식별 기준:**
1. **평균 이하 품질**: 해당 상담원의 다른 상담들과 비교하여 명확히 품질이 떨어지는 상담
2. **구체적 문제점**: 가이드라인 위반, 부적절한 응답, 고객 불만족 야기 등
3. **심각도 분류**: 높음(즉시 개선 필요), 중간(주의 필요), 낮음(경미한 개선점)

서포트봇 메시지는 정확한 패턴 매칭으로 이미 제외되었으며, 실제 상담원이 작성한 메시지만 분석 대상입니다.

🔥 서포트봇 구분 기준:
"안녕하세요 고객님, 핀다 고객경험팀 [상담원명]입니다. 핀다를 찾아주셔서 정말 감사합니다😊" 이전의 모든 상담원 메시지는 서포트봇으로 분류하여 제외했습니다.

${guidelines}

=== ${counselorName} 상담원 분석 데이터 ===
- 상담원 ID: ${counselorId}
- 총 상담 건수: ${counselor.chats.length}건
- 실제 상담원 메시지 (평가 대상): ${counselor.totalRealManagerMessages}개

=== 전체 상담 내용 분석 (서포트봇 및 고객 메시지는 평가 대상 아님) ===
${counselor.chats
  .map(
    (chat: any, idx: number) => `
📞 상담 ${idx + 1} (ChatID: ${chat.chat_id})
- 태그: [${chat.tags.join(", ")}]
- **운영 시간 내 문의 여부: ${chat.opened_during_operating_hours ? "✅ 예" : "❌ 아니오"}**
- 실제 상담원 메시지: ${chat.realManagerMessages.length}개 (평가 대상)

실제 상담원 대화 내용 (서포트봇 제외):
${chat.conversation
  .filter((msg: any) => {
    if (msg.type === "user") return true
    const isRealManagerMessage = chat.realManagerMessages.some(
      (realMsg: any) => decodeText(realMsg.text || realMsg.content || realMsg.message || "") === msg.text,
    )
    return isRealManagerMessage
  })
  .map((msg: any, msgIdx: number) => {
    const speaker = msg.type === "user" ? "👤 고객" : "🎧 상담원"
    const text = msg.text.slice(0, 300)
    return `${msgIdx + 1}. ${speaker}: ${text}`
  })
  .join("\n")}

---
`,
  )
  .join("\n")}

⚠️ 중요 지침:
1. **오직 '🎧 상담원'의 메시지만 평가하세요.** 고객 메시지는 문맥 파악용입니다.
2. ${counselorName} 상담원의 **전체 ${counselor.chats.length}건의 상담**을 모두 분석하여 개별적인 점수와 피드백을 제공하세요.
3. 실제 대화 내용에서 발견되는 구체적인 강점과 약점을 명시하세요.
4. **'신속한 응대' 항목은 '운영 시간 내 문의 여부'가 '✅ 예'일 경우에만 평가하고, '❌ 아니오'인 경우에는 5.0점을 부여하세요.**
5. **문제가 되는 상담을 모두 식별하세요**: 평균보다 낮은 품질의 상담, 가이드라인 위반 상담 등을 빠짐없이 찾아주세요.
6. 점수는 실제 상담 품질을 반영하여 1.0~5.0 범위에서 다양하게 부여하세요.
7. 다른 상담원과 차별화되는 개별적인 평가를 제공하세요.
8. 서포트봇이 정확히 제외되었으므로 순수한 상담원 역량만 평가하세요.
9. 가이드라인에 명시된 가중치에 따라 각 항목의 소계(subtotal)와 최종 총점(total_score)을 정확히 계산하여 JSON에 포함하세요.

다음 JSON 형식으로 ${counselorName} 상담원에 대한 개별적이고 구체적인 평가를 제공해주세요:

{
  "counselor_id": "${counselorId}",
  "counselor_name": "${counselorName}",
  "evaluation_date": "${new Date().toISOString().split("T")[0]}",
  "total_chats_analyzed": ${counselor.chats.length},
  "scores": {
    "업무능력": {
      "고객_질문_내용_파악": 0.0,
      "파악_및_해결_적극성": 0.0,
      "답변의_정확성_및_적합성": 0.0,
      "도메인_전문성": 0.0,
      "신속한_응대": 0.0,
      "상황_공감": 0.0,
      "subtotal": 0.0
    },
    "문장력": {
      "정확한_맞춤법": 0.0,
      "적절한_언어_표현": 0.0,
      "쉬운_표현_사용": 0.0,
      "단계별_안내": 0.0,
      "subtotal": 0.0
    },
    "기본_태도": {
      "인사_및_추가_문의": 0.0,
      "양해_표현_사용": 0.0,
      "subtotal": 0.0
    },
    "total_score": 0.0
  },
  "comprehensive_feedback": {
    "strengths": ["실제 대화에서 발견된 구체적인 강점들"],
    "weaknesses": ["실제 대화에서 발견된 구체적인 약점들"],
    "improvement_priorities": ["${counselorName} 상담원에게 특화된 개선점들"]
  },
  "problematic_chats": [
    {
      "chat_id": "문제가_발견된_실제_채팅_ID",
      "issues": ["구체적인 문제점들"],
      "severity": "높음|중간|낮음",
      "reason": "왜 이 상담이 문제가 되는지에 대한 구체적인 설명"
    }
  ],
  "overall_comment": "${counselorName} 상담원의 실제 상담 내용을 바탕으로 한 구체적이고 개별적인 종합 평가",
  "raw_data": {
    "totalChats": ${counselor.chats.length},
    "totalMessages": ${counselor.totalMessages},
    "totalManagerMessages": ${counselor.totalManagerMessages},
    "totalRealManagerMessages": ${counselor.totalRealManagerMessages},
    "totalSupportBotMessages": ${counselor.totalSupportBotMessages},
    "supportBotExclusionRate": ${((counselor.totalSupportBotMessages / counselor.totalManagerMessages) * 100 || 0).toFixed(2)},
    "supportBotStats": {
      "chatsWithSupportBot": ${counselor.supportBotStats.chatsWithSupportBot},
      "averageSupportBotMessages": ${counselor.supportBotStats.averageSupportBotMessages.toFixed(2)}
    }
  }
}`

              sendDebug(`${counselorName} AI 평가 요청 전송... (프롬프트 길이: ${evaluationPrompt.length}자)`)
              sendDebug(`${counselorName} 전체 상담 ${counselor.chats.length}건 분석 중...`)

              const aiResponse = await callOpenAI(evaluationPrompt)

              sendDebug(`${counselorName} AI 평가 응답 수신 (응답 길이: ${aiResponse.length}자)`)

              // JSON 파싱
              let evaluation
              try {
                // JSON 추출 개선
                let jsonStr = aiResponse

                // ```json 태그 제거
                const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/)
                if (jsonMatch) {
                  jsonStr = jsonMatch[1]
                } else {
                  // 중괄호로 둘러싸인 JSON 찾기
                  const braceMatch = aiResponse.match(/\{[\s\S]*\}/)
                  if (braceMatch) {
                    jsonStr = braceMatch[0]
                  }
                }

                evaluation = JSON.parse(jsonStr)

                // 점수 유효성 검증 및 재계산
                const scores = evaluation.scores
                if (scores && scores.업무능력 && scores.문장력 && scores.기본_태도) {
                  // 업무능력 소계 (60%)
                  const work_ability_subtotal =
                    (scores.업무능력.고객_질문_내용_파악 * 0.15 +
                      scores.업무능력.파악_및_해결_적극성 * 0.1 +
                      scores.업무능력.답변의_정확성_및_적합성 * 0.15 +
                      scores.업무능력.도메인_전문성 * 0.05 +
                      scores.업무능력.신속한_응대 * 0.1 +
                      scores.업무능력.상황_공감 * 0.05) /
                    0.6
                  scores.업무능력.subtotal = work_ability_subtotal

                  // 문장력 소계 (25%)
                  const writing_skills_subtotal =
                    (scores.문장력.정확한_맞춤법 * 0.05 +
                      scores.문장력.적절한_언어_표현 * 0.05 +
                      scores.문장력.쉬운_표현_사용 * 0.1 +
                      scores.문장력.단계별_안내 * 0.05) /
                    0.25
                  scores.문장력.subtotal = writing_skills_subtotal

                  // 기본 태도 소계 (15%)
                  const basic_attitude_subtotal =
                    (scores.기본_태도.인사_및_추가_문의 * 0.1 + scores.기본_태도.양해_표현_사용 * 0.05) / 0.15
                  scores.기본_태도.subtotal = basic_attitude_subtotal

                  // 최종 점수
                  scores.total_score =
                    work_ability_subtotal * 0.6 + writing_skills_subtotal * 0.25 + basic_attitude_subtotal * 0.15
                }

                // 대화 내용 추가
                if (evaluation.problematic_chats) {
                  evaluation.problematic_chats = evaluation.problematic_chats.map((problemChat: any) => {
                    const chatData = counselor.chats.find((c: any) => c.chat_id === problemChat.chat_id)
                    if (chatData) {
                      return {
                        ...problemChat,
                        full_conversation: chatData.conversation,
                        real_manager_messages: chatData.realManagerMessages.map((msg: any) => ({
                          type: msg.type,
                          text: decodeText(msg.text || msg.content || msg.message || ""),
                          createdAt: msg.createdAt || msg.created_at,
                          date: msg.date,
                        })),
                      }
                    }
                    return problemChat
                  })
                }

                evaluationResults.push(evaluation)
                sendDebug(
                  `${counselorName} 평가 완료 - 점수: ${evaluation.scores.total_score.toFixed(2)} (업무능력: ${evaluation.scores.업무능력.subtotal.toFixed(2)}, 문장력: ${evaluation.scores.문장력.subtotal.toFixed(2)}, 기본태도: ${evaluation.scores.기본_태도.subtotal.toFixed(2)})`,
                )
                sendDebug(`${counselorName} 문제 상담: ${evaluation.problematic_chats?.length || 0}건 식별됨`)
              } catch (parseError) {
                sendDebug(`${counselorName} JSON 파싱 오류: ${parseError}`)
                sendDebug(`원본 응답 일부: ${aiResponse.slice(0, 500)}...`)

                evaluation = {
                  counselor_id: counselorId,
                  counselor_name: counselorName,
                  evaluation_date: new Date().toISOString().split("T")[0],
                  total_chats_analyzed: counselor.chats.length,
                  scores: getDefaultScores(),
                  comprehensive_feedback: {
                    strengths: [`${counselorName} 상담원의 기본적인 상담 진행`],
                    weaknesses: ["AI 분석 실패로 상세 평가 불가"],
                    improvement_priorities: [`${counselorName} 상담원 재평가 필요`],
                  },
                  problematic_chats: [],
                  overall_comment: `${counselorName} 상담원의 AI 분석 중 오류가 발생했습니다. 수동 검토가 필요합니다.`,
                  raw_data: {
                    totalChats: counselor.chats.length,
                    totalMessages: counselor.totalMessages,
                    totalManagerMessages: counselor.totalManagerMessages,
                    totalRealManagerMessages: counselor.totalRealManagerMessages,
                    totalSupportBotMessages: counselor.totalSupportBotMessages,
                    supportBotExclusionRate: (
                      (counselor.totalSupportBotMessages / counselor.totalManagerMessages) *
                      100
                    ).toFixed(2),
                    supportBotStats: counselor.supportBotStats,
                  },
                }

                evaluationResults.push(evaluation)
              }
            } catch (error) {
              sendDebug(`${counselorName} 평가 오류: ${error}`)

              const defaultEvaluation = {
                counselor_id: counselorId,
                counselor_name: counselorName,
                evaluation_date: new Date().toISOString().split("T")[0],
                total_chats_analyzed: counselor.chats.length,
                scores: getDefaultScores(),
                comprehensive_feedback: {
                  strengths: [`${counselorName} 상담원의 기본적인 상담 진행`],
                  weaknesses: ["평가 중 오류 발생으로 상세 분석 불가"],
                  improvement_priorities: [`${counselorName} 상담원 시스템 재평가 필요`],
                },
                problematic_chats: [],
                overall_comment: `${counselorName} 상담원 평가 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
                raw_data: {
                  totalChats: counselor.chats.length,
                  totalMessages: counselor.totalMessages,
                  totalManagerMessages: counselor.totalManagerMessages,
                  totalRealManagerMessages: counselor.totalRealManagerMessages,
                  totalSupportBotMessages: counselor.totalSupportBotMessages,
                  supportBotExclusionRate: (
                    (counselor.totalSupportBotMessages / counselor.totalManagerMessages) *
                    100
                  ).toFixed(2),
                  supportBotStats: counselor.supportBotStats,
                },
              }

              evaluationResults.push(defaultEvaluation)
            }

            sendProgress(30 + ((i + 1) * 60) / counselorIds.length, `${counselorName} 평가 완료`, {
              current: i + 1,
              total: counselorIds.length,
              managerName: counselorName,
            })
          }

          sendProgress(95, "평가 결과 정리 중...")
          sendDebug(`총 ${evaluationResults.length}명의 상담원 평가 완료`)

          // 문제 상담 통계 출력
          const totalProblematicChats = evaluationResults.reduce(
            (sum, evaluation) => sum + (evaluation.problematic_chats?.length || 0),
            0,
          )
          sendDebug(`전체 문제 상담: ${totalProblematicChats}건 식별됨`)

          evaluationResults.forEach((evaluation) => {
            if (evaluation.problematic_chats && evaluation.problematic_chats.length > 0) {
              sendDebug(`${evaluation.counselor_name}: ${evaluation.problematic_chats.length}건의 문제 상담 발견`)
            }
          })

          // 최종 결과 전송
          sendResult(evaluationResults)
        } catch (error) {
          console.error("상담원별 종합 평가 오류:", error)
          const sendError = (message: string) => {
            const data = `data: ${JSON.stringify({ type: "error", message })}\n\n`
            controller.enqueue(encoder.encode(data))
          }
          sendError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.")
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  } catch (error) {
    console.error("API 초기 오류:", error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "서버 오류가 발생했습니다.",
      },
      { status: 500 },
    )
  }
}
