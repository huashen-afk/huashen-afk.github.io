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
import { hypercubeFrameSize } from './dimSize'
import { HYPERCUBE_LAND } from './dimEjectPhase'
import { hypercubeEdgeColor } from './dimColors'

interface HypercubeDrawProps {
  /** 超立方体特征尺度（px） */
  size?: number
  /** 本组件绘制 id，供其他组件 after 引用 */
  drawId?: string
  /** 前驱 drawId；省略则立即按默认逻辑绘制 */
  after?: string
  /** 鼠标驱动灵敏度；0 关闭。具体轴由内部 FOLLOW_AXIS 开关控制 */
  followRotate?: number
  /** 为 true 时跳过渐进，直接完整显示并标记完成 */
  instant?: boolean
  /** 落位接上父体弹出时的姿态 */
  initialPose?: Partial<DimPoseAngles>
}

interface Vec4 {
  x: number
  y: number
  z: number
  w: number
}

interface Pt {
  x: number
  y: number
}

function buildVertices(): Vec4[] {
  const verts: Vec4[] = []
  for (let i = 0; i < 16; i++) {
    verts.push({
      x: i & 1 ? 0.5 : -0.5,
      y: i & 2 ? 0.5 : -0.5,
      z: i & 4 ? 0.5 : -0.5,
      w: i & 8 ? 0.5 : -0.5,
    })
  }
  return verts
}

function buildEdges(verts: Vec4[]): [number, number][] {
  const edges: [number, number][] = []
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const a = verts[i]
      const b = verts[j]
      const d =
        Number(a.x !== b.x) +
        Number(a.y !== b.y) +
        Number(a.z !== b.z) +
        Number(a.w !== b.w)
      if (d === 1) edges.push([i, j])
    }
  }
  return edges
}

const VERTS4 = buildVertices()
const EDGES = buildEdges(VERTS4)

const BASE_RX = 0.35
const BASE_RY = 0.4
const BASE_RZ = 0.08
const W_SPIN = 0.95
const AUTO_Y = 0.34
/** 慢速 Z 自转，使子集 X 棱周期性扫过水平 */
const AUTO_Z = 0.28

/** 鼠标跟随轴开关（内部变量）：true 开启该轴跟随 */
const FOLLOW_AXIS = {
  x: true,
  y: true,
  z: false,
} as const

/** W 维自转（YW 平面，投影上更易察觉） */
function rotYW(p: Vec4, a: number): Vec4 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.w * s, z: p.z, w: p.y * s + p.w * c }
}

/** 绕 X：YZ */
function rotX(p: Vec4, a: number): Vec4 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c, w: p.w }
}

/** 绕 Y：XZ */
function rotY(p: Vec4, a: number): Vec4 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c, w: p.w }
}

/** 绕 Z：XY */
function rotZ(p: Vec4, a: number): Vec4 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z, w: p.w }
}

