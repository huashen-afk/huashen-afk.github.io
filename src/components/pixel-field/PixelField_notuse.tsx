import { useEffect, useRef } from 'react'

const PARTICLE_COLOR = '#f4f1ea'
const FOLLOW = 0.72//跟随系数
const SNAP = 1.6//捕捉距离
const FIELD_COUNT = 3200//粒子数量
const POINTS_PER_CHAR = 150//每个字符的粒子数量
const SCAN_BLOCK = 4//每块边长（格）
const JITTER_RATE = 0.2//抖动率
const JITTER_BASE_MS = 1000//抖动基础时间
const JITTER_EXTRA_MS = 500//抖动额外时间
const JITTER_CELLS = 0.4//抖动单元格大小
const LEAVE_Y = 48
const WRAP_OUT = 24
const WRAP_INSET = 36
const WRAP_COOL_MS = 260
const MIN_BAND = 48
const CARDINAL = [
  { x: 1, y: 0 },//上
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]
const JITTER_PHASE = {
  idle: 0,
  out: 1,
} as const

interface FieldParticle {
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
  slot: number
  wrapCoolUntil: number
}

interface SamplePoint {
  x: number
  y: number
}

function nextJitterDuration(): number {
  return JITTER_BASE_MS + Math.random() * JITTER_EXTRA_MS
}

function pickCardinal(): { x: number; y: number } {
  return CARDINAL[Math.floor(Math.random() * CARDINAL.length)]
}

function seekHome(particle: FieldParticle) {
  const dx = particle.homeX - particle.x
  const dy = particle.homeY - particle.y
  if (Math.hypot(dx, dy) < SNAP) {
    particle.x = particle.homeX
    particle.y = particle.homeY
    particle.vx = 0
    particle.vy = 0
    return
  }
  particle.x += dx * FOLLOW
  particle.y += dy * FOLLOW
}

