/**
 * 弹出相位：各维从初始角连续自转，在「绘制完成 + EJECT_SETTLE_MS」时
 * 子集 X 棱接近水平，便于立刻取样飞出。
 * 数值由角速度与绘制时长反推（见仓库内标定思路）。
 */
export const EJECT_SETTLE_MS = 1000

/** 5 维开局姿态（分批绘制约 5s，完成后再转 1s 到达可弹出） */
export const PENTERACT_INIT = {
  f: -2.962,
  l: -4.048,
  x: 0.35,
  y: -0.81,
  z: 1.177,
} as const

/**
 * 4 维落位姿态：挂载后自转 1s 到达可弹出 3 维。
 * 飞行终点 / initialPose 使用此值，保证落地外形与真组件一致。
 */
export const HYPERCUBE_LAND = {
  w: 1.083,
  x: 0.35,
  y: 4.723,
  z: 0.088,
  f: 0,
  l: 0,
} as const

/** 3 维落位姿态：挂载后自转 1s 到达可弹出 2 维 */
export const CUBE_LAND = {
  x: 0.268,
  y: 3.906,
  z: 0,
  w: 0,
  f: 0,
  l: 0,
} as const
