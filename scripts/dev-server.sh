#!/bin/bash

# =============================================================================
# 개발 서버 실행 스크립트
# =============================================================================

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "================================================================="
echo "  Multi-LLM 평가 시스템 개발 서버 시작"
echo "================================================================="
echo -e "${NC}"

# 환경변수 확인
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local 파일이 없습니다${NC}"
    echo "   setup-dev.sh를 먼저 실행해주세요"
    exit 1
fi

# API 키 확인
if grep -q "your-openai-api-key-here" .env.local; then
    echo -e "${YELLOW}⚠️  OpenAI API 키가 설정되지 않았습니다${NC}"
    echo "   .env.local 파일에서 OPENAI_API_KEY를 설정해주세요"
    echo ""
fi

echo -e "${GREEN}🚀 Next.js 개발 서버를 시작합니다...${NC}"
echo ""
echo "   📍 로컬 주소: http://localhost:3000"
echo "   📍 API 엔드포인트: http://localhost:3000/api"
echo "   📍 Multi-LLM 평가: http://localhost:3000/api/evaluate-multi"
echo ""
echo "   종료하려면 Ctrl+C를 누르세요"
echo ""

# Next.js 개발 서버 시작
npm run dev
