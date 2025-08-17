// 실제 데이터 구조 분석
async function analyzeRawData() {
  console.log("=== 실제 데이터 구조 분석 시작 ===")

  try {
    // 1. User Data 분석
    console.log("\n1. User Data 분석:")
    const userResponse = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/user_data-YqF1G6h3Oyzw1ox6dPj7XrThEBOPPj.csv",
    )
    const userData = await userResponse.text()
    const userLines = userData.split("\n").filter((line) => line.trim())
    console.log(`- 총 ${userLines.length - 1}개 사용자 레코드`)
    console.log(`- 헤더: ${userLines[0]}`)
    console.log(`- 샘플: ${userLines[1]}`)

    // 2. User Chat Data 분석
    console.log("\n2. User Chat Data 분석:")
    const chatResponse = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/user_chat_data-Tnfbo03pZfF55uyJhtk9IAypEneA9p.csv",
    )
    const chatData = await chatResponse.text()
    const chatLines = chatData.split("\n").filter((line) => line.trim())
    console.log(`- 총 ${chatLines.length - 1}개 채팅 세션`)
    console.log(`- 헤더: ${chatLines[0]}`)
    console.log(`- 샘플: ${chatLines[1]}`)

    // 3. Message Data 분석
    console.log("\n3. Message Data 분석:")
    const messageResponse = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/message_data-ooEx1vDEeHBVNRF1BZ0Vlo74mu8wYM.csv",
    )
    const messageData = await messageResponse.text()
    const messageLines = messageData.split("\n").filter((line) => line.trim())
    console.log(`- 총 ${messageLines.length - 1}개 메시지`)
    console.log(`- 헤더: ${messageLines[0]}`)
    console.log(`- 샘플: ${messageLines[1]}`)

    // 4. 데이터 관계 분석
    console.log("\n4. 데이터 관계 분석:")

    // CSV 파싱 함수
    function parseCSV(text) {
      const lines = text.split("\n").filter((line) => line.trim())
      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
      const data = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""))
        const row = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ""
        })
        data.push(row)
      }
      return data
    }

    const parsedUsers = parseCSV(userData)
    const parsedChats = parseCSV(chatData)
    const parsedMessages = parseCSV(messageData)

    // 고유 값 분석
    const uniqueChatIds = [...new Set(parsedChats.map((c) => c.chatId))]
    const uniqueManagerIds = [...new Set(parsedChats.map((c) => c.managerId).filter(Boolean))]
    const uniqueUserIds = [...new Set(parsedUsers.map((u) => u.userId))]

    console.log(`- 고유 채팅 ID: ${uniqueChatIds.length}개`)
    console.log(`- 고유 상담원 ID: ${uniqueManagerIds.length}개 (${uniqueManagerIds.slice(0, 10).join(", ")}...)`)
    console.log(`- 고유 사용자 ID: ${uniqueUserIds.length}개`)

    // 메시지 타입 분석
    const messageTypes = [...new Set(parsedMessages.map((m) => m.type))]
    console.log(`- 메시지 타입: ${messageTypes.join(", ")}`)

    // 채팅별 메시지 수 분석
    const messageCountByChat = {}
    parsedMessages.forEach((msg) => {
      messageCountByChat[msg.chatId] = (messageCountByChat[msg.chatId] || 0) + 1
    })

    const messageCounts = Object.values(messageCountByChat)
    const avgMessages = messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length
    console.log(`- 채팅당 평균 메시지: ${avgMessages.toFixed(1)}개`)
    console.log(`- 최대 메시지: ${Math.max(...messageCounts)}개`)
    console.log(`- 최소 메시지: ${Math.min(...messageCounts)}개`)

    // 상담원별 채팅 수 분석
    const chatCountByManager = {}
    parsedChats.forEach((chat) => {
      if (chat.managerId) {
        chatCountByManager[chat.managerId] = (chatCountByManager[chat.managerId] || 0) + 1
      }
    })

    console.log("\n5. 상담원별 채팅 수:")
    Object.entries(chatCountByManager)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([managerId, count]) => {
        console.log(`- 상담원 ${managerId}: ${count}개 채팅`)
      })

    // 샘플 데이터 출력
    console.log("\n6. 샘플 데이터 구조:")
    console.log("User 샘플:", JSON.stringify(parsedUsers[0], null, 2))
    console.log("Chat 샘플:", JSON.stringify(parsedChats[0], null, 2))
    console.log("Message 샘플:", JSON.stringify(parsedMessages[0], null, 2))
  } catch (error) {
    console.error("데이터 분석 오류:", error)
  }
}

// 실행
analyzeRawData()