function updateJitter(particle: FieldParticle, now: number) {
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

function scatterPoint(width: number, height: number, pad: number): SamplePoint {
  return {
    x: pad + Math.random() * Math.max(1, width - pad * 2),
    y: pad + Math.random() * Math.max(1, height - pad * 2),
  }
}

function placeParticle(particle: FieldParticle, x: number, y: number) {
  particle.x = x
  particle.y = y
  particle.homeX = x
  particle.homeY = y
  particle.baseX = x
  particle.baseY = y
  particle.vx = 0
  particle.vy = 0
}

function wrapFromOpposite(
  particle: FieldParticle,
  width: number,
  height: number,
  size: number,
  bandHeight: number,
  now: number,
): boolean {
  if (now < particle.wrapCoolUntil) return false
  const pad = Math.max(2, size)
  const inset = Math.max(pad, WRAP_INSET)
  const innerW = Math.max(1, width - inset * 2)
  const innerH = Math.max(1, height - inset * 2)
  const leave = Math.max(pad * 4, WRAP_OUT)
  const span = Math.max(pad, Math.min(bandHeight, height - inset * 2))

  function spawnInBand(bandTop: number) {
    const top = Math.min(height - inset - span, Math.max(inset, bandTop))
    placeParticle(particle, inset + Math.random() * innerW, top + Math.random() * span)
    particle.wrapCoolUntil = now + WRAP_COOL_MS
  }

  if (particle.y < -leave) {
    spawnInBand(height - inset - span)
    return true
  }
  if (particle.y > height + leave) {
    spawnInBand(inset)
    return true
  }
  if (particle.x < -leave) {
    placeParticle(particle, width - inset, inset + Math.random() * innerH)
    particle.wrapCoolUntil = now + WRAP_COOL_MS
    return true
  }
  if (particle.x > width + leave) {
    placeParticle(particle, inset, inset + Math.random() * innerH)
    particle.wrapCoolUntil = now + WRAP_COOL_MS
    return true
  }
  return false
}

function pickEven(points: SamplePoint[], count: number): SamplePoint[] {
  if (points.length <= count) return points
  const picked: SamplePoint[] = []
  const step = points.length / count
  for (let index = 0; index < count; index += 1) {
    picked.push(points[Math.min(points.length - 1, Math.floor(index * step))])
  }
  return picked
}

function scanBlockSpan(cellSize: number): number {
  return Math.max(1, cellSize) * SCAN_BLOCK
}

function scanBlockKey(point: SamplePoint, span: number): string {
  return `${Math.floor(point.y / span)}:${Math.floor(point.x / span)}`
}

function sortInScanBlocks(points: SamplePoint[], cellSize: number): SamplePoint[] {
  const span = scanBlockSpan(cellSize)
  return [...points].sort((a, b) => {
    const aCol = Math.floor(a.x / span)
    const aRow = Math.floor(a.y / span)
    const bCol = Math.floor(b.x / span)
    const bRow = Math.floor(b.y / span)
    if (aRow !== bRow) return aRow - bRow
    if (aCol !== bCol) return aCol - bCol
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })
}

function sampleGlyphLocals(el: HTMLElement): SamplePoint[] {
  const text = (el.textContent ?? '').replace(/\s+/g, '')
  if (!text) return []
  const style = getComputedStyle(el)
  const fontSize = Math.max(1, parseFloat(style.fontSize) || 40)
  const font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`
  const rect = el.getBoundingClientRect()
  const yOff = Math.max(0, (rect.height - fontSize) / 2)
  const dpr = 2
  const layer = document.createElement('canvas')
  const ctx = layer.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []

  const points: SamplePoint[] = []
  let cursorX = 0
  ctx.font = font
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  for (const char of text) {
    const charWidth = Math.max(1, Math.ceil(ctx.measureText(char).width))
    const charHeight = Math.ceil(fontSize * 1.3)
    layer.width = Math.max(1, Math.floor(charWidth * dpr))
    layer.height = Math.max(1, Math.floor(charHeight * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, charWidth, charHeight)
    ctx.font = font
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.fillText(char, 0, 0)
    const image = ctx.getImageData(0, 0, layer.width, layer.height).data
    const hits: SamplePoint[] = []
    const stride = Math.max(1, Math.floor(dpr))
    for (let py = 0; py < layer.height; py += stride) {
      for (let px = 0; px < layer.width; px += stride) {
        if (image[(py * layer.width + px) * 4 + 3] > 80) {
          hits.push({
            x: cursorX + px / dpr,
            y: yOff + py / dpr,
          })
        }
      }
    }
    points.push(...pickEven(hits, POINTS_PER_CHAR))
    cursorX += charWidth
  }
  return points
}

function isIncoming(rect: DOMRect, height: number): boolean {
  return rect.bottom > 0 && rect.top < height
}

function findIncomingTarget(height: number): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>('[data-pixel-target]')
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    if (isIncoming(rect, height)) return node
  }
  return null
}

export function PixelField_notuse() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const view = canvas
    const brush = ctx

    let particles: FieldParticle[] = []
    let viewWidth = 0
    let viewHeight = 0
    let lastScrollY = window.scrollY
    let boundTarget: HTMLElement | null = null
    let targetLocals: SamplePoint[] = []
    let frame = 0
    let running = true

    function makeParticle(
      x: number,
      y: number,
      size: number,
      cellSize: number,
      now: number,
    ): FieldParticle {
      const duration = nextJitterDuration()
      return {
        x,
        y,
        vx: 0,
        vy: 0,
        homeX: x,
        homeY: y,
        baseX: x,
        baseY: y,
        size,
        cellSize,
        dirX: 0,
        dirY: 0,
        phase: JITTER_PHASE.idle,
        phaseStart: now - Math.random() * duration,
        phaseDuration: duration,
        canJitter: Math.random() < JITTER_RATE,
        slot: -1,
        wrapCoolUntil: now + WRAP_COOL_MS,
      }
    }

    function spawnField(width: number, height: number) {
      const size = Math.max(2, Math.round(Math.min(width, height) * 0.0026))
      const cellSize = size * 1.6
      const pad = 12
      const now = performance.now()
      particles = Array.from({ length: FIELD_COUNT }, () => {
        const point = scatterPoint(width, height, pad)
        const particle = makeParticle(point.x, point.y, size, cellSize, now)
        particle.wrapCoolUntil = 0
        return particle
      })
    }

    function oppositeBandPoint(
      width: number,
      height: number,
      deltaY: number,
      size: number,
    ): SamplePoint {
      const pad = Math.max(2, size)
      const inset = Math.max(pad, WRAP_INSET)
      const innerW = Math.max(1, width - inset * 2)
      const bandHeight = Math.max(MIN_BAND, Math.abs(deltaY) || MIN_BAND)
      const span = Math.max(pad, Math.min(bandHeight, height - inset * 2))
      const bandTop = deltaY >= 0 ? height - inset - span : inset
      const top = Math.min(height - inset - span, Math.max(inset, bandTop))
      return {
        x: inset + Math.random() * innerW,
        y: top + Math.random() * span,
      }
    }

    function syncPool(width: number, height: number, deltaY: number, now: number) {
      let locked = 0
      for (const particle of particles) {
        if (particle.slot >= 0) locked += 1
      }
      const desired = FIELD_COUNT + locked
      const size = particles[0]?.size ?? Math.max(2, Math.round(Math.min(width, height) * 0.0026))
      const cellSize = particles[0]?.cellSize ?? size * 1.6

      while (particles.length < desired) {
        const point = oppositeBandPoint(width, height, deltaY, size)
        particles.push(makeParticle(point.x, point.y, size, cellSize, now))
      }

      while (particles.length > desired) {
        let index = -1
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          if (particles[i].slot < 0) {
            index = i
            break
          }
        }
        if (index < 0) break
        particles.splice(index, 1)
      }
    }

    function syncCanvasSize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = window.innerWidth
      const height = window.innerHeight
      viewWidth = width
      viewHeight = height
      view.width = Math.floor(width * dpr)
      view.height = Math.floor(height * dpr)
      view.style.width = `${width}px`
      view.style.height = `${height}px`
      brush.setTransform(dpr, 0, 0, dpr, 0, 0)
      boundTarget = null
      targetLocals = []
      lastScrollY = window.scrollY
      spawnField(width, height)
    }

    function releaseParticle(
      particle: FieldParticle,
      width: number,
      height: number,
      deltaY: number,
      now: number,
    ) {
      particle.slot = -1
      particle.dirX = 0
      particle.dirY = 0
      particle.phase = JITTER_PHASE.idle
      const point = oppositeBandPoint(width, height, deltaY, particle.size)
      placeParticle(particle, point.x, point.y)
      particle.wrapCoolUntil = now + WRAP_COOL_MS
    }

    function samplesFor(target: HTMLElement): SamplePoint[] {
      if (boundTarget !== target || targetLocals.length === 0) {
        const cellSize = particles[0]?.cellSize ?? 4
        targetLocals = sortInScanBlocks(sampleGlyphLocals(target), cellSize)
      }
      const rect = target.getBoundingClientRect()
      return targetLocals.map((point) => ({
        x: rect.left + point.x,
        y: rect.top + point.y,
      }))
    }

    function isSampleVisible(sample: SamplePoint, width: number, height: number): boolean {
      return sample.x >= 0 && sample.x <= width && sample.y >= 0 && sample.y <= height
    }

    function bindParticle(particle: FieldParticle, sample: SamplePoint, slot: number) {
      particle.slot = slot
      particle.homeX = sample.x
      particle.homeY = sample.y
      particle.baseX = sample.x
      particle.baseY = sample.y
      particle.dirX = 0
      particle.dirY = 0
      particle.phase = JITTER_PHASE.idle
    }

    function captureLeaving(
      target: HTMLElement,
      width: number,
      height: number,
      deltaY: number,
      now: number,
    ) {
      const samples = samplesFor(target)
      const rect = target.getBoundingClientRect()
      const goingDown = deltaY >= 0
      const span = scanBlockSpan(particles[0]?.cellSize ?? 4)
      const used = new Set<number>()
      for (const particle of particles) {
        if (particle.slot >= 0) used.add(particle.slot)
      }

      let head = -1
      for (let slot = 0; slot < samples.length; slot += 1) {
        if (used.has(slot)) continue
        if (!isSampleVisible(samples[slot], width, height)) continue
        head = slot
        break
      }
      if (head < 0) return

      const key = scanBlockKey(targetLocals[head], span)
      const blockSlots: number[] = []
      for (let slot = 0; slot < samples.length; slot += 1) {
        if (used.has(slot)) continue
        if (!isSampleVisible(samples[slot], width, height)) continue
        if (scanBlockKey(targetLocals[slot], span) !== key) continue
        blockSlots.push(slot)
      }

      const free = particles.filter((particle) => {
        if (particle.slot >= 0) return false
        if (now < particle.wrapCoolUntil) return false
        if (particle.y < 0 || particle.y > height) return false
        if (particle.y > rect.bottom + 8) return false
        return true
      })
      const leaving = free
        .filter((particle) => {
          if (goingDown) return particle.y < Math.max(LEAVE_Y, rect.top)
          return particle.y > Math.min(height - LEAVE_Y, rect.bottom)
        })
        .sort((a, b) => (goingDown ? a.y - b.y : b.y - a.y))
      const leavingSet = new Set(leaving)
      const rest = free
        .filter((particle) => !leavingSet.has(particle))
        .sort(
          (a, b) =>
            Math.hypot(a.x - rect.left, a.y - rect.top) -
            Math.hypot(b.x - rect.left, b.y - rect.top),
        )
      const queue = [...leaving, ...rest]
      const fill = Math.min(blockSlots.length, queue.length)
      for (let index = 0; index < fill; index += 1) {
        bindParticle(queue[index], samples[blockSlots[index]], blockSlots[index])
      }
    }

    function followTarget(
      target: HTMLElement,
      width: number,
      height: number,
      deltaY: number,
      now: number,
    ) {
      const rect = target.getBoundingClientRect()
      if (rect.bottom < -80 || rect.top > height + 80) {
        boundTarget = null
        targetLocals = []
        for (const particle of particles) {
          if (particle.slot >= 0) releaseParticle(particle, width, height, deltaY, now)
        }
        return
      }
      const samples = samplesFor(target)
      for (const particle of particles) {
        if (particle.slot < 0) continue
        const sample = samples[particle.slot]
        if (!sample || !isSampleVisible(sample, width, height)) {
          releaseParticle(particle, width, height, deltaY, now)
          continue
        }
        particle.homeX = sample.x
        particle.homeY = sample.y
        particle.baseX = sample.x
        particle.baseY = sample.y
      }
    }

    function wrapField(width: number, height: number, deltaY: number, now: number) {
      const bandHeight = Math.max(MIN_BAND, Math.abs(deltaY) || MIN_BAND)
      for (const particle of particles) {
        if (particle.slot >= 0) continue
        wrapFromOpposite(
          particle,
          width,
          height,
          particle.size,
          bandHeight,
          now,
        )
      }
    }

    function wrapOrAssemble(width: number, height: number, deltaY: number, now: number) {
      const incoming = findIncomingTarget(height)
      if (incoming) boundTarget = incoming
      wrapField(width, height, deltaY, now)
      if (boundTarget) {
        followTarget(boundTarget, width, height, deltaY, now)
        if (boundTarget) captureLeaving(boundTarget, width, height, deltaY, now)
      }
      syncPool(width, height, deltaY, now)
    }

    function drawFrame() {
      if (!running) return
      const width = viewWidth
      const height = viewHeight
      const now = performance.now()
      const scrollY = window.scrollY
      const deltaY = scrollY - lastScrollY
      lastScrollY = scrollY

      if (deltaY !== 0) {
        for (const particle of particles) {
          if (particle.slot >= 0) continue
          particle.y -= deltaY
          particle.homeY -= deltaY
          particle.baseY -= deltaY
        }
      }

      wrapOrAssemble(width, height, deltaY, now)
      brush.clearRect(0, 0, width, height)
      brush.fillStyle = PARTICLE_COLOR

      for (const particle of particles) {
        if (particle.slot < 0 && particle.canJitter) {
          updateJitter(particle, now)
        }
        if (particle.slot >= 0) {
          seekHome(particle)
        }

        const half = particle.size / 2
        brush.fillRect(particle.x - half, particle.y - half, particle.size, particle.size)
      }

      frame = window.requestAnimationFrame(drawFrame)
    }

    syncCanvasSize()
    frame = window.requestAnimationFrame(drawFrame)
    window.addEventListener('resize', syncCanvasSize)

    return () => {
      running = false
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', syncCanvasSize)
    }
  }, [])

  return <canvas ref={canvasRef} className="pixel-field" aria-hidden="true" />
}
