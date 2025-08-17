import type { NextRequest } from "next/server"
import * as XLSX from "xlsx"

// 엑셀 파일 파싱 함수
function parseExcelFile(buffer: ArrayBuffer) {
  try {
    const workbook = XLSX.read(buffer, { type: "array" })
    const parsedData: any[] = []

    // 각 시트를 처리
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName]

      // 시트를 JSON으로 변환
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // 첫 번째 행을 헤더로 사용
        defval: "", // 빈 셀은 빈 문자열로 처리
      })

      if (jsonData.length === 0) return

      // 헤더와 데이터 분리
      const headers = jsonData[0] as string[]
      const rows = jsonData.slice(1) as any[][]

      // 객체 배열로 변환
      const data = rows
        .filter((row) => row.some((cell) => cell !== "")) // 빈 행 제거
        .map((row) => {
          const obj: Record<string, string> = {}
          headers.forEach((header, index) => {
            obj[header] = String(row[index] || "").trim()
          })
          return obj
        })

      parsedData.push({
        fileName: `${sheetName}.xlsx`,
        sheetName,
        data,
        headers,
        recordCount: data.length,
      })
    })

    console.log(`엑셀 파싱 완료: ${parsedData.length}개 시트 처리됨`)
    return parsedData
  } catch (error) {
    console.error("엑셀 파싱 오류:", error)
    throw new Error(`엑셀 파싱 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
  }
}

// 개선된 CSV 파싱 함수 (한글 및 특수문자 처리) - 인코딩 문제 해결
function parseCSV(text: string) {
  try {
    // UTF-8 BOM 제거
    const cleanText = text.replace(/^\uFEFF/, "")

    const lines = cleanText.split(/\r?\n/).filter((line) => line.trim())

    if (lines.length === 0) return []

    // 첫 번째 줄에서 헤더 추출
    const headers = parseCSVLine(lines[0])
    const data = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])

      // 헤더와 값의 개수가 맞지 않으면 스킵
      if (values.length === 0) continue

      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ""
      })
      data.push(row)
    }

    console.log(`CSV 파싱 완료: ${data.length}개 레코드, 헤더: ${headers.join(", ")}`)
    return data
  } catch (error) {
    console.error("CSV 파싱 오류:", error)
    throw new Error(`CSV 파싱 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
  }
}

// CSV 라인 파싱 함수 (따옴표와 쉼표 처리 개선) - 인코딩 안전 처리
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
        // 연속된 따옴표는 하나의 따옴표로 처리
        current += '"'
        i += 2
        continue
      } else {
        // 따옴표 시작/끝
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      // 따옴표 밖의 쉼표는 구분자
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
    i++
  }

  // 마지막 필드 추가
  result.push(current.trim())

  return result
}

// 시트 이름을 기반으로 데이터 타입 추론 함수를 더 정확하게 수정
function inferDataType(sheetName: string): string {
  const lowerName = sheetName.toLowerCase().replace(/\s+/g, "")

  // 정확한 시트명 매칭
  if (lowerName.includes("userdata") || lowerName === "user_data") {
    return "user"
  } else if (lowerName.includes("userchatdata") || lowerName.includes("userchat") || lowerName === "user_chat_data") {
    return "chat"
  } else if (lowerName.includes("messagedata") || lowerName.includes("message")) {
    return "message"
  }

  // 추가적인 패턴 매칭
  if (lowerName.includes("chat") && lowerName.includes("user")) {
    return "chat"
  }
  if (lowerName.includes("user") && !lowerName.includes("chat")) {
    return "user"
  }
  if (lowerName.includes("message") || lowerName.includes("msg")) {
    return "message"
  }

  console.log(`알 수 없는 시트명: ${sheetName} (소문자 변환: ${lowerName})`)
  return "unknown"
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (files.length === 0) {
      return Response.json({ error: "업로드된 파일이 없습니다." }, { status: 400 })
    }

    const parsedData = []

    for (const file of files) {
      const fileExtension = file.name.toLowerCase().split(".").pop()

      if (fileExtension === "xlsx" || fileExtension === "xls") {
        // 엑셀 파일 처리
        console.log(`엑셀 파일 처리 중: ${file.name}`)

        const buffer = await file.arrayBuffer()
        const excelData = parseExcelFile(buffer)

        // 각 시트를 개별 파일처럼 처리
        excelData.forEach((sheet) => {
          const dataType = inferDataType(sheet.sheetName)
          parsedData.push({
            fileName: file.name,
            sheetName: sheet.sheetName,
            dataType,
            data: sheet.data,
            headers: sheet.headers,
            recordCount: sheet.recordCount,
            fileType: "excel",
          })
        })
      } else if (fileExtension === "csv") {
        // CSV 파일 처리 (기존 로직)
        console.log(`CSV 파일 처리 중: ${file.name}`)

        const content = await file.text()
        const data = parseCSV(content)
        const dataType = inferDataType(file.name)

        parsedData.push({
          fileName: file.name,
          sheetName: null,
          dataType,
          data,
          headers: data.length > 0 ? Object.keys(data[0]) : [],
          recordCount: data.length,
          fileType: "csv",
        })
      } else {
        throw new Error(`지원하지 않는 파일 형식입니다: ${file.name}`)
      }
    }

    // 데이터 타입별로 정리
    const organizedData = {
      user: parsedData.find((d) => d.dataType === "user")?.data || [],
      chat: parsedData.find((d) => d.dataType === "chat")?.data || [],
      message: parsedData.find((d) => d.dataType === "message")?.data || [],
    }

    console.log(`데이터 정리 완료:`, {
      user: organizedData.user.length,
      chat: organizedData.chat.length,
      message: organizedData.message.length,
    })

    return Response.json({
      success: true,
      files: parsedData,
      organizedData,
      message: `${files.length}개 파일이 성공적으로 업로드되었습니다.`,
    })
  } catch (error) {
    console.error("파일 업로드 오류:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "파일 업로드 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
