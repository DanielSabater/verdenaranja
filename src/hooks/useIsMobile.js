import { useState, useEffect } from "react"

export function useIsMobile(breakpoint = 900) {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint
  )
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= breakpoint)
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [breakpoint])
  return mobile
}