/** 4D → 3D 透视 → 2D */
function project4To2(p: Vec4, scale: number, ox: number, oy: number): Pt {
  const dist4 = 2.2
  const f4 = dist4 / (dist4 - p.w)
  const x3 = p.x * f4
  const y3 = p.y * f4
  const z3 = p.z * f4

  const dist3 = 3
  const f3 = dist3 / (dist3 - z3)
  return {
    x: ox + x3 * f3 * scale,
    y: oy + y3 * f3 * scale,
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
  for (const [i, j] of EDGES) {
    if (remain <= 0) break
    const a = points[i]
    const b = points[j]
    const t = Math.min(1, remain / edgeLen)
    ctx.strokeStyle = hypercubeEdgeColor(VERTS4[i], VERTS4[j])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
    ctx.stroke()
    remain -= edgeLen
  }
}

export function HypercubeDraw({
  size = 64,
  drawId,
  after,
  followRotate = 0,
  instant = false,
  initialPose,
}: HypercubeDrawProps) {
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawnRef = useRef(0)
  const rotRef = useRef({
    w: initialPose?.w ?? initialPose?.f ?? HYPERCUBE_LAND.w,
    x: initialPose?.x ?? HYPERCUBE_LAND.x,
    y: initialPose?.y ?? HYPERCUBE_LAND.y,
    z: initialPose?.z ?? HYPERCUBE_LAND.z,
  })
  const ptsRef = useRef<Pt[]>([])
  const { canDrawRef, notifyComplete } = useDrawGate(drawId, after)
  useRegisterCanvas(id, canvasRef)

  const amount = Math.max(0, followRotate)
  const s = Math.max(8, size)
  const edgeLen = s
  const perimeter = EDGES.length * edgeLen
  const cssSize = hypercubeFrameSize(s)
  const needPointer =
    amount > 0 && (FOLLOW_AXIS.x || FOLLOW_AXIS.y || FOLLOW_AXIS.z)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawnRef.current = instant ? perimeter : 0
    rotRef.current = {
      w: initialPose?.w ?? initialPose?.f ?? HYPERCUBE_LAND.w,
      x: initialPose?.x ?? HYPERCUBE_LAND.x,
      y: initialPose?.y ?? HYPERCUBE_LAND.y,
      z: initialPose?.z ?? HYPERCUBE_LAND.z,
    }
    let frame = 0
    let running = true
    let last = performance.now()
    const releasePointer = needPointer ? acquirePointerTracking() : null
    let completed = false
    let firstPaint = true

    function captureChild(): Seg2[] {
      const pts = ptsRef.current
      if (pts.length !== VERTS4.length) return []
      const segs: Seg2[] = []
      for (const [i, j] of EDGES) {
        if (VERTS4[i].w !== 0.5 || VERTS4[j].w !== 0.5) continue
        segs.push({
          x0: pts[i].x,
          y0: pts[i].y,
          x1: pts[j].x,
          y1: pts[j].y,
          color: hypercubeEdgeColor(VERTS4[i], VERTS4[j]),
        })
      }
      return segs
    }

    function getSubsetXTilt() {
      const pts = ptsRef.current
      if (pts.length !== VERTS4.length) return Math.PI / 2
      let sum = 0
      let n = 0
      for (const [i, j] of EDGES) {
        const a = VERTS4[i]
        const b = VERTS4[j]
        if (a.w !== 0.5 || b.w !== 0.5) continue
        if (a.x === b.x || a.y !== b.y || a.z !== b.z) continue
        sum += Math.atan2(pts[j].y - pts[i].y, pts[j].x - pts[i].x)
        n++
      }
      return n > 0 ? sum / n : Math.PI / 2
    }

    function getPose(): DimPoseAngles {
      const r = rotRef.current
      return { x: r.x, y: r.y, z: r.z, w: r.w, f: 0, l: 0 }
    }

    setDimCapture('d4', { cssSize, captureChild, getSubsetXTilt, getPose })

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

      // 首帧保持 initialPose，与飞行落地 to 完全重合
      if (!firstPaint) {
        rotRef.current.w += W_SPIN * dt

        if (needPointer) {
          const ptr = getScenePointer()
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const nx = Math.max(-1, Math.min(1, (ptr.x - cx) / Math.max(rect.width, 1)))
          const ny = Math.max(-1, Math.min(1, (ptr.y - cy) / Math.max(rect.height, 1)))
          const span = 1.15 * amount
          const smooth = 1 - Math.exp(-8 * dt)

          if (FOLLOW_AXIS.x) {
            const targetX = BASE_RX - ny * span
            rotRef.current.x += (targetX - rotRef.current.x) * smooth
          }
          if (FOLLOW_AXIS.y) {
            const targetY = BASE_RY + nx * span
            rotRef.current.y += (targetY - rotRef.current.y) * smooth
          } else {
            rotRef.current.y += AUTO_Y * dt
          }
          if (FOLLOW_AXIS.z) {
            const targetZ = BASE_RZ + nx * 0.45 * amount
            rotRef.current.z += (targetZ - rotRef.current.z) * smooth
          }
        } else {
          rotRef.current.y += AUTO_Y * dt
          rotRef.current.z += AUTO_Z * dt
        }
      }
      firstPaint = false

      if (canDrawRef.current && isVisible && drawnRef.current < perimeter) {
        drawnRef.current = Math.min(perimeter, drawnRef.current + DRAW_SPEED * dt)
      }

      const { w, x, y, z } = rotRef.current
      const ox = cssSize / 2
      const oy = cssSize / 2
      const points = VERTS4.map((v) => {
        const p = rotZ(rotY(rotX(rotYW({ ...v }, w), x), y), z)
        return project4To2(p, s, ox, oy)
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
      setDimCapture('d4', null)
    }
  }, [
    s,
    cssSize,
    edgeLen,
    perimeter,
    amount,
    needPointer,
    instant,
    initialPose,
    canDrawRef,
    notifyComplete,
  ])

  return (
    <div className="draw-follow-wrap">
      <canvas ref={canvasRef} className="hypercubedraw-canvas" aria-hidden />
    </div>
  )
}
