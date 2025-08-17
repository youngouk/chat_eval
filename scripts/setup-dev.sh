#!/bin/bash

# =============================================================================
# Multi-LLM 평가 시스템 개발 환경 설정 스크립트
# =============================================================================

set -e  # 오류 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로고 출력
echo -e "${BLUE}"
echo "================================================================="
echo "  Multi-LLM 평가 시스템 개발 환경 설정"
echo "  Fintech Customer Service Chat Evaluation System"
echo "================================================================="
echo -e "${NC}"

# 함수 정의
print_step() {
    echo -e "${BLUE}[단계 $1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1이(가) 설치되어 있습니다"
        return 0
    else
        print_error "$1이(가) 설치되어 있지 않습니다"
        return 1
    fi
}

# =============================================================================
# 단계 1: 시스템 요구사항 확인
# =============================================================================
print_step "1" "시스템 요구사항 확인"

# Node.js 확인
if check_command "node"; then
    NODE_VERSION=$(node --version)
    echo "   버전: $NODE_VERSION"
    
    # Node.js 18+ 확인
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_error "Node.js 18 이상이 필요합니다. 현재 버전: $NODE_VERSION"
        echo "   설치 가이드: https://nodejs.org/"
        exit 1
    fi
else
    print_error "Node.js가 설치되어 있지 않습니다"
    echo "   설치 가이드: https://nodejs.org/"
    exit 1
fi

# npm 확인
if check_command "npm"; then
    NPM_VERSION=$(npm --version)
    echo "   버전: $NPM_VERSION"
else
    print_error "npm이 설치되어 있지 않습니다"
    exit 1
fi

# Git 확인 (선택사항)
if check_command "git"; then
    GIT_VERSION=$(git --version)
    echo "   $GIT_VERSION"
fi

echo ""

# =============================================================================
# 단계 2: 프로젝트 디렉토리 확인
# =============================================================================
print_step "2" "프로젝트 디렉토리 확인"

if [ ! -f "package.json" ]; then
    print_error "package.json 파일을 찾을 수 없습니다"
    print_error "프로젝트 루트 디렉토리에서 실행해주세요"
    exit 1
fi

PROJECT_NAME=$(grep -o '"name": "[^"]*' package.json | cut -d'"' -f4)
print_success "프로젝트 발견: $PROJECT_NAME"

echo ""

# =============================================================================
# 단계 3: 환경변수 설정
# =============================================================================
print_step "3" "환경변수 설정"

if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        print_warning ".env.local 파일이 없습니다. .env.example에서 복사합니다"
        cp .env.example .env.local
        print_success ".env.local 파일이 생성되었습니다"
        print_warning "API 키를 설정해주세요:"
        echo "   1. .env.local 파일을 편집하세요"
        echo "   2. OPENAI_API_KEY를 실제 OpenAI API 키로 변경하세요"
        echo "   3. GOOGLE_AI_API_KEY를 실제 Google AI API 키로 변경하세요 (선택사항)"
        echo ""
        echo "   API 키 발급 방법:"
        echo "   - OpenAI: https://platform.openai.com/api-keys"
        echo "   - Google AI: https://aistudio.google.com/app/apikey"
        echo ""
    else
        print_error ".env.example 파일을 찾을 수 없습니다"
        exit 1
    fi
else
    print_success ".env.local 파일이 이미 존재합니다"
    
    # API 키 확인
    if grep -q "your-openai-api-key-here" .env.local; then
        print_warning "OpenAI API 키가 아직 설정되지 않았습니다"
        echo "   .env.local 파일에서 OPENAI_API_KEY를 실제 값으로 변경해주세요"
    else
        print_success "OpenAI API 키가 설정되어 있습니다"
    fi
    
    if grep -q "your-google-ai-api-key-here" .env.local; then
        print_warning "Google AI API 키가 아직 설정되지 않았습니다"
        echo "   Multi-LLM 모드를 위해 GOOGLE_AI_API_KEY 설정을 권장합니다"
    else
        print_success "Google AI API 키가 설정되어 있습니다"
    fi
fi

echo ""

# =============================================================================
# 단계 4: 의존성 설치
# =============================================================================
print_step "4" "의존성 설치"

if [ ! -d "node_modules" ]; then
    print_warning "node_modules 디렉토리가 없습니다. 의존성을 설치합니다"
    echo "   npm install 실행 중..."
    npm install
    print_success "의존성 설치 완료"
else
    print_success "node_modules가 이미 존재합니다"
    
    # package-lock.json 확인하여 업데이트 필요 여부 체크
    if [ "package.json" -nt "node_modules" ]; then
        print_warning "package.json이 node_modules보다 최신입니다. 의존성을 업데이트합니다"
        npm install
        print_success "의존성 업데이트 완료"
    fi
fi

echo ""

# =============================================================================
# 단계 5: TypeScript 컴파일 확인
# =============================================================================
print_step "5" "TypeScript 컴파일 확인"

if npm run build:check &> /dev/null; then
    print_success "TypeScript 컴파일 성공"
else
    print_warning "TypeScript 컴파일을 시도합니다..."
    if npx tsc --noEmit; then
        print_success "TypeScript 컴파일 성공"
    else
        print_error "TypeScript 컴파일 오류가 있습니다"
        echo "   오류를 수정한 후 다시 실행해주세요"
    fi
fi

echo ""

# =============================================================================
# 단계 6: 개발 서버 실행 스크립트 생성
# =============================================================================
print_step "6" "개발 서버 실행 스크립트 생성"

# package.json에 개발용 스크립트 추가
cat > scripts/dev-server.sh << 'EOF'
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
EOF

chmod +x scripts/dev-server.sh

print_success "개발 서버 실행 스크립트 생성 완료 (scripts/dev-server.sh)"

echo ""

# =============================================================================
# 단계 7: 헬스 체크 스크립트 생성
# =============================================================================
print_step "7" "헬스 체크 스크립트 생성"

cat > scripts/health-check.sh << 'EOF'
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
EOF

chmod +x scripts/health-check.sh

print_success "헬스 체크 스크립트 생성 완료 (scripts/health-check.sh)"

echo ""

# =============================================================================
# 완료 메시지
# =============================================================================
echo -e "${GREEN}"
echo "================================================================="
echo "  🎉 개발 환경 설정 완료!"
echo "================================================================="
echo -e "${NC}"

echo -e "${BLUE}다음 단계:${NC}"
echo ""
echo "1️⃣  API 키 설정 (중요!):"
echo "   ${YELLOW}nano .env.local${NC}  # 또는 원하는 에디터 사용"
echo ""
echo "2️⃣  개발 서버 시작:"
echo "   ${YELLOW}./scripts/dev-server.sh${NC}  # 또는 npm run dev"
echo ""
echo "3️⃣  시스템 상태 확인:"
echo "   ${YELLOW}./scripts/health-check.sh${NC}"
echo ""
echo "4️⃣  웹 브라우저에서 접속:"
echo "   ${YELLOW}http://localhost:3000${NC}"
echo ""

echo -e "${BLUE}주요 엔드포인트:${NC}"
echo "   🏠 홈페이지: http://localhost:3000"
echo "   🔌 API 루트: http://localhost:3000/api"
echo "   🤖 Multi-LLM 평가: http://localhost:3000/api/evaluate-multi"
echo ""

echo -e "${BLUE}문제 해결:${NC}"
echo "   📖 프로젝트 구조: PROJECT_STRUCTURE.md"
echo "   📋 README: README.md"
echo "   🔧 개선 계획: IMPROVEMENT_PLAN.md"
echo ""

echo -e "${GREEN}Happy Coding! 🚀${NC}"