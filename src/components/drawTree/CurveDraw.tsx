import { useEffect, useId, useRef } from 'react'
import { DRAW_SPEED, STROKE, useDrawGate, useFollowRotate, useRegisterCanvas } from './sceneRegistry'

interface Point {
  x: number
  y: number
}

interface CurveDrawProps {
  /** 起点（局部坐标 px） */
  from?: Point
  /** 终点（局部坐标 px） */
  to?: Point
  /** 相对弦的垂直曲率偏移（px，有符号） */
  curvature?: number
  /** 曲率变化位置，0–1，控制点在弦上的投影 */
  bendAt?: number
  /** 本组件绘制 id，供其他组件 after 引用 */
  drawId?: string
  /** 前驱 drawId；省略则立即按默认逻辑绘制 */
  after?: string
  /** 跟随鼠标旋转倍数；0 关闭，>0 开启（角 = 鼠标方位角 × 该值） */
  followRotate?: number
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function quadPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  }
}

function approxLength(p0: Point, p1: Point, p2: Point, samples = 48) {
  let len = 0
  let prev = p0
  for (let i = 1; i <= samples; i++) {
    const cur = quadPoint(p0, p1, p2, i / samples)
    len += Math.hypot(cur.x - prev.x, cur.y - prev.y)
    prev = cur
  }
  return Math.max(1, len)
}

function buildControl(from: Point, to: Point, curvature: number, bendAt: number): Point {
  const mx = from.x + (to.x - from.x) * bendAt
  const my = from.y + (to.y - from.y) * bendAt
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  return { x: mx + nx * curvature, y: my + ny * curvature }
}

export function CurveDraw({
  from = { x: 0, y: 0 },
  to = { x: 160, y: 0 },
  curvature = 48,
  bendAt = 0.5,
  drawId,
  after,
  followRotate = 0,
}: CurveDrawProps) {
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

    const tBend = clamp01(bendAt)
    const ctrl = buildControl(from, to, curvature, tBend)
    const totalLen = approxLength(from, ctrl, to)
    const pad = 2
    const minX = Math.min(from.x, ctrl.x, to.x)
    const maxX = Math.max(from.x, ctrl.x, to.x)
    const minY = Math.min(from.y, ctrl.y, to.y)
    const maxY = Math.max(from.y, ctrl.y, to.y)
    const cssW = Math.max(2, maxX - minX + pad * 2)
    const cssH = Math.max(2, maxY - minY + pad * 2)
    const ox = -minX + pad
    const oy = -minY + pad
    const p0 = { x: from.x + ox, y: from.y + oy }
    const p1 = { x: ctrl.x + ox, y: ctrl.y + oy }
    const p2 = { x: to.x + ox, y: to.y + oy }

    function tick(now: number) {
      if (!running || !canvas) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (
        canvas.width !== Math.floor(cssW * dpr) ||
        canvas.height !== Math.floor(cssH * dpr)
      ) {
        canvas.width = Math.floor(cssW * dpr)
        canvas.height = Math.floor(cssH * dpr)
        canvas.style.width = `${cssW}px`
        canvas.style.height = `${cssH}px`
      }

      const rect = canvas.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isVisible =
        rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh

      if (canDrawRef.current && isVisible && drawnRef.current < totalLen) {
        drawnRef.current = Math.min(totalLen, drawnRef.current + DRAW_SPEED * dt)
      }

      if (drawnRef.current >= totalLen) notifyComplete()

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, cssW, cssH)
        const progress = drawnRef.current / totalLen
        const samples = Math.max(2, Math.ceil(48 * progress))
        ctx.strokeStyle = STROKE
        ctx.lineWidth = 1
        ctx.lineCap = 'butt'
        ctx.setLineDash([])
        ctx.beginPath()
        const start = quadPoint(p0, p1, p2, 0)
        ctx.moveTo(start.x, start.y)
        for (let i = 1; i <= samples; i++) {
          const pt = quadPoint(p0, p1, p2, (i / samples) * progress)
          ctx.lineTo(pt.x, pt.y)
        }
        ctx.stroke()
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [from.x, from.y, to.x, to.y, curvature, bendAt, canDrawRef, notifyComplete])

  return (
    <div ref={wrapRef} className="draw-follow-wrap">
      <canvas ref={canvasRef} className="curvedraw-canvas" aria-hidden />
    </div>
  )
}
