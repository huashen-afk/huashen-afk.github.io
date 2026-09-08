import { useEffect, useRef, useState } from 'react'

/** 视口内圆弧绘制速度（px/s，沿周长） */
const DRAW_SPEED = 240

interface CircleDrawProps {
  /** 半径（px） */
  radius?: number
  /** 是否顺时针绘制，默认 true */
  clockwise?: boolean
}

export function CircleDraw({ radius = 48, clockwise = true }: CircleDrawProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawnRef = useRef(0)
  const [drawn, setDrawn] = useState(0)

  const r = Math.max(1, radius)
  const size = r * 2
  const circumference = 2 * Math.PI * r

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    drawnRef.current = 0
    setDrawn(0)

    let frame = 0
    let running = true
    let last = performance.now()

    function tick(now: number) {
      if (!running || !wrap) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const rect = wrap.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isVisible =
        rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh

      if (isVisible && drawnRef.current < circumference) {
        drawnRef.current = Math.min(circumference, drawnRef.current + DRAW_SPEED * dt)
        setDrawn(drawnRef.current)
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [circumference])

  const dashOffset = circumference - drawn
  const transform = clockwise
    ? `rotate(-90 ${r} ${r})`
    : `translate(${r} ${r}) scale(-1 1) translate(${-r} ${-r}) rotate(-90 ${r} ${r})`

  return (
    <div
      ref={wrapRef}
      className="circledraw-wrap"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        className="circledraw-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="circledraw-circle"
          cx={r}
          cy={r}
          r={r - 0.5}
          fill="none"
          stroke="#d8d2c8"
          strokeWidth={1}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={transform}
        />
      </svg>
    </div>
  )
}
