#!/bin/bash

# =============================================================================
# 시스템 헬스 체크 스크립트
# =============================================================================

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER_URL="http://localhost:3000"
API_ENDPOINT="$SERVER_URL/api/evaluate-multi"

echo -e "${BLUE}"
echo "================================================================="
echo "  Multi-LLM 평가 시스템 헬스 체크"
echo "================================================================="
echo -e "${NC}"

# 서버 응답 확인
echo "🔍 서버 상태 확인 중..."

if curl -s -f "$SERVER_URL" > /dev/null; then
    echo -e "${GREEN}✅ 웹 서버 응답 정상${NC}"
else
    echo -e "${RED}❌ 웹 서버 응답 없음${NC}"
    echo "   개발 서버가 실행 중인지 확인해주세요: npm run dev"
    exit 1
fi

# API 헬스 체크
echo "🔍 API 헬스 체크 중..."

HEALTH_RESPONSE=$(curl -s "$API_ENDPOINT" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API 서버 응답 정상${NC}"
    
    # JSON 파싱하여 상태 확인
    if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
        echo -e "${GREEN}✅ API 상태: OK${NC}"
    else
        echo -e "${YELLOW}⚠️  API 상태: 부분적 오류${NC}"
    fi
    
    # Provider 상태 확인
    if echo "$HEALTH_RESPONSE" | grep -q '"activeProviders":0'; then
        echo -e "${YELLOW}⚠️  활성화된 Provider 없음 (API 키 확인 필요)${NC}"
    else
        echo -e "${GREEN}✅ Multi-LLM Provider 활성화됨${NC}"
    fi
    
else
    echo -e "${RED}❌ API 서버 응답 없음${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📊 시스템 정보:${NC}"
echo "   🌐 웹 서버: $SERVER_URL"
echo "   🔌 API 엔드포인트: $API_ENDPOINT"
echo "   📅 체크 시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo -e "${GREEN}🎉 모든 시스템이 정상 작동 중입니다!${NC}"
