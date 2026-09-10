import { useEffect, useId, useRef } from 'react'
import {
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
import { penteractFrameSize } from './dimSize'
import { PENTERACT_INIT } from './dimEjectPhase'
import { penteractEdgeColor } from './dimColors'

interface PenteractDrawProps {
  /** 5 维超立方体特征尺度（px） */
  size?: number
  drawId?: string
  after?: string
  /** 鼠标驱动灵敏度；0 关闭。轴由内部 FOLLOW_AXIS 控制（仅 xyz） */
  followRotate?: number
  /** 为 true 时跳过渐进，直接完整显示并标记完成 */
  instant?: boolean
  /** 落位接上父体弹出时的姿态，避免定格 */
  initialPose?: Partial<DimPoseAngles>
}

/** 坐标：x,y,z + f(第4维) + l(第5维) */
interface Vec5 {
  x: number
  y: number
  z: number
  f: number
  l: number
}

interface Pt {
  x: number
  y: number
}

function buildVertices(): Vec5[] {
  const verts: Vec5[] = []
  for (let i = 0; i < 32; i++) {
    verts.push({
      x: i & 1 ? 0.5 : -0.5,
      y: i & 2 ? 0.5 : -0.5,
      z: i & 4 ? 0.5 : -0.5,
      f: i & 8 ? 0.5 : -0.5,
      l: i & 16 ? 0.5 : -0.5,
    })
  }
  return verts
}

function buildEdges(verts: Vec5[]): [number, number][] {
  const edges: [number, number][] = []
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const a = verts[i]
      const b = verts[j]
      const d =
        Number(a.x !== b.x) +
        Number(a.y !== b.y) +
        Number(a.z !== b.z) +
        Number(a.f !== b.f) +
        Number(a.l !== b.l)
      if (d === 1) edges.push([i, j])
    }
  }
  return edges
}

const VERTS5 = buildVertices()
const EDGES = buildEdges(VERTS5)

/** 分批绘制时长：方 1s → 立方 1s → 超立方 2s → 连接 1s */
const PHASE_DUR = { square: 1, cube: 1, hyper: 2, link: 1 } as const
const DRAW_TOTAL_S =
  PHASE_DUR.square + PHASE_DUR.cube + PHASE_DUR.hyper + PHASE_DUR.link

type EdgeBatch = 'square' | 'cube' | 'hyper' | 'link'

function classifyEdge(i: number, j: number): EdgeBatch {
  const a = VERTS5[i]
  const b = VERTS5[j]
  // 主要正方形：弹出路径立方体的 z=+0.5 面（l=f=0.5）
  if (
    a.l === 0.5 &&
    b.l === 0.5 &&
    a.f === 0.5 &&
    b.f === 0.5 &&
    a.z === 0.5 &&
    b.z === 0.5
  ) {
    return 'square'
  }
  // 该正方形所在立方体的其余棱
  if (a.l === 0.5 && b.l === 0.5 && a.f === 0.5 && b.f === 0.5) {
    return 'cube'
  }
  // 该立方体所在超立方体（l=+0.5）的其余棱
  if (a.l === 0.5 && b.l === 0.5) {
    return 'hyper'
  }
  // 连接各部分（含另一侧超立方体与跨维棱）
  return 'link'
}

const BATCHES: Record<EdgeBatch, [number, number][]> = {
  square: [],
  cube: [],
  hyper: [],
  link: [],
}
for (const e of EDGES) {
  BATCHES[classifyEdge(e[0], e[1])].push(e)
}

const PHASE_ORDER: EdgeBatch[] = ['square', 'cube', 'hyper', 'link']

const BASE_RX = 0.35
const BASE_RY = 0.4
const BASE_RZ = 0.08
const F_SPIN = 0.85
const L_SPIN = F_SPIN * 1.1
const AUTO_Y = 0.32
const AUTO_Z = 0.26

/** 鼠标跟随轴开关：仅开放 xyz */
const FOLLOW_AXIS = {
  x: false,
  y: true,
  z: false,
} as const

function rotYF(p: Vec5, a: number): Vec5 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.f * s, z: p.z, f: p.y * s + p.f * c, l: p.l }
}

function rotXL(p: Vec5, a: number): Vec5 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c - p.l * s, y: p.y, z: p.z, f: p.f, l: p.x * s + p.l * c }
}

function rotX(p: Vec5, a: number): Vec5 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c, f: p.f, l: p.l }
}

function rotY(p: Vec5, a: number): Vec5 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c, f: p.f, l: p.l }
}

function rotZ(p: Vec5, a: number): Vec5 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z, f: p.f, l: p.l }
}

/** 5D → 4D → 3D → 2D 透视投影 */
function project5To2(p: Vec5, scale: number, ox: number, oy: number): Pt {
  const d5 = 2.4
  const f5 = d5 / (d5 - p.l)
  const x4 = p.x * f5
  const y4 = p.y * f5
  const z4 = p.z * f5
  const f4v = p.f * f5

  const d4 = 2.2
  const k4 = d4 / (d4 - f4v)
  const x3 = x4 * k4
  const y3 = y4 * k4
  const z3 = z4 * k4

  const d3 = 3
  const k3 = d3 / (d3 - z3)
  return {
    x: ox + x3 * k3 * scale,
    y: oy + y3 * k3 * scale,
  }
}

