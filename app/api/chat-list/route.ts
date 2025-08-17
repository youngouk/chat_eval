import type { NextRequest } from "next/server"

// 개선된 CSV 파싱 함수 추가 (upload/route.ts와 동일)
function parseCSVLine(line: string): string[] {
  const result = []
  let current = ""
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i += 2
        continue
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
    i++
  }

  result.push(current.trim())
  return result
}

// 텍스트 디코딩 함수 개선
function decodeText(text: string): string {
  if (!text) return ""

  try {
    // HTML 엔티티만 디코딩하고, 한글은 그대로 유지
    const htmlDecoded = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")

    // 불필요한 공백만 정리
    return htmlDecoded.trim().replace(/\s+/g, " ")
  } catch (error) {
    console.error("텍스트 디코딩 오류:", error)
    return text
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userData, chatData, messageData } = body

    // 채팅 목록 생성
    const chatList = chatData.map((chat: any) => {
      const chatId = chat.chatId || chat.chat_id || chat.id
      const messages = messageData.filter((msg: any) => (msg.chatId || msg.chat_id || msg.id) === chatId)

      const user = userData.find((u: any) => (u.userId || u.user_id) === (chat.userId || chat.user_id))

      return {
        chatId,
        userId: chat.userId || chat.user_id,
        managerId: chat.managerId || chat.manager_id || chat.counselor_id,
        date: chat.date,
        createdAt: chat.createdAt || chat.created_at,
        rating: chat.rating || 0,
        tags: chat.tags ? chat.tags.split(",").map((t: string) => t.trim()) : [],
        messageCount: messages.length,
        userInfo: user
          ? {
              device: user.device,
              os: user.os,
              channelType: user.channel_type || user.channelType,
            }
          : null,
        messages: messages
          .sort((a: any, b: any) => {
            const timeA = Number.parseInt(a.createdAt || a.created_at) || new Date(a.date).getTime()
            const timeB = Number.parseInt(b.createdAt || b.created_at) || new Date(b.date).getTime()
            return timeA - timeB
          })
          .map((msg: any) => ({
            type: msg.type || msg.sender_type || "manager",
            // 텍스트 디코딩 및 정리
            text: decodeText(msg.text || msg.content || msg.message || ""),
            createdAt: msg.createdAt || msg.created_at,
            date: msg.date,
          })),
      }
    })

    // 날짜별로 그룹핑
    const groupedByDate: Record<string, any[]> = {}
    chatList.forEach((chat: any) => {
      const date = chat.date ? chat.date.split(" ")[0] : new Date().toISOString().split("T")[0]
      if (!groupedByDate[date]) {
        groupedByDate[date] = []
      }
      groupedByDate[date].push(chat)
    })

    // 날짜순 정렬
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    const result = sortedDates.map((date) => ({
      date,
      chats: groupedByDate[date].sort((a, b) => {
        const timeA = Number.parseInt(a.createdAt) || new Date(a.date).getTime()
        const timeB = Number.parseInt(b.createdAt) || new Date(b.date).getTime()
        return timeB - timeA
      }),
    }))

    return Response.json({
      success: true,
      data: result,
      totalChats: chatList.length,
    })
  } catch (error) {
    console.error("채팅 목록 조회 오류:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "채팅 목록 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
