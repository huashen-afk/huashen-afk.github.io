import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { Canvas, createPortal, useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, useFBO, useGLTF } from '@react-three/drei'
import { easing } from 'maath'

const GLB = '/assets/3d/bar.glb'
const GEOMETRY_KEY = 'Cube'
const LOGO_SELECTOR = '.hs-canvas'
const BG = '#120f17'

const SCALE = 0.15
const IOR = 1.3
const THICKNESS = 0.12
const CHROMATIC_ABERRATION = 0.5
const ANISOTROPY = 0
const TRANSMISSION = 1
const ROUGHNESS = 0
const BAR_Y_OFFSET = 0.18

const CHAR_PX = 80
const SAMPLE_STEP = 3
const DOT_SIZE = 2.4
const DISPLAY_SCALE = 0.58
const DROP_RATE = 0.3
const JITTER_RATE = 0.1
const JITTER_BASE_MS = 1000
const JITTER_EXTRA_MS = 500
const JITTER_CELLS = 0.4
const TEXT_COLOR = '#f4f1ea'
const CARDINAL = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]
const JITTER_PHASE = {
  idle: 0,
  out: 1,
} as const

const NAV_ITEMS: { label: string; link: string }[] = [
  { label: '主页', link: '' },
  { label: '项目', link: '' },
  { label: '日志', link: '' },
]

