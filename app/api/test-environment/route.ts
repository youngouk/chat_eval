import { NextResponse } from 'next/server';

/**
 * 환경 테스트 API 엔드포인트
 * 개발 환경 설정 확인용
 */
export async function POST() {
  try {
    // 환경변수 상태 확인
    const envStatus = {
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        valid: process.env.OPENAI_API_KEY?.startsWith('sk-') || false
      },
      google: {
        configured: !!process.env.GOOGLE_AI_API_KEY,
        valid: process.env.GOOGLE_AI_API_KEY?.startsWith('AIza') || false
      },
      blob: {
        configured: !!process.env.BLOB_READ_WRITE_TOKEN,
        isDummy: process.env.BLOB_READ_WRITE_TOKEN?.includes('dummy') || false
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT || '3000',
        apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      }
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      status: envStatus,
      message: '환경 설정이 정상적으로 확인되었습니다.'
    });
  } catch (error) {
    console.error('환경 테스트 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '환경 테스트 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}