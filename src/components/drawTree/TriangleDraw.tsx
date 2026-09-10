import { useEffect, useId, useMemo, useRef } from 'react'
import { DRAW_SPEED, STROKE, useDrawGate, useRegisterCanvas } from './sceneRegistry'

interface TriangleDrawProps {
  /**
   * 两角或三角（度）。传入三个时忽略最后一个。
   * 与 sides 一起决定形状与尺寸；默认等边 [60, 60]
   */
  angles?: [number, number] | [number, number, number]
  /** 三边长度 [a, b, c]（对边分别对应角 A、B、C）；默认等边 */
  sides?: [number, number, number]
  /** 是否顺时针绘制，默认 true */
  clockwise?: boolean
  /** 图形自身旋转角度（度），默认 0 */
  rotation?: number
  /** 本组件绘制 id，供其他组件 after 引用 */
  drawId?: string
  /** 前驱 drawId；省略则立即按默认逻辑绘制 */
  after?: string
}

function resolveAngles(angles: [number, number] | [number, number, number]): [number, number] {
  return [angles[0], angles[1]]
}

function buildTrianglePoints(
  anglePair: [number, number],
  sideLens: [number, number, number],
  rotationDeg: number,
  clockwise: boolean,
) {
  let A = (anglePair[0] * Math.PI) / 180
  let B = (anglePair[1] * Math.PI) / 180
  let C = Math.PI - A - B

  if (!(C > 0.01 && A > 0.01 && B > 0.01)) {
    A = Math.PI / 3
    B = Math.PI / 3
    C = Math.PI / 3
  }

  const [sa, sb, sc] = sideLens.map((s) => Math.max(1, s)) as [number, number, number]
  const ratio = (sa / Math.sin(A) + sb / Math.sin(B) + sc / Math.sin(C)) / 3
  const a = ratio * Math.sin(A)
  const b = ratio * Math.sin(B)
  const c = ratio * Math.sin(C)

  let pts = [
    { x: 0, y: 0 },
    { x: c, y: 0 },
    { x: b * Math.cos(A), y: b * Math.sin(A) },
  ]
  if (!clockwise) pts = [pts[0], pts[2], pts[1]]

  const cx0 = (pts[0].x + pts[1].x + pts[2].x) / 3
  const cy0 = (pts[0].y + pts[1].y + pts[2].y) / 3
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  pts = pts.map((p) => {
    const x = p.x - cx0
    const y = p.y - cy0
    return { x: x * cos - y * sin, y: x * sin + y * cos }
  })

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
  const perimeter = a + b + c
  return { points, width, height, perimeter }
}

function drawProgressivePolygon(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  drawn: number,
) {
  if (points.length < 2 || drawn <= 0) return
  const segs: { x0: number; y0: number; x1: number; y1: number; len: number }[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
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

export function TriangleDraw({
  angles = [60, 60],
  sides = [64, 64, 64],
  clockwise = true,
  rotation = 0,
  drawId,
  after,
}: TriangleDrawProps) {
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawnRef = useRef(0)
  const { canDrawRef, notifyComplete } = useDrawGate(drawId, after)
  useRegisterCanvas(id, canvasRef)

  const geo = useMemo(
    () => buildTrianglePoints(resolveAngles(angles), sides, rotation, clockwise),
    [angles, sides, rotation, clockwise],
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
        drawProgressivePolygon(ctx, points, drawnRef.current)
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [geo, canDrawRef, notifyComplete])

  return <canvas ref={canvasRef} className="triangledraw-canvas" aria-hidden />
}