interface NavParticle {
  x: number
  y: number
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

function FluidGlass() {
  const hitRef = useRef<HTMLDivElement>(null!)

  return (
    <>
      <Canvas
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
        eventSource={hitRef}
        eventPrefix="client"
        camera={{ position: [0, 0, 20], fov: 15 }}
        gl={{ alpha: true, antialias: true, toneMapping: THREE.NoToneMapping }}
      >
        <GlassBar hitRef={hitRef} />
      </Canvas>
      <div ref={hitRef} className="fluid-glass-hit">
        <PixelNav />
      </div>
    </>
  )
}

function nextJitterDuration() {
  return JITTER_BASE_MS + Math.random() * JITTER_EXTRA_MS
}

function pickCardinal() {
  return CARDINAL[Math.floor(Math.random() * CARDINAL.length)]
}

function updateJitter(particle: NavParticle, now: number) {
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

function sampleLabelPoints(label: string) {
  const chars = Array.from(label)
  const width = Math.max(1, chars.length * CHAR_PX)
  const height = CHAR_PX
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const mctx = mask.getContext('2d', { willReadFrequently: true })!
  mctx.clearRect(0, 0, width, height)
  mctx.fillStyle = '#fff'
  mctx.textAlign = 'center'
  mctx.textBaseline = 'middle'
  mctx.font = `700 ${CHAR_PX * 0.82}px "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif`
  mctx.fillText(label, width / 2, height / 2 + CHAR_PX * 0.04)

  const image = mctx.getImageData(0, 0, width, height).data
  const points: { x: number; y: number }[] = []
  const half = SAMPLE_STEP / 2

  for (let y = half; y < height; y += SAMPLE_STEP) {
    for (let x = half; x < width; x += SAMPLE_STEP) {
      const px = Math.min(width - 1, Math.floor(x))
      const py = Math.min(height - 1, Math.floor(y))
      const alpha = image[(py * width + px) * 4 + 3]
      if (alpha > 80 && Math.random() >= DROP_RATE) {
        points.push({ x, y })
      }
    }
  }

  return { width, height, points }
}

function PixelNav() {
  return (
    <nav className="fluid-glass-nav" aria-label="主导航">
      {NAV_ITEMS.map((item) => (
        <PixelNavItem key={item.label} label={item.label} link={item.link} />
      ))}
    </nav>
  )
}

function PixelNavItem({ label, link }: { label: string; link: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const view = canvasRef.current
    if (!view) return
    const { width, height, points } = sampleLabelPoints(label)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = width * DISPLAY_SCALE
    const cssH = height * DISPLAY_SCALE
    view.style.width = `${cssW}px`
    view.style.height = `${cssH}px`
    view.width = Math.floor(cssW * dpr)
    view.height = Math.floor(cssH * dpr)

    const ctx = view.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const scale = DISPLAY_SCALE
    const now0 = performance.now()
    const particles: NavParticle[] = points.map((point) => {
      const duration = nextJitterDuration()
      return {
        x: point.x * scale,
        y: point.y * scale,
        homeX: point.x * scale,
        homeY: point.y * scale,
        baseX: point.x * scale,
        baseY: point.y * scale,
        size: DOT_SIZE * scale,
        cellSize: SAMPLE_STEP * scale,
        dirX: 0,
        dirY: 0,
        phase: JITTER_PHASE.idle,
        phaseStart: now0 - Math.random() * duration,
        phaseDuration: duration,
        canJitter: Math.random() < JITTER_RATE,
      }
    })

    let frame = 0
    let running = true

    function drawFrame(now: number) {
      if (!running) return
      ctx!.clearRect(0, 0, cssW, cssH)
      ctx!.fillStyle = TEXT_COLOR
      for (const particle of particles) {
        if (particle.canJitter) updateJitter(particle, now)
        const half = particle.size / 2
        ctx!.fillRect(particle.x - half, particle.y - half, particle.size, particle.size)
      }
      frame = window.requestAnimationFrame(drawFrame)
    }

    frame = window.requestAnimationFrame(drawFrame)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [label])

  function handleClick() {
    if (!link) return
    if (link.startsWith('#')) window.location.hash = link
    else window.location.href = link
  }

  return (
    <button type="button" className="fluid-glass-nav-item" onClick={handleClick}>
      <canvas ref={canvasRef} aria-label={label} />
    </button>
  )
}

function GlassBar({ hitRef }: { hitRef: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<THREE.Mesh>(null!)
  const logoRef = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const { nodes } = useGLTF(GLB)
  const geometry = (nodes[GEOMETRY_KEY] as THREE.Mesh | undefined)?.geometry
  const buffer = useFBO({ samples: 0 })
  const [scene] = useState(() => new THREE.Scene())
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const logoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const projected = useRef(new THREE.Vector3())

  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(LOGO_SELECTOR)
    if (!canvas) return
    logoCanvasRef.current = canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    textureRef.current = texture
    if (matRef.current) {
      matRef.current.map = texture
      matRef.current.needsUpdate = true
    }
    return () => {
      texture.dispose()
      textureRef.current = null
    }
  }, [])

  useFrame((state, delta) => {
    if (!ref.current) return
    const { gl, viewport, camera } = state
    const v = viewport.getCurrentViewport(camera, [0, 0, 15])
    const barY = v.height / 2 - BAR_Y_OFFSET

    easing.damp3(ref.current.position, [0, barY, 15], 0.15, delta)
    ref.current.scale.setScalar(SCALE)

    projected.current.copy(ref.current.position).project(camera)
    const hit = hitRef.current
    if (hit) {
      const x = (projected.current.x * 0.5 + 0.5) * window.innerWidth
      const y = (-projected.current.y * 0.5 + 0.5) * window.innerHeight
      hit.style.left = `${x}px`
      hit.style.top = `${y}px`
    }

    if (!textureRef.current) {
      const canvas = document.querySelector<HTMLCanvasElement>(LOGO_SELECTOR)
      if (canvas) {
        logoCanvasRef.current = canvas
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        textureRef.current = texture
        if (matRef.current) {
          matRef.current.map = texture
          matRef.current.needsUpdate = true
        }
      }
    }

    const texture = textureRef.current
    const logoEl = logoCanvasRef.current
    const logoMesh = logoRef.current

    if (texture && logoEl && logoMesh) {
      texture.needsUpdate = true
      const rect = logoEl.getBoundingClientRect()
      const world = viewport.getCurrentViewport(camera, [0, 0, 12])
      const x = ((rect.left + rect.width / 2) / window.innerWidth - 0.5) * world.width
      const y = -((rect.top + rect.height / 2) / window.innerHeight - 0.5) * world.height
      const w = (rect.width / window.innerWidth) * world.width
      const h = (rect.height / window.innerHeight) * world.height
      logoMesh.position.set(x, y, 12)
      logoMesh.scale.set(w, h, 1)
      logoMesh.visible = rect.width > 0 && rect.height > 0
    } else if (logoMesh) {
      logoMesh.visible = false
    }

    gl.setClearColor(0x000000, 0)
    gl.setRenderTarget(buffer)
    gl.clear(true, true, true)
    gl.render(scene, camera)
    gl.setRenderTarget(null)
  })

  return (
    <>
      {createPortal(
        <>
          <mesh position={[0, 0, -5]} scale={[100, 100, 1]}>
            <planeGeometry />
            <meshBasicMaterial color={BG} toneMapped={false} />
          </mesh>
          <mesh ref={logoRef} visible={false}>
            <planeGeometry />
            <meshBasicMaterial ref={matRef} transparent toneMapped={false} />
          </mesh>
        </>,
        scene,
      )}
      <mesh ref={ref} scale={SCALE} rotation-x={Math.PI / 2} geometry={geometry}>
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          transmission={TRANSMISSION}
          roughness={ROUGHNESS}
          thickness={THICKNESS}
          ior={IOR}
          chromaticAberration={CHROMATIC_ABERRATION}
          anisotropy={ANISOTROPY}
          color="#ffffff"
          attenuationColor="#ffffff"
          attenuationDistance={0.25}
        />
      </mesh>
    </>
  )
}

useGLTF.preload(GLB)

export default FluidGlass
