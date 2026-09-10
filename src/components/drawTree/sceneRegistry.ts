import { useCallback, useEffect, useRef, type RefObject } from 'react'

export interface SceneLayer {
  id: string
  canvas: HTMLCanvasElement
}

const layers = new Map<string, SceneLayer>()
const drawComplete = new Set<string>()
const drawListeners = new Map<string, Set<() => void>>()

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

export function isDrawComplete(drawId: string) {
  return drawComplete.has(drawId)
}

export function markDrawComplete(drawId: string) {
  if (drawComplete.has(drawId)) return
  drawComplete.add(drawId)
  const set = drawListeners.get(drawId)
  if (!set) return
  for (const cb of [...set]) cb()
}

export function clearDrawComplete(drawId: string) {
  drawComplete.delete(drawId)
}

export function subscribeDrawComplete(drawId: string, cb: () => void) {
  let set = drawListeners.get(drawId)
  if (!set) {
    set = new Set()
    drawListeners.set(drawId, set)
  }
  set.add(cb)
  return () => {
    set!.delete(cb)
    if (set!.size === 0) drawListeners.delete(drawId)
  }
}

/** 可选绘制前驱：未传 after 时立即允许绘制 */
export function useDrawGate(drawId?: string, after?: string) {
  const canDrawRef = useRef(!after)
  const notifiedRef = useRef(false)

  useEffect(() => {
    notifiedRef.current = false
    if (!after) {
      canDrawRef.current = true
      return
    }
    if (isDrawComplete(after)) {
      canDrawRef.current = true
      return
    }
    canDrawRef.current = false
    return subscribeDrawComplete(after, () => {
      canDrawRef.current = true
    })
  }, [after])

  useEffect(() => {
    if (!drawId) return
    clearDrawComplete(drawId)
    return () => clearDrawComplete(drawId)
  }, [drawId])

  const notifyComplete = useCallback(() => {
    if (!drawId || notifiedRef.current) return
    notifiedRef.current = true
    markDrawComplete(drawId)
  }, [drawId])

  return { canDrawRef, notifyComplete }
}

export const STROKE = '#d8d2c8'
export const DRAW_SPEED = 240
