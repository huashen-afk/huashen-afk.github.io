import { useEffect, useRef } from 'react'

const PARTICLE_COLOR = '#f4f1ea'
const SPRING = 0.022 // 弹力
const FRICTION = 0.93 // 摩擦力
const REPEL_RADIUS = 450 // 排斥半径
const REPEL_STRENGTH = 4 // 排斥强度
const DROP_RATE = 0.35 // 随机缺失占比
const JITTER_RATE = 0.2 // 抖动采样占比
const JITTER_BASE_MS = 1000
const JITTER_EXTRA_MS = 500
const JITTER_CELLS = 0.4
const CARDINAL = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },//方向矢量
]
const JITTER_PHASE = {
  idle: 0,
  out: 1,
} as const

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  homeX: number
  homeY: number
  baseX: number
  baseY: number
  size: number
  cellSize: number
  dirX: number
  dirY: number
  phase: number
  phaseStart: number
  phaseDuration: number
  canJitter: boolean
}

interface SamplePoint {
  x: number
  y: number
}

const ANGULAR_H = [
  [
    { x: 0, y: 3.3 },
    { x: 0, y: 2.4 },
  ],
  [
    { x: 2, y: 3.3 },
    { x: 2, y: 2.7 },
  ],
  [
    { x: 0, y: 0.8 },
    { x: 0, y: 0 },
  ],
  [
    { x: 2, y: 1.2 },
    { x: 2, y: 0 },
  ],
]

const ANGULAR_H_SLASH = [
  [
    { x: 0.0, y: 2.05 },
    { x: 2.0, y: 1.45 },
  ],
]

const ANGULAR_H_TRIANGLES = [
  [
    { x: 2.65, y: 2.3 },//上三角
    { x: 1.3, y: 2.3 },//下三角
    { x: 2.65, y: 1.9 },//右三角
  ],
  [
    { x: -0.65, y: 1.2 },
    { x: 0.7, y: 1.2 },
    { x: -0.65, y: 1.6 },
  ],
]

const ANGULAR_S = [
  [
    { x: 0, y: 3 },
    { x: 1, y: 4 },
    { x: 2, y: 3 },
  ],
  [
    { x: 0, y: 3 },
    { x: 2, y: 1 },
  ],
  [
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 2, y: 1 },
  ],
]

