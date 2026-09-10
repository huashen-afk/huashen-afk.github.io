import { STROKE } from '../sceneRegistry'

/** 正方形 */
export const DIM_GREEN = '#3D9B6E'

/** 立方体（除主正方形外） */
export const DIM_YELLOW = '#D4B84A'

/** 超立方体其余棱 */
export const DIM_BLUE = '#4A7DB8'

/** 连接 / 未强调 */
export const DIM_NEUTRAL = STROKE

interface V5c {
  l: number
  f: number
  z: number
}

interface V4c {
  w: number
  z: number
}

interface V3c {
  z: number
}

/** 5 维：方绿 / 立方黄 / 超立方蓝 / 连接中性 */
export function penteractEdgeColor(a: V5c, b: V5c): string {
  if (a.l === 0.5 && b.l === 0.5 && a.f === 0.5 && b.f === 0.5 && a.z === 0.5 && b.z === 0.5) {
    return DIM_GREEN
  }
  if (a.l === 0.5 && b.l === 0.5 && a.f === 0.5 && b.f === 0.5) {
    return DIM_YELLOW
  }
  if (a.l === 0.5 && b.l === 0.5) {
    return DIM_BLUE
  }
  return DIM_NEUTRAL
}

/** 4 维：与 5 维弹出子集同构（w↔f） */
export function hypercubeEdgeColor(a: V4c, b: V4c): string {
  if (a.w === 0.5 && b.w === 0.5 && a.z === 0.5 && b.z === 0.5) {
    return DIM_GREEN
  }
  if (a.w === 0.5 && b.w === 0.5) {
    return DIM_YELLOW
  }
  return DIM_BLUE
}

/** 3 维：前脸绿，其余黄 */
export function cubeEdgeColor(a: V3c, b: V3c): string {
  if (a.z === 0.5 && b.z === 0.5) return DIM_GREEN
  return DIM_YELLOW
}
