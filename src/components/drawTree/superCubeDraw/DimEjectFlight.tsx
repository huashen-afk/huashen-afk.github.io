import { useEffect, useRef } from 'react'
import {
  centroidOfSegs,
  easeOutCubic,
  lerpSegs,
  rotateSegsAround,
  sortSegsForMatch,
  type Seg2,
} from './dimPoseBridge'
import { DIM_NEUTRAL } from './dimColors'

interface DimEjectFlightProps {
  width: number
  height: number
  fromSegs: Seg2[]
  toSegs: Seg2[]
  /** 飞行中额外旋转（度） */
  spinDeg?: number
  durationMs?: number
  /** 无分段 color 时的回退色 */
  strokeColor?: string
  onDone?: () => void
}

export function DimEjectFlight({
  width,
  height,
  fromSegs,
  toSegs,
  spinDeg = 0,
  durationMs = 900,
  strokeColor = DIM_NEUTRAL,
  onDone,
}: DimEjectFlightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const start = sortSegsForMatch(fromSegs)
    const end = sortSegsForMatch(toSegs)
    const c0 = centroidOfSegs(start)
    const c1 = centroidOfSegs(end)
    let frame = 0
    let running = true
    const t0 = performance.now()

    function tick(now: number) {
      if (!running || !canvas) return
      const raw = Math.min(1, (now - t0) / durationMs)
      const t = easeOutCubic(raw)

      const spun = rotateSegsAround(start, c0.x, c0.y, spinDeg * t)
      const mid = lerpSegs(spun, end, t)
      const cm = {
        x: c0.x + (c1.x - c0.x) * t,
        y: c0.y + (c1.y - c0.y) * t,
      }
      const cur = rotateSegsAround(mid, cm.x, cm.y, spinDeg * 0.15 * (1 - t))

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
      }

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, width, height)
        ctx.lineWidth = 1
        for (const s of cur) {
          ctx.strokeStyle = s.color ?? strokeColor
          ctx.beginPath()
          ctx.moveTo(s.x0, s.y0)
          ctx.lineTo(s.x1, s.y1)
          ctx.stroke()
        }
      }

      if (raw < 1) {
        frame = window.requestAnimationFrame(tick)
      } else {
        onDone?.()
      }
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [width, height, fromSegs, toSegs, spinDeg, durationMs, strokeColor, onDone])

  return (
    <canvas
      ref={canvasRef}
      className="topology-eject-flight"
      width={width}
      height={height}
      aria-hidden
    />
  )
}
