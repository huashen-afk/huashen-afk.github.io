import { useEffect, type RefObject } from 'react'

export interface SceneLayer {
  id: string
  canvas: HTMLCanvasElement
}

const layers = new Map<string, SceneLayer>()

export function registerSceneLayer(id: string, canvas: HTMLCanvasElement) {
  layers.set(id, { id, canvas })
  return () => {
    const cur = layers.get(id)
    if (cur?.canvas === canvas) layers.delete(id)
  }
}

export function forEachSceneLayer(fn: (layer: SceneLayer) => void) {
  layers.forEach(fn)
}

export function useRegisterCanvas(
  id: string,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return registerSceneLayer(id, canvas)
  }, [id, canvasRef])
}

export const STROKE = '#d8d2c8'
export const DRAW_SPEED = 240
