import { useEffect, useId, useRef } from 'react'
import {
  DRAW_SPEED,
  acquirePointerTracking,
  getScenePointer,
  useDrawGate,
  useRegisterCanvas,
} from '../sceneRegistry'
import {
  setDimCapture,
  type DimPoseAngles,
  type Seg2,
} from './dimPoseBridge'
import { cubeFrameSize } from './dimSize'
import { CUBE_LAND } from './dimEjectPhase'
import { cubeEdgeColor, DIM_GREEN } from './dimColors'

interface CubeDrawProps {
  /** 立方体边长（px） */
  size?: number
  /** 本组件绘制 id，供其他组件 after 引用 */
  drawId?: string
  /** 前驱 drawId；省略则立即按默认逻辑绘制 */
  after?: string
  /** 立体跟随灵敏度；0 关闭，>0 开启（越大转得越多） */
  followRotate?: number
  /** 为 true 时跳过渐进，直接完整显示并标记完成 */
  instant?: boolean
  /** 落位接上父体弹出时的姿态 */
  initialPose?: Partial<DimPoseAngles>
}

interface Vec3 {
  x: number
  y: number
  z: number
}

interface Pt {
  x: number
  y: number
}

const CORNERS: Vec3[] = [
  { x: -0.5, y: -0.5, z: -0.5 },
  { x: 0.5, y: -0.5, z: -0.5 },
  { x: 0.5, y: 0.5, z: -0.5 },
  { x: -0.5, y: 0.5, z: -0.5 },
  { x: -0.5, y: -0.5, z: 0.5 },
  { x: 0.5, y: -0.5, z: 0.5 },
  { x: 0.5, y: 0.5, z: 0.5 },
  { x: -0.5, y: 0.5, z: 0.5 },
]

const PAIRS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

/** 前脸 z=+0.5 上的 X 向棱（用于水平判定） */
const FACE_X_EDGES: [number, number][] = [
  [4, 5],
  [7, 6],
]

const BASE_RX = 0.4
const BASE_RY = 0.55
const AUTO_Y = 0.55

function rotateX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }
}

function rotateY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }
}

function project(p: Vec3, scale: number, ox: number, oy: number): Pt {
  return {
    x: ox + p.x * scale,
    y: oy + p.y * scale,
  }
}

function drawProgressiveEdges(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  edgeLen: number,
  drawn: number,
) {
  if (drawn <= 0) return
  let remain = drawn
  for (const [i, j] of PAIRS) {
    if (remain <= 0) break
    const a = points[i]
    const b = points[j]
    const t = Math.min(1, remain / edgeLen)
    ctx.strokeStyle = cubeEdgeColor(CORNERS[i], CORNERS[j])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
    ctx.stroke()
    remain -= edgeLen
  }
}

export function CubeDraw({
  size = 72,
  drawId,
  after,
  followRotate = 0,
  instant = false,
  initialPose,
}: CubeDrawProps) {
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawnRef = useRef(0)
  const rotRef = useRef({
    x: initialPose?.x ?? CUBE_LAND.x,
    y: initialPose?.y ?? CUBE_LAND.y,
  })
  const ptsRef = useRef<Pt[]>([])
  const { canDrawRef, notifyComplete } = useDrawGate(drawId, after)
  useRegisterCanvas(id, canvasRef)

  const amount = Math.max(0, followRotate)
  const s = Math.max(8, size)
  const edgeLen = s
  const perimeter = 12 * edgeLen
  const cssSize = cubeFrameSize(s)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawnRef.current = instant ? perimeter : 0
    rotRef.current = {
      x: initialPose?.x ?? CUBE_LAND.x,
      y: initialPose?.y ?? CUBE_LAND.y,
    }
    let frame = 0
    let running = true
    let last = performance.now()
    const releasePointer = amount > 0 ? acquirePointerTracking() : null
    let completed = false
    let firstPaint = true

    function captureChild(): Seg2[] {
      const pts = ptsRef.current
      if (pts.length !== CORNERS.length) return []
      const face: [number, number][] = [
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
      ]
      return face.map(([i, j]) => ({
        x0: pts[i].x,
        y0: pts[i].y,
        x1: pts[j].x,
        y1: pts[j].y,
        color: DIM_GREEN,
      }))
    }

    function getSubsetXTilt() {
      const pts = ptsRef.current
      if (pts.length !== CORNERS.length) return Math.PI / 2
      let sum = 0
      let n = 0
      for (const [i, j] of FACE_X_EDGES) {
        sum += Math.atan2(pts[j].y - pts[i].y, pts[j].x - pts[i].x)
        n++
      }
      return n > 0 ? sum / n : Math.PI / 2
    }

    function getPose(): DimPoseAngles {
      const r = rotRef.current
      return { x: r.x, y: r.y, z: 0, w: 0, f: 0, l: 0 }
    }

    setDimCapture('d3', { cssSize, captureChild, getSubsetXTilt, getPose })

    function tick(now: number) {
      if (!running || !canvas) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (
        canvas.width !== Math.floor(cssSize * dpr) ||
        canvas.height !== Math.floor(cssSize * dpr)
      ) {
        canvas.width = Math.floor(cssSize * dpr)
        canvas.height = Math.floor(cssSize * dpr)
        canvas.style.width = `${cssSize}px`
        canvas.style.height = `${cssSize}px`
      }

      const rect = canvas.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isVisible =
        rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh

      if (!firstPaint) {
        if (amount > 0) {
          const ptr = getScenePointer()
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const nx = Math.max(-1, Math.min(1, (ptr.x - cx) / Math.max(rect.width, 1)))
          const ny = Math.max(-1, Math.min(1, (ptr.y - cy) / Math.max(rect.height, 1)))
          const maxTilt = 0.9 * amount
          const targetX = BASE_RX - ny * maxTilt
          const targetY = BASE_RY + nx * maxTilt
          const smooth = 1 - Math.exp(-8 * dt)
          rotRef.current.x += (targetX - rotRef.current.x) * smooth
          rotRef.current.y += (targetY - rotRef.current.y) * smooth
        } else {
          // 从落地姿态继续自转，不硬重置到 BASE
          rotRef.current.y += AUTO_Y * dt
          rotRef.current.x += Math.cos(rotRef.current.y * 0.65) * 0.25 * dt
        }
      }
      firstPaint = false

      if (canDrawRef.current && isVisible && drawnRef.current < perimeter) {
        drawnRef.current = Math.min(perimeter, drawnRef.current + DRAW_SPEED * dt)
      }

      const { x: rx, y: ry } = rotRef.current
      const ox = cssSize / 2
      const oy = cssSize / 2
      const points = CORNERS.map((c) => {
        const p = rotateY(rotateX({ x: c.x * s, y: c.y * s, z: c.z * s }, rx), ry)
        return project(p, 1, ox, oy)
      })
      ptsRef.current = points

      if (!completed && drawnRef.current >= perimeter) {
        completed = true
        notifyComplete()
      }

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, cssSize, cssSize)
        ctx.lineWidth = 1
        ctx.lineCap = 'butt'
        ctx.lineJoin = 'miter'
        drawProgressiveEdges(ctx, points, edgeLen, drawnRef.current)
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
      releasePointer?.()
      setDimCapture('d3', null)
    }
  }, [s, cssSize, edgeLen, perimeter, amount, instant, initialPose, canDrawRef, notifyComplete])

  return (
    <div className="draw-follow-wrap">
      <canvas ref={canvasRef} className="cubedraw-canvas" aria-hidden />
    </div>
  )
}