function drawEdgePartial(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  i: number,
  j: number,
  t: number,
) {
  if (t <= 0) return
  const a = points[i]
  const b = points[j]
  const u = Math.min(1, t)
  ctx.strokeStyle = penteractEdgeColor(VERTS5[i], VERTS5[j])
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u)
  ctx.stroke()
}

/** 按时间轴分批绘制：已完成批次全画，当前批次内所有棱并行推进 */
function drawPhasedEdges(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  elapsed: number,
) {
  if (elapsed <= 0) return
  let t = elapsed
  for (const key of PHASE_ORDER) {
    const edges = BATCHES[key]
    const dur = PHASE_DUR[key]
    if (edges.length === 0) {
      t -= dur
      continue
    }
    if (t >= dur) {
      for (const [i, j] of edges) drawEdgePartial(ctx, points, i, j, 1)
      t -= dur
    } else if (t > 0) {
      const frac = t / dur
      for (const [i, j] of edges) drawEdgePartial(ctx, points, i, j, frac)
      return
    } else {
      return
    }
  }
}

export function PenteractDraw({
  size = 40,
  drawId,
  after,
  followRotate = 0,
  instant = false,
  initialPose,
}: PenteractDrawProps) {
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotRef = useRef({
    f: initialPose?.f ?? PENTERACT_INIT.f,
    l: initialPose?.l ?? PENTERACT_INIT.l,
    x: initialPose?.x ?? PENTERACT_INIT.x,
    y: initialPose?.y ?? PENTERACT_INIT.y,
    z: initialPose?.z ?? PENTERACT_INIT.z,
  })
  const ptsRef = useRef<{ x: number; y: number }[]>([])
  const { canDrawRef, notifyComplete } = useDrawGate(drawId, after)
  useRegisterCanvas(id, canvasRef)

  const amount = Math.max(0, followRotate)
  const s = Math.max(8, size)
  const cssSize = penteractFrameSize(s)
  const needPointer =
    amount > 0 && (FOLLOW_AXIS.x || FOLLOW_AXIS.y || FOLLOW_AXIS.z)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const drawElapsedRef = { current: instant ? DRAW_TOTAL_S : 0 }
    rotRef.current = {
      f: initialPose?.f ?? PENTERACT_INIT.f,
      l: initialPose?.l ?? PENTERACT_INIT.l,
      x: initialPose?.x ?? PENTERACT_INIT.x,
      y: initialPose?.y ?? PENTERACT_INIT.y,
      z: initialPose?.z ?? PENTERACT_INIT.z,
    }
    let frame = 0
    let running = true
    let last = performance.now()
    const releasePointer = needPointer ? acquirePointerTracking() : null
    let completed = false

    function captureChild(): Seg2[] {
      const pts = ptsRef.current
      if (pts.length !== VERTS5.length) return []
      const segs: Seg2[] = []
      for (const [i, j] of EDGES) {
        if (VERTS5[i].l !== 0.5 || VERTS5[j].l !== 0.5) continue
        segs.push({
          x0: pts[i].x,
          y0: pts[i].y,
          x1: pts[j].x,
          y1: pts[j].y,
          color: penteractEdgeColor(VERTS5[i], VERTS5[j]),
        })
      }
      return segs
    }

    function getSubsetXTilt() {
      const pts = ptsRef.current
      if (pts.length !== VERTS5.length) return Math.PI / 2
      let sum = 0
      let n = 0
      for (const [i, j] of EDGES) {
        const a = VERTS5[i]
        const b = VERTS5[j]
        if (a.l !== 0.5 || b.l !== 0.5) continue
        if (a.x === b.x || a.y !== b.y || a.z !== b.z || a.f !== b.f) continue
        sum += Math.atan2(pts[j].y - pts[i].y, pts[j].x - pts[i].x)
        n++
      }
      return n > 0 ? sum / n : Math.PI / 2
    }

    function getPose(): DimPoseAngles {
      const r = rotRef.current
      return { x: r.x, y: r.y, z: r.z, w: 0, f: r.f, l: r.l }
    }

    setDimCapture('d5', { cssSize, captureChild, getSubsetXTilt, getPose })

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

      rotRef.current.f += F_SPIN * dt
      rotRef.current.l += L_SPIN * dt

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

      if (canDrawRef.current && isVisible && drawElapsedRef.current < DRAW_TOTAL_S) {
        drawElapsedRef.current = Math.min(DRAW_TOTAL_S, drawElapsedRef.current + dt)
      }

      const { f, l, x, y, z } = rotRef.current
      const ox = cssSize / 2
      const oy = cssSize / 2
      const points = VERTS5.map((v) => {
        const p = rotZ(rotY(rotX(rotXL(rotYF({ ...v }, f), l), x), y), z)
        return project5To2(p, s, ox, oy)
      })
      ptsRef.current = points

      if (!completed && drawElapsedRef.current >= DRAW_TOTAL_S) {
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
        drawPhasedEdges(ctx, points, drawElapsedRef.current)
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
      releasePointer?.()
      setDimCapture('d5', null)
    }
  }, [
    s,
    cssSize,
    amount,
    needPointer,
    instant,
    initialPose,
    canDrawRef,
    notifyComplete,
  ])

  return (
    <div className="draw-follow-wrap">
      <canvas ref={canvasRef} className="penteractdraw-canvas" aria-hidden />
    </div>
  )
}
