/** 二维基准边长 / 画布边长 n；每升一维 ×√3 */
export const DIM_N = 36

const SQ3 = Math.sqrt(3)

/** 规定的正方形外接宽高（任意旋转须完整落在框内） */
export const DIM_FRAME = {
  d2: DIM_N,
  d3: DIM_N * SQ3,
  d4: DIM_N * 3,
  d5: DIM_N * 3 * SQ3,
} as const

/**
 * 单位特征尺度下，顶点投影到屏幕的最大半幅（|x| 或 |y| 上界）。
 * 4D/5D 来自多姿态采样上界并留裕量。
 */
export const DIM_HALF_EXTENT = {
  /** 立方体正交投影：半对角线 */
  cube: SQ3 / 2,
  hypercube: 1.25,
  penteract: 1.85,
} as const

const FRAME_PAD = 8

export function framePx(dim: keyof typeof DIM_FRAME) {
  return Math.ceil(DIM_FRAME[dim])
}

/** 由规定外接框反推特征尺度，保证任意旋转不裁切 */
export function sizeFromFrame(
  frame: number,
  halfExtent: number,
  pad = FRAME_PAD,
) {
  return Math.max(8, (frame - pad) / (2 * halfExtent))
}

export const DIM_SIZE = {
  d2: Math.max(8, framePx('d2') - 4),
  d3: sizeFromFrame(framePx('d3'), DIM_HALF_EXTENT.cube),
  d4: sizeFromFrame(framePx('d4'), DIM_HALF_EXTENT.hypercube),
  d5: sizeFromFrame(framePx('d5'), DIM_HALF_EXTENT.penteract),
} as const

export function cubeFrameSize(size: number) {
  return Math.ceil(size * 2 * DIM_HALF_EXTENT.cube + FRAME_PAD)
}

export function hypercubeFrameSize(size: number) {
  return Math.ceil(size * 2 * DIM_HALF_EXTENT.hypercube + FRAME_PAD)
}

export function penteractFrameSize(size: number) {
  return Math.ceil(size * 2 * DIM_HALF_EXTENT.penteract + FRAME_PAD)
}
