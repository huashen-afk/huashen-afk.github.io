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

const pointer = { x: 0, y: 0 }
let pointerUsers = 0

function onGlobalPointerMove(e: PointerEvent) {
  pointer.x = e.clientX
  pointer.y = e.clientY
}

function acquirePointerTracking() {
  if (pointerUsers === 0) {
    window.addEventListener('pointermove', onGlobalPointerMove, { passive: true })
  }
  pointerUsers += 1
  return () => {
    pointerUsers -= 1
    if (pointerUsers <= 0) {
      pointerUsers = 0
      window.removeEventListener('pointermove', onGlobalPointerMove)
    }
  }
}

/**
 * 跟随鼠标旋转。factor 默认 0 不跟随；>0 时开启，旋转角 = 鼠标方位角 × factor。
 */
export function useFollowRotate(factor = 0) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const angleRef = useRef(0)
  const amount = Math.max(0, factor)

  useEffect(() => {
    const el = wrapRef.current
    if (!(amount > 0)) {
      if (el) el.style.transform = ''
      return
    }

    const release = acquirePointerTracking()
    let frame = 0
    let running = true

    function tick() {
      if (!running) return
      const node = wrapRef.current
      if (node) {
        const rect = node.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const target = (Math.atan2(pointer.y - cy, pointer.x - cx) * 180) / Math.PI
        const cur = angleRef.current
        const delta = ((((target - cur) % 360) + 540) % 360) - 180
        const next = cur + delta * 0.12
        angleRef.current = next
        node.style.transform = `rotate(${next * amount}deg)`
      }
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
      release()
      if (wrapRef.current) wrapRef.current.style.transform = ''
    }
  }, [amount])

  return wrapRef
}

export const STROKE = '#d8d2c8'
export const DRAW_SPEED = 240
