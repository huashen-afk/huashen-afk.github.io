import { useEffect, useId, useMemo, useRef } from 'react'
import { DRAW_SPEED, STROKE, useDrawGate, useFollowRotate, useRegisterCanvas } from './sceneRegistry'

interface RhombusDrawProps {
  /** 边长（px） */
  side?: number
  /** 最小角角度（度），默认 30 */
  minAngle?: number
  /** 是否顺时针绘制，默认 true */
  clockwise?: boolean
  /** 图形自身旋转角度（度），默认 0 */
  rotation?: number
  /** 本组件绘制 id，供其他组件 after 引用 */
  drawId?: string
  /** 前驱 drawId；省略则立即按默认逻辑绘制 */
  after?: string
  /** 跟随鼠标旋转倍数；0 关闭，>0 开启（角 = 鼠标方位角 × 该值） */
  followRotate?: number
}

function buildRhombusPoints(side: number, minAngle: number, rotationDeg: number, clockwise: boolean) {
  const a = Math.max(1, side)
  const theta = Math.min(179, Math.max(1, minAngle))
  const halfRad = (theta * Math.PI) / 360
  const halfH = a * Math.sin(halfRad)
  const halfV = a * Math.cos(halfRad)

  let pts = [
    { x: 0, y: -halfV },
    { x: halfH, y: 0 },
    { x: 0, y: halfV },
    { x: -halfH, y: 0 },
  ]
  if (!clockwise) pts = [pts[0], pts[3], pts[2], pts[1]]

  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  pts = pts.map((p) => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }))

  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 2
  const width = Math.max(2, maxX - minX + pad * 2)
  const height = Math.max(2, maxY - minY + pad * 2)
  const ox = -minX + pad
  const oy = -minY + pad
  const points = pts.map((p) => ({ x: p.x + ox, y: p.y + oy }))
  const perimeter = 4 * a
  return { points, width, height, perimeter }
}

function drawProgressivePolygon(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  drawn: number,
  closed: boolean,
) {
  if (points.length < 2 || drawn <= 0) return
  const segs: { x0: number; y0: number; x1: number; y1: number; len: number }[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    if (!closed && i === points.length - 1) break
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    segs.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, len })
  }

  let remain = drawn
  ctx.beginPath()
  let started = false
  for (const seg of segs) {
    if (remain <= 0) break
    const t = Math.min(1, remain / seg.len)
    const x = seg.x0 + (seg.x1 - seg.x0) * t
    const y = seg.y0 + (seg.y1 - seg.y0) * t
    if (!started) {
      ctx.moveTo(seg.x0, seg.y0)
      started = true
    }
    ctx.lineTo(x, y)
    remain -= seg.len
  }
  ctx.stroke()
}

export function RhombusDraw({
  side = 64,
  minAngle = 30,
  clockwise = true,
  rotation = 0,
  drawId,
  after,
  followRotate = 0,
}: RhombusDrawProps) {
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawnRef = useRef(0)
  const { canDrawRef, notifyComplete } = useDrawGate(drawId, after)
  const wrapRef = useFollowRotate(followRotate)
  useRegisterCanvas(id, canvasRef)

  const geo = useMemo(
    () => buildRhombusPoints(side, minAngle, rotation, clockwise),
    [side, minAngle, rotation, clockwise],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawnRef.current = 0
    let frame = 0
    let running = true
    let last = performance.now()

    function tick(now: number) {
      if (!running || !canvas) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { width, height, perimeter, points } = geo
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
      }

      const rect = canvas.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isVisible =
        rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh

      if (canDrawRef.current && isVisible && drawnRef.current < perimeter) {
        drawnRef.current = Math.min(perimeter, drawnRef.current + DRAW_SPEED * dt)
      }

      if (drawnRef.current >= perimeter) notifyComplete()

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, width, height)
        ctx.strokeStyle = STROKE
        ctx.lineWidth = 1
        ctx.lineJoin = 'miter'
        drawProgressivePolygon(ctx, points, drawnRef.current, true)
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [geo, canDrawRef, notifyComplete])

  return (
    <div ref={wrapRef} className="draw-follow-wrap">
      <canvas ref={canvasRef} className="rhombusdraw-canvas" aria-hidden />
    </div>
  )
}
