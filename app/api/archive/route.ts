import type { NextRequest } from "next/server"
import { put, list, del } from "@vercel/blob"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data, filename } = body

    if (!data) {
      return Response.json({ error: "저장할 데이터가 없습니다." }, { status: 400 })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const finalFilename = filename || `${type}_archive_${timestamp}.json`

    // 로컬 개발 환경에서는 시뮬레이션된 응답 반환
    if (process.env.NODE_ENV === 'development' && 
        (!process.env.BLOB_READ_WRITE_TOKEN || 
         process.env.BLOB_READ_WRITE_TOKEN.includes('dummy'))) {
      return Response.json({
        success: true,
        archive: {
          id: `archive_${Date.now()}`,
          type,
          filename: finalFilename,
          url: `#local-dev-mode`,
          size: JSON.stringify(data).length,
          createdAt: timestamp,
          downloadUrl: `#local-dev-mode`
        },
        message: `로컬 개발 환경: 데이터가 시뮬레이션으로 아카이빙되었습니다.`
      })
    }

    // Vercel Blob Storage에 실제 저장
    const blob = await put(finalFilename, JSON.stringify(data, null, 2), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true, // Add this line to allow overwriting existing files
    })

    const archiveData = {
      id: `archive_${Date.now()}`,
      type,
      filename: finalFilename,
      url: blob.url,
      size: 0, // Vercel Blob API does not provide size directly
      createdAt: timestamp,
      downloadUrl: blob.downloadUrl || blob.url,
    }

    return Response.json({
      success: true,
      archive: archiveData,
      message: `데이터가 성공적으로 아카이빙되었습니다.`,
    })
  } catch (error) {
    console.error("아카이빙 오류:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "아카이빙 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    // 로컬 개발 환경에서 Blob 토큰이 유효하지 않은 경우 빈 배열 반환
    if (process.env.NODE_ENV === 'development' && 
        (!process.env.BLOB_READ_WRITE_TOKEN || 
         process.env.BLOB_READ_WRITE_TOKEN.includes('dummy'))) {
      return Response.json({
        success: true,
        archives: [],
        total: 0,
        message: "로컬 개발 환경: Vercel Blob 비활성화"
      })
    }

    const { blobs } = await list()

    const archives = blobs
      .filter(
        (blob) =>
          blob.pathname.includes("archive") || blob.pathname.includes("feedback") || blob.pathname.includes("chat"),
      )
      .map((blob) => ({
        id: blob.pathname,
        filename: blob.pathname,
        url: blob.url,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
        downloadUrl: blob.downloadUrl,
        type: blob.pathname.includes("feedback") ? "feedback" : "chat",
      }))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

    return Response.json({
      success: true,
      archives,
      total: archives.length,
    })
  } catch (error) {
    console.error("아카이브 목록 조회 오류:", error)
    return Response.json({ error: "아카이브 목록을 불러올 수 없습니다." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get("filename")
    const deleteType = searchParams.get("type") // 'all', 'uploaded_data', 'individual_feedback', 'comprehensive_analysis'

    // 로컬 개발 환경에서는 시뮬레이션된 응답 반환
    if (process.env.NODE_ENV === 'development' && 
        (!process.env.BLOB_READ_WRITE_TOKEN || 
         process.env.BLOB_READ_WRITE_TOKEN.includes('dummy'))) {
      return Response.json({
        success: true,
        message: `로컬 개발 환경: 아카이브 삭제가 시뮬레이션되었습니다.`
      })
    }

    if (deleteType === "all") {
      // 모든 아카이브 삭제
      const { blobs } = await list()
      const deletePromises = blobs.map((blob) => del(blob.pathname))
      await Promise.all(deletePromises)

      return Response.json({
        success: true,
        message: `총 ${blobs.length}개의 아카이브가 삭제되었습니다.`,
      })
    } else if (deleteType && ["uploaded_data", "individual_feedback", "comprehensive_analysis"].includes(deleteType)) {
      // 특정 타입의 아카이브만 삭제
      const { blobs } = await list()
      const targetBlobs = blobs.filter((blob) => blob.pathname.includes(deleteType))
      const deletePromises = targetBlobs.map((blob) => del(blob.pathname))
      await Promise.all(deletePromises)

      return Response.json({
        success: true,
        message: `${deleteType} 타입의 ${targetBlobs.length}개 아카이브가 삭제되었습니다.`,
      })
    } else if (filename) {
      // 개별 파일 삭제
      await del(filename)

      return Response.json({
        success: true,
        message: "아카이브가 성공적으로 삭제되었습니다.",
      })
    } else {
      return Response.json({ error: "삭제할 파일명 또는 타입이 필요합니다." }, { status: 400 })
    }
  } catch (error) {
    console.error("아카이브 삭제 오류:", error)
    return Response.json({ error: "아카이브 삭제 중 오류가 발생했습니다." }, { status: 500 })
  }
}
