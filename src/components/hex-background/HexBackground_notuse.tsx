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

export function HexBackground_notuse() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const view = canvas
    const brush = ctx

    function paint() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = window.innerWidth
      const height = window.innerHeight
      view.width = Math.floor(width * dpr)
      view.height = Math.floor(height * dpr)
      view.style.width = `${width}px`
      view.style.height = `${height}px`
      brush.setTransform(dpr, 0, 0, dpr, 0, 0)
      brush.clearRect(0, 0, width, height)

      const side = HEX_SIDE
      const originX = side
      const originY = side * SQRT3
      const qMin = Math.floor((-originX - side * 2) / (side * 1.5)) - 1
      const qMax = Math.ceil((width - originX + side * 2) / (side * 1.5)) + 1

      brush.strokeStyle = STROKE
      brush.lineWidth = 1
      brush.lineJoin = 'miter'
      brush.lineCap = 'square'

      for (let q = qMin; q <= qMax; q += 1) {
        const yBase = (SQRT3 / 2) * q
        const rMin = Math.floor((-originY / side - yBase) / SQRT3) - 1
        const rMax = Math.ceil(((height - originY) / side - yBase) / SQRT3) + 1
        for (let r = rMin; r <= rMax; r += 1) {
          const { x, y } = axialToPixel(q, r, side)
          drawFlatHex(brush, originX + x, originY + y, side)
        }
      }
    }

    paint()
    window.addEventListener('resize', paint)

    function handlePointerMove(event: PointerEvent) {
      view.style.setProperty('--mx', `${event.clientX}px`)
      view.style.setProperty('--my', `${event.clientY}px`)
      view.dataset.active = 'true'
    }

    function handlePointerLeave() {
      view.dataset.active = 'false'
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
