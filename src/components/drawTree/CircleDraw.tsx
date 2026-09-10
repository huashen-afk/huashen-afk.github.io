import { useEffect, useId, useRef } from 'react'
import { DRAW_SPEED, STROKE, useDrawGate, useRegisterCanvas } from './sceneRegistry'

interface CircleDrawProps {
  /** 半径（px） */
  radius?: number
  /** 是否顺时针绘制，默认 true */
  clockwise?: boolean
  /** 本组件绘制 id，供其他组件 after 引用 */
  drawId?: string
  /** 前驱 drawId；省略则立即按默认逻辑绘制 */
  after?: string
}

export function CircleDraw({
  radius = 48,
  clockwise = true,
  drawId,
  after,
}: CircleDrawProps) {
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawnRef = useRef(0)
  const { canDrawRef, notifyComplete } = useDrawGate(drawId, after)
  useRegisterCanvas(id, canvasRef)

  const r = Math.max(1, radius)
  const size = r * 2
  const circumference = 2 * Math.PI * r

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawnRef.current = 0
    let frame = 0
    let running = true
    let last = performance.now()

    function tick(now: number) {
      if (!running || !canvas) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== Math.floor(size * dpr) || canvas.height !== Math.floor(size * dpr)) {
        canvas.width = Math.floor(size * dpr)
        canvas.height = Math.floor(size * dpr)
        canvas.style.width = `${size}px`
        canvas.style.height = `${size}px`
      }

      const rect = canvas.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isVisible =
        rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh

      if (canDrawRef.current && isVisible && drawnRef.current < circumference) {
        drawnRef.current = Math.min(circumference, drawnRef.current + DRAW_SPEED * dt)
      }

      if (drawnRef.current >= circumference) notifyComplete()

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, size, size)
        const progress = drawnRef.current / circumference
        const start = -Math.PI / 2
        const delta = progress * Math.PI * 2
        const end = clockwise ? start + delta : start - delta
        ctx.strokeStyle = STROKE
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(r, r, r - 0.5, start, end, !clockwise)
        ctx.stroke()
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [r, size, circumference, clockwise, canDrawRef, notifyComplete])

  return <canvas ref={canvasRef} className="circledraw-canvas" aria-hidden />
}
