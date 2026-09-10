import { dimColorRank } from './dimColors'

export interface Seg2 {
  x0: number
  y0: number
  x1: number
  y1: number
  /** 分段颜色（复合着色飞出） */
  color?: string
}

export interface DimPoseAngles {
  x: number
  y: number
  z: number
  w: number
  f: number
  l: number
}

export interface DimPoseCapture {
  cssSize: number
  /** 画布局部坐标下的 n-1 维子集棱 */
  captureChild: () => Seg2[]
  /** 子集中沿 X 维棱的屏幕倾角（弧度，已折到 [-π/2,π/2]） */
  getSubsetXTilt: () => number
  /** 当前连续姿态角，供落位子体无缝接上 */
  getPose: () => DimPoseAngles
}

const captures: {
  d5: DimPoseCapture | null
  d4: DimPoseCapture | null
  d3: DimPoseCapture | null
} = {
  d5: null,
  d4: null,
  d3: null,
}

export function setDimCapture(
  key: keyof typeof captures,
  value: DimPoseCapture | null,
) {
  captures[key] = value
}

export function getDimCapture(key: keyof typeof captures) {
  return captures[key]
}

export function offsetSegs(segs: Seg2[], left: number, top: number): Seg2[] {
  return segs.map((s) => ({
    x0: s.x0 + left,
    y0: s.y0 + top,
    x1: s.x1 + left,
    y1: s.y1 + top,
    color: s.color,
  }))
}

export function translateSegs(segs: Seg2[], dx: number, dy: number): Seg2[] {
  return segs.map((s) => ({
    x0: s.x0 + dx,
    y0: s.y0 + dy,
    x1: s.x1 + dx,
    y1: s.y1 + dy,
    color: s.color,
  }))
}

export function centroidOfSegs(segs: Seg2[]) {
  let n = 0
  let sx = 0
  let sy = 0
  for (const s of segs) {
    sx += s.x0 + s.x1
    sy += s.y0 + s.y1
    n += 2
  }
  return { x: sx / Math.max(1, n), y: sy / Math.max(1, n) }
}

export function rotateSegsAround(segs: Seg2[], cx: number, cy: number, deg: number): Seg2[] {
  const rad = (deg * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const rot = (x: number, y: number) => ({
    x: cx + (x - cx) * c - (y - cy) * s,
    y: cy + (x - cx) * s + (y - cy) * c,
  })
  return segs.map((seg) => {
    const a = rot(seg.x0, seg.y0)
    const b = rot(seg.x1, seg.y1)
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y, color: seg.color }
  })
}

export function lerpSegs(a: Seg2[], b: Seg2[], t: number): Seg2[] {
  const n = Math.min(a.length, b.length)
  const out: Seg2[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      x0: a[i].x0 + (b[i].x0 - a[i].x0) * t,
      y0: a[i].y0 + (b[i].y0 - a[i].y0) * t,
      x1: a[i].x1 + (b[i].x1 - a[i].x1) * t,
      y1: a[i].y1 + (b[i].y1 - a[i].y1) * t,
      color: a[i].color ?? b[i].color,
    })
  }
  return out
}

export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

export function sortSegsForMatch(segs: Seg2[]): Seg2[] {
  const c = centroidOfSegs(segs)
  return [...segs].sort((u, v) => {
    const cr = dimColorRank(u.color) - dimColorRank(v.color)
    if (cr !== 0) return cr

    // 同色内：先按棱方向，再按中点方位，稳定对齐绿/黄/蓝各层
    const udx = u.x1 - u.x0
    const udy = u.y1 - u.y0
    const vdx = v.x1 - v.x0
    const vdy = v.y1 - v.y0
    // 无向棱：把方向折到 [0, π)
    const uDir = ((Math.atan2(udy, udx) % Math.PI) + Math.PI) % Math.PI
    const vDir = ((Math.atan2(vdy, vdx) % Math.PI) + Math.PI) % Math.PI
    if (Math.abs(uDir - vDir) > 1e-6) return uDir - vDir

    const umx = (u.x0 + u.x1) / 2
    const umy = (u.y0 + u.y1) / 2
    const vmx = (v.x0 + v.x1) / 2
    const vmy = (v.y0 + v.y1) / 2
    return Math.atan2(umy - c.y, umx - c.x) - Math.atan2(vmy - c.y, vmx - c.x)
  })
}

/** 折到 [0, π/2]，0 表示完全水平 */
export function absTiltFromHorizontal(rad: number) {
  let a = Math.abs(rad) % Math.PI
  if (a > Math.PI / 2) a = Math.PI - a
  return a
}

export interface EjectSnapshot {
  segs: Seg2[]
  pose: DimPoseAngles
  cssSize: number
}

/**
 * 不打断旋转：等到子集 X 轴自然接近水平后再取样。
 */
export function captureEjectSegs(
  key: keyof typeof captures,
  slot: { left: number; top: number },
  tiltTol = 0.12,
  /** 目标倾角（弧度）；0=水平，π/4=菱形边向 */
  targetTilt = 0,
): Promise<EjectSnapshot | null> {
  return new Promise((resolve) => {
    let tries = 0
    const maxTries = 900 // ~15s @60fps，等自然转到目标倾角

    function attempt() {
      const cap = captures[key]
      if (!cap) {
        if (++tries >= maxTries) {
          resolve(null)
          return
        }
        requestAnimationFrame(attempt)
        return
      }

      const tilt = absTiltFromHorizontal(cap.getSubsetXTilt() - targetTilt)
      const local = cap.captureChild()
      if (local.length > 0 && tilt <= tiltTol) {
        resolve({
          segs: offsetSegs(local, slot.left, slot.top),
          pose: cap.getPose(),
          cssSize: cap.cssSize,
        })
        return
      }

      if (++tries >= maxTries) {
        // 超时仍取样，避免卡死
        if (local.length > 0) {
          resolve({
            segs: offsetSegs(local, slot.left, slot.top),
            pose: cap.getPose(),
            cssSize: cap.cssSize,
          })
        } else {
          resolve(null)
        }
        return
      }
      requestAnimationFrame(attempt)
    }

    attempt()
  })
}
