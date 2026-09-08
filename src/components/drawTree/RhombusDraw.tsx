import { useEffect, useRef, useState } from 'react'

/** 视口内路径绘制速度（px/s，沿周长） */
const DRAW_SPEED = 240

interface RhombusDrawProps {
  /** 边长（px） */
  side?: number
  /** 最小角角度（度），默认 30 */
  minAngle?: number
  /** 是否顺时针绘制，默认 true */
  clockwise?: boolean
  /** 图形自身旋转角度（度），默认 0 */
  rotation?: number
}

export function RhombusDraw({
  side = 64,
  minAngle = 30,
  clockwise = true,
  rotation = 0,
}: RhombusDrawProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawnRef = useRef(0)
  const [drawn, setDrawn] = useState(0)

  const a = Math.max(1, side)
  const theta = Math.min(179, Math.max(1, minAngle))
  const halfRad = (theta * Math.PI) / 360
  const halfH = a * Math.sin(halfRad)
  const halfV = a * Math.cos(halfRad)
  const width = Math.max(2, halfH * 2)
  const height = Math.max(2, halfV * 2)
  const cx = width / 2
  const cy = height / 2
  const perimeter = 4 * a

  // 顶点朝上，最小角在上下；顺时针：上 → 右 → 下 → 左
  const path = [
    `M ${cx} ${cy - halfV}`,
    `L ${cx + halfH} ${cy}`,
    `L ${cx} ${cy + halfV}`,
    `L ${cx - halfH} ${cy}`,
    'Z',
  ].join(' ')

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

      if (isVisible && drawnRef.current < perimeter) {
        drawnRef.current = Math.min(perimeter, drawnRef.current + DRAW_SPEED * dt)
        setDrawn(drawnRef.current)
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [perimeter])

  const dashOffset = perimeter - drawn
  const transform = clockwise
    ? undefined
    : `translate(${cx} ${cy}) scale(-1 1) translate(${-cx} ${-cy})`

  return (
    <div
      ref={wrapRef}
      className="rhombusdraw-wrap"
      style={{ width, height, transform: `rotate(${rotation}deg)` }}
      aria-hidden
    >
      <svg
        className="rhombusdraw-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <path
          className="rhombusdraw-path"
          d={path}
          fill="none"
          stroke="#d8d2c8"
          strokeWidth={1}
          strokeDasharray={perimeter}
          strokeDashoffset={dashOffset}
          transform={transform}
        />
      </svg>
    </div>
  )
}
