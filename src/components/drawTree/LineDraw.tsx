import { useEffect, useId, useRef } from 'react'
import { DRAW_SPEED, STROKE, useDrawGate, useFollowRotate, useRegisterCanvas } from './sceneRegistry'

interface LineDrawProps {
  /** 旋转角度（度），0 为竖直向下 */
  rotation?: number
  /** 是否绘制虚线 */
  dashed?: boolean
  /** 虚线步长（实线段长度，单位 px；间隙同长） */
  dashStep?: number
  /** 线段长度（px）；省略时近水平用视口宽，近竖直用视口高 */
  length?: number
  /** 本组件绘制 id，供其他组件 after 引用 */
  drawId?: string
  /** 前驱 drawId；省略则立即按默认逻辑绘制 */
  after?: string
  /** 跟随鼠标旋转倍数；0 关闭，>0 开启（角 = 鼠标方位角 × 该值） */
  followRotate?: number
}

export function LineDraw({
  rotation = 0,
  dashed = false,
  dashStep = 8,
  length,
  drawId,
  after,
  followRotate = 0,
}: LineDrawProps) {
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawnRef = useRef(0)
  const { canDrawRef, notifyComplete } = useDrawGate(drawId, after)
  const wrapRef = useFollowRotate(followRotate)
  useRegisterCanvas(id, canvasRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawnRef.current = 0
    let frame = 0
    let running = true
    let last = performance.now()

    function layout() {
      const rad = (rotation * Math.PI) / 180
      const horiz = Math.abs(Math.sin(rad)) >= Math.abs(Math.cos(rad))
      const L = Math.max(
        1,
        length ?? (horiz ? window.innerWidth : window.innerHeight),
      )
      const dx = Math.sin(rad) * L
      const dy = Math.cos(rad) * L
      const pad = 2
      const minX = Math.min(0, dx)
      const maxX = Math.max(0, dx)
      const minY = Math.min(0, dy)
      const maxY = Math.max(0, dy)
      const cssW = Math.max(2, maxX - minX + pad * 2)
      const cssH = Math.max(2, maxY - minY + pad * 2)
      const ox = -minX + pad
      const oy = -minY + pad
      return { L, dx, dy, cssW, cssH, ox, oy }
    }

    function tick(now: number) {
      if (!running || !canvas) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const geo = layout()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (
        canvas.width !== Math.floor(geo.cssW * dpr) ||
        canvas.height !== Math.floor(geo.cssH * dpr)
      ) {
        canvas.width = Math.floor(geo.cssW * dpr)
        canvas.height = Math.floor(geo.cssH * dpr)
        canvas.style.width = `${geo.cssW}px`
        canvas.style.height = `${geo.cssH}px`
      }

      const rect = canvas.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const ix1 = Math.max(rect.left, 0)
      const iy1 = Math.max(rect.top, 0)
      const ix2 = Math.min(rect.right, vw)
      const iy2 = Math.min(rect.bottom, vh)
      const isVisible = ix2 > ix1 && iy2 > iy1

      if (canDrawRef.current && isVisible) {
        const majorX = rect.width >= rect.height
        const visibleSpan = majorX ? ix2 - ix1 : iy2 - iy1
        const totalSpan = Math.max(1, majorX ? rect.width : rect.height)
        const target = Math.min(geo.L, (visibleSpan / totalSpan) * geo.L)
        if (drawnRef.current < target) {
          drawnRef.current = Math.min(target, drawnRef.current + DRAW_SPEED * dt)
        }
      }

      if (drawnRef.current >= geo.L) notifyComplete()

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, geo.cssW, geo.cssH)
        const t = drawnRef.current / geo.L
        const x0 = geo.ox
        const y0 = geo.oy
        const x1 = geo.ox + geo.dx * t
        const y1 = geo.oy + geo.dy * t
        ctx.strokeStyle = STROKE
        ctx.lineWidth = 1
        ctx.lineCap = 'butt'
        if (dashed) {
          const step = Math.max(1, dashStep)
          ctx.setLineDash([step, step])
        } else {
          ctx.setLineDash([])
        }
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [rotation, dashed, dashStep, length, canDrawRef, notifyComplete])

  return (
    <div ref={wrapRef} className="draw-follow-wrap">
      <canvas ref={canvasRef} className="linedraw-canvas" aria-hidden />
    </div>
  )
}
