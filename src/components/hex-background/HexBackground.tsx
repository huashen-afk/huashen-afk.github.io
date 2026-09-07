import { useEffect, useRef } from 'react'

const HEX_SIDE = 64//六边形边长
const STROKE = '#ffffff'//线颜色
const SQRT3 = Math.sqrt(3)//平方根3
const SPOT_RADIUS = 64//焦点半径

function axialToPixel(q: number, r: number, side: number) {
  const x = side * (1.5 * q)
  const y = side * ((SQRT3 / 2) * q + SQRT3 * r)
  return { x, y }
}

function drawFlatHex(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  side: number,
) {
  const dx = side
  const dy = (SQRT3 / 2) * side
  ctx.beginPath()
  ctx.moveTo(cx + dx, cy)
  ctx.lineTo(cx + dx / 2, cy + dy)
  ctx.lineTo(cx - dx / 2, cy + dy)
  ctx.lineTo(cx - dx, cy)
  ctx.lineTo(cx - dx / 2, cy - dy)
  ctx.lineTo(cx + dx / 2, cy - dy)
  ctx.closePath()
  ctx.stroke()
}

export function HexBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function paint() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = window.innerWidth
      const height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const side = HEX_SIDE
      const originX = side
      const originY = side * SQRT3
      const qMin = Math.floor((-originX - side * 2) / (side * 1.5)) - 1
      const qMax = Math.ceil((width - originX + side * 2) / (side * 1.5)) + 1

      ctx.strokeStyle = STROKE
      ctx.lineWidth = 1
      ctx.lineJoin = 'miter'
      ctx.lineCap = 'square'

      for (let q = qMin; q <= qMax; q += 1) {
        const yBase = (SQRT3 / 2) * q
        const rMin = Math.floor((-originY / side - yBase) / SQRT3) - 1
        const rMax = Math.ceil(((height - originY) / side - yBase) / SQRT3) + 1
        for (let r = rMin; r <= rMax; r += 1) {
          const { x, y } = axialToPixel(q, r, side)
          drawFlatHex(ctx, originX + x, originY + y, side)
        }
      }
    }

    paint()
    window.addEventListener('resize', paint)

    function handlePointerMove(event: PointerEvent) {
      canvas.style.setProperty('--mx', `${event.clientX}px`)
      canvas.style.setProperty('--my', `${event.clientY}px`)
      canvas.dataset.active = 'true'
    }

    function handlePointerLeave() {
      canvas.dataset.active = 'false'
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      window.removeEventListener('resize', paint)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="hex-bg"
      aria-hidden="true"
      style={{ ['--spot-radius' as string]: `${SPOT_RADIUS}px` }}
    />
  )
}
