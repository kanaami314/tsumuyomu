import { useEffect, useRef, useState } from 'react'

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** 開始から終了までの途中の値(整数)。progress は 0〜1 */
export function interpolate(from: number, to: number, progress: number): number {
  return Math.round(from + (to - from) * easeOutCubic(Math.min(1, Math.max(0, progress))))
}

/** OS で「視差効果を減らす」(動きを減らす)が選ばれているか */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** 数字を、前の値から、いまの値まで、数え上げるように変える。動きを減らす設定のときは、すぐに切り替える */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    const begin = from.current
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = (now - start) / duration
      const next = interpolate(begin, target, progress)
      from.current = next
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration, reduced])

  return reduced ? target : value
}
