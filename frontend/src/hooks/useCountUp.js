import { useEffect, useRef, useState } from 'react'

/**
 * Animate a number from 0 up to `target` once, with an easeOutCubic curve.
 * Falls back to the final value instantly for non-numbers, zero, or when the
 * visitor prefers reduced motion.
 */
export default function useCountUp(target, { duration = 900 } = {}) {
  const end = Number(target)
  const [value, setValue] = useState(Number.isFinite(end) ? 0 : target)
  const frame = useRef(0)

  useEffect(() => {
    if (!Number.isFinite(end)) {
      setValue(target)
      return
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || end === 0) {
      setValue(end)
      return
    }
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(end * eased))
      if (p < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [end, target, duration])

  return value
}
