import type { NextRequest } from "next/server"
import { put } from "@vercel/blob"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data, description } = body

    console.log("자동 아카이빙 요청:", { type, description, dataSize: JSON.stringify(data).length })

    if (!data) {
      return Response.json({ error: "저장할 데이터가 없습니다." }, { status: 400 })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `${type}_${timestamp}.json`

    // Vercel Blob Storage에 실제 저장
    const blob = await put(filename, JSON.stringify(data, null, 2), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true, // Add this line to allow overwriting existing files
    })

    console.log("자동 아카이빙 성공:", { filename, url: blob.url })

    return Response.json({
      success: true,
      message: `${description || type} 자동 저장 완료`,
      archive: {
        id: `auto_${Date.now()}`,
        type,
        filename,
        url: blob.url,
        size: 0, // Vercel Blob API does not provide size directly
        createdAt: timestamp,
        downloadUrl: blob.downloadUrl || blob.url,
        description,
      },
    })
  } catch (error) {
    console.error("자동 아카이빙 오류:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "자동 아카이빙 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.stack : "상세 정보 없음",
      },
      { status: 500 },
    )
  }
}
