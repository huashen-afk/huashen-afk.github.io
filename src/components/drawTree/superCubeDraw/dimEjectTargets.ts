import type { DimPoseAngles, Seg2 } from './dimPoseBridge'
import { cubeFrameSize, hypercubeFrameSize } from './dimSize'
import {
  cubeEdgeColor,
  DIM_GREEN,
  hypercubeEdgeColor,
} from './dimColors'

interface Pt {
  x: number
  y: number
}

interface Vec4 {
  x: number
  y: number
  z: number
  w: number
}

interface Vec3 {
  x: number
  y: number
  z: number
}

function rotYW(p: Vec4, a: number): Vec4 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.w * s, z: p.z, w: p.y * s + p.w * c }
}

function rotX4(p: Vec4, a: number): Vec4 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c, w: p.w }
}

function rotY4(p: Vec4, a: number): Vec4 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c, w: p.w }
}

function rotZ4(p: Vec4, a: number): Vec4 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z, w: p.w }
}

function project4To2(p: Vec4, scale: number, ox: number, oy: number): Pt {
  const dist4 = 2.2
  const f4 = dist4 / (dist4 - p.w)
  const x3 = p.x * f4
  const y3 = p.y * f4
  const z3 = p.z * f4
  const dist3 = 3
  const f3 = dist3 / (dist3 - z3)
  return { x: ox + x3 * f3 * scale, y: oy + y3 * f3 * scale }
}

function rotateX3(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }
}

function rotateY3(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }
}

/** 与 HypercubeDraw 首帧相同的投影 / 旋转顺序 */
export function buildHypercubeTargetSegs(
  size: number,
  pose: Partial<DimPoseAngles> = {},
): { segs: Seg2[]; cssSize: number } {
  const s = Math.max(8, size)
  const cssSize = hypercubeFrameSize(s)
  const w = pose.w ?? pose.f ?? 0
  const rx = pose.x ?? 0
  const ry = pose.y ?? 0
  const rz = pose.z ?? 0

  const verts: Vec4[] = []
  for (let i = 0; i < 16; i++) {
    verts.push({
      x: i & 1 ? 0.5 : -0.5,
      y: i & 2 ? 0.5 : -0.5,
      z: i & 4 ? 0.5 : -0.5,
      w: i & 8 ? 0.5 : -0.5,
    })
  }

  const ox = cssSize / 2
  const oy = cssSize / 2
  const pts = verts.map((v) => {
    const p = rotZ4(rotY4(rotX4(rotYW({ ...v }, w), rx), ry), rz)
    return project4To2(p, s, ox, oy)
  })

  const segs: Seg2[] = []
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const a = verts[i]
      const b = verts[j]
      const d =
        Number(a.x !== b.x) +
        Number(a.y !== b.y) +
        Number(a.z !== b.z) +
        Number(a.w !== b.w)
      if (d === 1) {
        segs.push({
          x0: pts[i].x,
          y0: pts[i].y,
          x1: pts[j].x,
          y1: pts[j].y,
          color: hypercubeEdgeColor(a, b),
        })
      }
    }
  }
  return { segs, cssSize }
}

/** 与 CubeDraw 首帧相同 */
export function buildCubeTargetSegs(
  size: number,
  pose: Partial<DimPoseAngles> = {},
): { segs: Seg2[]; cssSize: number } {
  const s = Math.max(8, size)
  const cssSize = cubeFrameSize(s)
  const rx = pose.x ?? 0
  const ry = pose.y ?? 0

  const corners: Vec3[] = [
    { x: -0.5, y: -0.5, z: -0.5 },
    { x: 0.5, y: -0.5, z: -0.5 },
    { x: 0.5, y: 0.5, z: -0.5 },
    { x: -0.5, y: 0.5, z: -0.5 },
    { x: -0.5, y: -0.5, z: 0.5 },
    { x: 0.5, y: -0.5, z: 0.5 },
    { x: 0.5, y: 0.5, z: 0.5 },
    { x: -0.5, y: 0.5, z: 0.5 },
  ]
  const pairs: [number, number][] = [
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

  const ox = cssSize / 2
  const oy = cssSize / 2
  const pts = corners.map((c) => {
    const p = rotateY3(rotateX3({ x: c.x * s, y: c.y * s, z: c.z * s }, rx), ry)
    return { x: ox + p.x, y: oy + p.y }
  })

  return {
    cssSize,
    segs: pairs.map(([i, j]) => ({
      x0: pts[i].x,
      y0: pts[i].y,
      x1: pts[j].x,
      y1: pts[j].y,
      color: cubeEdgeColor(corners[i], corners[j]),
    })),
  }
}

/**
 * 与 RhombusDraw(side, minAngle=90, rotation=45, clockwise) 完全一致
 */
export function buildSquareTargetSegs(
  side: number,
  rotationDeg = 45,
  minAngle = 90,
): { segs: Seg2[]; cssSize: number; width: number; height: number } {
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

  const segs: Seg2[] = []
  for (let i = 0; i < 4; i++) {
    const p = points[i]
    const q = points[(i + 1) % 4]
    segs.push({ x0: p.x, y0: p.y, x1: q.x, y1: q.y, color: DIM_GREEN })
  }

  return { segs, cssSize: Math.ceil(Math.max(width, height)), width, height }
}
