import { useState, useEffect } from "react"

/**
 * 모바일 디바이스 감지 Hook
 * @returns 현재 화면이 모바일인지 여부
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // 초기 체크
    checkScreenSize()

    // 리사이즈 이벤트 리스너 추가
    window.addEventListener("resize", checkScreenSize)

    // 클린업
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  return isMobile
}