import type { ComponentType } from 'react'
import { LineDraw } from '../LineDraw'
import { CircleDraw } from '../CircleDraw'
import { RhombusDraw } from '../RhombusDraw'
import { TriangleDraw } from '../TriangleDraw'
import { CurveDraw } from '../CurveDraw'
import { CubeDraw } from '../superCubeDraw/CubeDraw'
import { HypercubeDraw } from '../superCubeDraw/HypercubeDraw'
import { PenteractDraw } from '../superCubeDraw/PenteractDraw'

export type DrawKind =
  | 'line'
  | 'circle'
  | 'rhombus'
  | 'triangle'
  | 'curve'
  | 'cube'
  | 'hypercube'
  | 'penteract'

export interface DrawItem {
  id: string
  type: DrawKind
  /** 画布局部坐标 px */
  x: number
  y: number
  props: Record<string, unknown>
}

export interface DrawScene {
  version: 1
  updatedAt: string
  items: DrawItem[]
}

interface CatalogEntry {
  type: DrawKind
  label: string
  Component: ComponentType<Record<string, unknown>>
  defaults: Record<string, unknown>
}

export const DRAW_CATALOG: CatalogEntry[] = [
  {
    type: 'line',
    label: '线段',
    Component: LineDraw as ComponentType<Record<string, unknown>>,
    defaults: { length: 48, rotation: 0, followRotate: 0 },
  },
  {
    type: 'circle',
    label: '圆',
    Component: CircleDraw as ComponentType<Record<string, unknown>>,
    defaults: { radius: 32, clockwise: true, followRotate: 0 },
  },
  {
    type: 'rhombus',
    label: '菱形',
    Component: RhombusDraw as ComponentType<Record<string, unknown>>,
    defaults: { side: 16, minAngle: 60, rotation: 0, followRotate: 0, instant: true },
  },
  {
    type: 'triangle',
    label: '三角',
    Component: TriangleDraw as ComponentType<Record<string, unknown>>,
    defaults: {
      angles: [60, 60],
      sides: [40, 40, 40],
      rotation: 0,
      followRotate: 0,
    },
  },
  {
    type: 'curve',
    label: '曲线',
    Component: CurveDraw as ComponentType<Record<string, unknown>>,
    defaults: {
      from: { x: 0, y: 0 },
      to: { x: 48, y: 24 },
      curvature: 18,
      bendAt: 0.5,
      followRotate: 0,
    },
  },
  {
    type: 'cube',
    label: '立方体',
    Component: CubeDraw as ComponentType<Record<string, unknown>>,
    defaults: { size: 40, followRotate: 0, instant: true },
  },
  {
    type: 'hypercube',
    label: '超立方',
    Component: HypercubeDraw as ComponentType<Record<string, unknown>>,
    defaults: { size: 36, followRotate: 0, instant: true },
  },
  {
    type: 'penteract',
    label: '五维',
    Component: PenteractDraw as ComponentType<Record<string, unknown>>,
    defaults: { size: 28, followRotate: 0, instant: true },
  },
]

export function getCatalog(type: DrawKind) {
  return DRAW_CATALOG.find((c) => c.type === type)
}

export function createDrawItem(type: DrawKind, x: number, y: number): DrawItem {
  const cat = getCatalog(type)!
  return {
    id: `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    x,
    y,
    props: { ...cat.defaults },
  }
}

export const EMPTY_SCENE: DrawScene = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  items: [],
}

export const SCENE_STORAGE_KEY = 'drawBoard.scene.v1'
export const SCENE_FILE = 'src/components/drawTree/drawBoard/drawBoard.scene.json'