function drawAngularGlyph(
  ctx: CanvasRenderingContext2D,
  segments: { x: number; y: number }[][],
  originX: number,
  originY: number,
  unitX: number,
  unitY: number,
  lineWidth: number,
) {
  ctx.save()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'square'
  ctx.lineJoin = 'miter'
  ctx.miterLimit = 2
  for (const segment of segments) {
    ctx.beginPath()
    segment.forEach((point, index) => {
      const x = originX + point.x * unitX
      const y = originY + (4 - point.y) * unitY
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }
  ctx.restore()
}

function fillAngularGlyph(
  ctx: CanvasRenderingContext2D,
  polygons: { x: number; y: number }[][],
  originX: number,
  originY: number,
  unitX: number,
  unitY: number,
) {
  ctx.save()
  ctx.fillStyle = '#fff'
  for (const polygon of polygons) {
    ctx.beginPath()
    polygon.forEach((point, index) => {
      const x = originX + point.x * unitX
      const y = originY + (4 - point.y) * unitY
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawHsMask(
  ctx: CanvasRenderingContext2D,
  layerWidth: number,
  layerHeight: number,
  width: number,
  height: number,
  dpr: number,
) {
  const glyphHeight = Math.min(width * 0.42, height * 0.48) * dpr
  const unit = glyphHeight / 4
  const glyphWidth = unit * 1.2
  const sUnit = glyphWidth / 2
  const sHeight = sUnit * 4
  const gap = unit * 1.3
  const startX = (layerWidth - (glyphWidth + gap + glyphWidth)) / 2
  const originY = (layerHeight - glyphHeight) / 2
  const sOriginY = originY + glyphHeight - sHeight
  const strokeWidth = Math.max(2 * (layerWidth / Math.max(width, 1)), glyphHeight * 0.2)

  ctx.clearRect(0, 0, layerWidth, layerHeight)
  drawAngularGlyph(ctx, ANGULAR_H, startX, originY, sUnit, unit, strokeWidth)
  drawAngularGlyph(ctx, ANGULAR_H_SLASH, startX, originY, sUnit, unit, strokeWidth * 0.55)
  fillAngularGlyph(ctx, ANGULAR_H_TRIANGLES, startX, originY, sUnit, unit)
  drawAngularGlyph(ctx, ANGULAR_S, startX + glyphWidth + gap, sOriginY, sUnit, sUnit, strokeWidth * 0.7)
}

function nextJitterDuration(): number {
  return JITTER_BASE_MS + Math.random() * JITTER_EXTRA_MS
}

function pickCardinal(): { x: number; y: number } {
  return CARDINAL[Math.floor(Math.random() * CARDINAL.length)]
}

function updateJitter(particle: Particle, now: number) {
  let elapsed = now - particle.phaseStart

  while (elapsed >= particle.phaseDuration) {
    elapsed -= particle.phaseDuration
    if (particle.phase === JITTER_PHASE.idle) {
      const direction = pickCardinal()
      particle.dirX = direction.x
      particle.dirY = direction.y
      particle.phase = JITTER_PHASE.out
    } else {
      particle.phase = JITTER_PHASE.idle
      particle.dirX = 0
      particle.dirY = 0
      particle.phaseDuration = nextJitterDuration()
    }
    particle.phaseStart = now - elapsed
  }

  const amount = particle.phase === JITTER_PHASE.out ? 1 : 0
  const offset = JITTER_CELLS * particle.cellSize
  const nextHomeX = particle.baseX + particle.dirX * offset * amount
  const nextHomeY = particle.baseY + particle.dirY * offset * amount
  particle.x += nextHomeX - particle.homeX
  particle.y += nextHomeY - particle.homeY
  particle.homeX = nextHomeX
  particle.homeY = nextHomeY
}

function sampleHsGrid(width: number, height: number, dpr: number, cellSize: number): SamplePoint[] {
  const layer = document.createElement('canvas')
  layer.width = Math.max(1, Math.floor(width * dpr))
  layer.height = Math.max(1, Math.floor(height * dpr))
  const ctx = layer.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []

  drawHsMask(ctx, layer.width, layer.height, width, height, dpr)
  const image = ctx.getImageData(0, 0, layer.width, layer.height).data
  const points: SamplePoint[] = []
  const half = cellSize / 2

  for (let y = half; y < height; y += cellSize) {
    for (let x = half; x < width; x += cellSize) {
      const px = Math.min(layer.width - 1, Math.max(0, Math.floor(x * dpr)))
      const py = Math.min(layer.height - 1, Math.max(0, Math.floor(y * dpr)))
      const alpha = image[(py * layer.width + px) * 4 + 3]
      if (alpha > 80) {
        points.push({ x, y })
      }
    }
  }

  return points
}

export function HsParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const view = canvas
    const brush = ctx

    const mouse = { x: 0, y: 0, active: false }
    let particles: Particle[] = []
    let frame = 0
    let running = true

    function syncCanvasSize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = window.innerWidth
      const height = window.innerHeight
      view.width = Math.floor(width * dpr)
      view.height = Math.floor(height * dpr)
      view.style.width = `${width}px`
      view.style.height = `${height}px`
      brush.setTransform(dpr, 0, 0, dpr, 0, 0)

      const size = Math.max(2, Math.round(Math.min(width, height) * 0.0026))
      const cellSize = size * 1.6
      const homes = sampleHsGrid(width, height, dpr, cellSize).filter(
        () => Math.random() >= DROP_RATE,
      )
      const now = performance.now()
      particles = homes.map((point) => {
        const duration = nextJitterDuration()
        return {
          x: point.x,
          y: point.y,
          vx: 0,
          vy: 0,
          homeX: point.x,
          homeY: point.y,
          baseX: point.x,
          baseY: point.y,
          size,
          cellSize,
          dirX: 0,
          dirY: 0,
          phase: JITTER_PHASE.idle,
          phaseStart: now - Math.random() * duration,
          phaseDuration: duration,
          canJitter: Math.random() < JITTER_RATE,
        }
      })
    }

    function drawFrame() {
      if (!running) return
      const width = window.innerWidth
      const height = window.innerHeight
      const now = performance.now()
      brush.clearRect(0, 0, width, height)
      brush.fillStyle = PARTICLE_COLOR

      for (const particle of particles) {
        if (particle.canJitter) {
          updateJitter(particle, now)
        }
        if (mouse.active) {
          const dx = particle.x - mouse.x
          const dy = particle.y - mouse.y
          const dist = Math.hypot(dx, dy) || 0.001
          if (dist < REPEL_RADIUS) {
            const falloff = 1 - dist / REPEL_RADIUS
            const force = falloff * falloff * REPEL_STRENGTH
            particle.vx += (dx / dist) * force
            particle.vy += (dy / dist) * force
          }
        }

        particle.vx += (particle.homeX - particle.x) * SPRING
        particle.vy += (particle.homeY - particle.y) * SPRING
        particle.vx *= FRICTION
        particle.vy *= FRICTION
        particle.x += particle.vx
        particle.y += particle.vy

        const half = particle.size / 2
        brush.fillRect(particle.x - half, particle.y - half, particle.size, particle.size)
      }

      frame = window.requestAnimationFrame(drawFrame)
    }

    function handlePointerMove(event: PointerEvent) {
      mouse.x = event.clientX
      mouse.y = event.clientY
      mouse.active = true
    }

    function handlePointerLeave() {
      mouse.active = false
    }

    syncCanvasSize()
    frame = window.requestAnimationFrame(drawFrame)
    window.addEventListener('resize', syncCanvasSize)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      running = false
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', syncCanvasSize)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="hs-canvas" aria-label="Hs" />
}
