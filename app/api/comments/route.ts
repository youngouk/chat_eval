import type { NextRequest } from "next/server"
import { put, list, del } from "@vercel/blob"

// 코멘트 데이터 타입
interface Comment {
  id: string
  chatId: string
  managerId: string
  managerName: string
  comment: string
  createdAt: string
  createdBy: string
}

// 코멘트 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chatId, managerId, managerName, comment, createdBy } = body

    if (!chatId || !comment) {
      return Response.json({ error: "ChatID와 코멘트는 필수입니다." }, { status: 400 })
    }

    const commentData: Comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatId,
      managerId: managerId || "",
      managerName: managerName || "",
      comment,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || "관리자",
    }

    // Vercel Blob Storage에 저장
    const filename = `comments/${commentData.id}.json`
    const blob = await put(filename, JSON.stringify(commentData, null, 2), {
      access: "public",
      contentType: "application/json",
    })

    return Response.json({
      success: true,
      comment: commentData,
      message: "코멘트가 성공적으로 저장되었습니다.",
    })
  } catch (error) {
    console.error("코멘트 저장 오류:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "코멘트 저장 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}

// 코멘트 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get("chatId")

    const { blobs } = await list({ prefix: "comments/" })

    const comments: Comment[] = []

    // 모든 코멘트 파일을 읽어서 필터링
    for (const blob of blobs) {
      try {
        const response = await fetch(blob.url)
        const commentData = await response.json()

        // chatId가 지정된 경우 해당 상담의 코멘트만 반환
        if (!chatId || commentData.chatId === chatId) {
          comments.push(commentData)
        }
      } catch (error) {
        console.error(`코멘트 파일 읽기 오류 (${blob.pathname}):`, error)
      }
    }

    // 최신순으로 정렬
    comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return Response.json({
      success: true,
      comments,
      total: comments.length,
    })
  } catch (error) {
    console.error("코멘트 조회 오류:", error)
    return Response.json({ error: "코멘트 조회 중 오류가 발생했습니다." }, { status: 500 })
  }
}

// 코멘트 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get("commentId")

    if (!commentId) {
      return Response.json({ error: "삭제할 코멘트 ID가 필요합니다." }, { status: 400 })
    }

    const filename = `comments/${commentId}.json`
    await del(filename)

    return Response.json({
      success: true,
      message: "코멘트가 성공적으로 삭제되었습니다.",
    })
  } catch (error) {
    console.error("코멘트 삭제 오류:", error)
    return Response.json({ error: "코멘트 삭제 중 오류가 발생했습니다." }, { status: 500 })
  }
}
