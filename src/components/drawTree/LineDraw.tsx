import { useEffect, useRef, useState, type CSSProperties } from 'react'

/** 视口内线段绘制速度（px/s） */
const DRAW_SPEED = 240

interface LineDrawProps {
  /** 旋转角度（度），0 为竖直向下 */
  rotation?: number
  /** 是否绘制虚线 */
  dashed?: boolean
  /** 虚线步长（实线段长度，单位 px；间隙同长） */
  dashStep?: number
}

export function LineDraw({ rotation = 0, dashed = false, dashStep = 8 }: LineDrawProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drawnRef = useRef(0)
  const [drawn, setDrawn] = useState(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let frame = 0
    let running = true
    let last = performance.now()

    function tick(now: number) {
      if (!running || !track) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const length = track.offsetHeight
      const rect = track.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      const ix1 = Math.max(rect.left, 0)
      const iy1 = Math.max(rect.top, 0)
      const ix2 = Math.min(rect.right, vw)
      const iy2 = Math.min(rect.bottom, vh)
      const isVisible = ix2 > ix1 && iy2 > iy1

      if (isVisible) {
        const majorX = rect.width >= rect.height
        const visibleSpan = majorX ? ix2 - ix1 : iy2 - iy1
        const totalSpan = Math.max(1, majorX ? rect.width : rect.height)
        const target = Math.min(length, (visibleSpan / totalSpan) * length)

        if (drawnRef.current < target) {
          drawnRef.current = Math.min(target, drawnRef.current + DRAW_SPEED * dt)
          setDrawn(drawnRef.current)
        }
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [rotation])

  const step = Math.max(1, dashStep)
  const lineStyle: CSSProperties = {
    height: drawn,
    ...(dashed
      ? {
          backgroundImage: `repeating-linear-gradient(
            to bottom,
            #d8d2c8 0,
            #d8d2c8 ${step}px,
            transparent ${step}px,
            transparent ${step * 2}px
          )`,
          backgroundColor: 'transparent',
        }
      : {}),
  }

  return (
    <div
      ref={trackRef}
      className="linedraw-track"
      style={{ transform: `rotate(${rotation}deg)` }}
      aria-hidden
    >
      <div className="linedraw-line" style={lineStyle} />
    </div>
  )
}
