import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { Canvas, createPortal, useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, useFBO } from '@react-three/drei'
import { forEachSceneLayer } from '../drawTree/sceneRegistry'

const PAGE_SELECTOR = '.page'
const LOGO_SELECTOR = '.hs-canvas'
const BG = '#120f17'

const IOR = 1.5
const THICKNESS = 3
const CHROMATIC_ABERRATION = 1.2
const ANISOTROPY = 0.1
const TRANSMISSION = 1
const ROUGHNESS = 0
const BAR_WIDTH_RATIO = 0.6
const BAR_THICKNESS_RATIO = 0.42
const BAR_TOP_GAP_PX = 28
const BAR_INSET_TOP_PX = 2//为了弥补玻璃的边缘对齐，需要内缩
const BAR_INSET_BOTTOM_PX = 1//为了弥补玻璃的边缘对齐，需要内缩
const RADIUS_RATIO = 0.5//玻璃条圆角比例，与tab圆角一致

const NAV_ITEMS: { label: string; link: string }[] = [
  { label: '主页', link: '' },
  { label: '项目', link: '' },
  { label: '日志', link: '' },
]

function createStadiumGeometry(width: number, height: number, depth: number) {
  const w = Math.max(0.001, width)
  const h = Math.max(0.001, height)
  const d = Math.max(0.001, depth)
  const r = Math.min(w, h) * RADIUS_RATIO
  const x0 = -w / 2
  const y0 = -h / 2

  const shape = new THREE.Shape()
  shape.moveTo(x0 + r, y0)
  shape.lineTo(x0 + w - r, y0)
  shape.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(x0 + w, y0 + h - r)
  shape.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false)
  shape.lineTo(x0 + r, y0 + h)
  shape.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(x0, y0 + r)
  shape.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
    curveSegments: 24,
  })
  geometry.translate(0, 0, -d / 2)
  geometry.computeVertexNormals()
  return geometry
}

function paintPageBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const page = document.querySelector<HTMLElement>(PAGE_SELECTOR)
  const pr = page?.getBoundingClientRect() ?? {
    left: 0,
    top: 0,
    width,
    height,
  }

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, width, height)

  function fillSoftEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rgb: string,
    alpha: number,
    fadeAt: number,
  ) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(Math.max(rx, 1), Math.max(ry, 1))
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`)
    grad.addColorStop(fadeAt, `rgba(${rgb}, ${alpha * 0.35})`)
    grad.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = grad
    ctx.fillRect(-1, -1, 2, 2)
    ctx.restore()
  }

  fillSoftEllipse(
    pr.left + pr.width * 0.5,
    pr.top + pr.height * 0.08,
    pr.width * 0.35,
    pr.height * 0.225,
    '92, 64, 140',
    0.22,
    0.58,
  )
  fillSoftEllipse(
    pr.left + pr.width * 0.88,
    pr.top + pr.height * 0.92,
    pr.width * 0.25,
    pr.height * 0.2,
    '28, 22, 40',
    0.9,
    0.55,
  )
}

function paintViewportScene(ctx: CanvasRenderingContext2D, width: number, height: number) {
  paintPageBackground(ctx, width, height)

  const logo = document.querySelector<HTMLCanvasElement>(LOGO_SELECTOR)
  if (logo && logo.width > 0 && logo.height > 0) {
    const rect = logo.getBoundingClientRect()
    if (rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width) {
      ctx.drawImage(logo, rect.left, rect.top, rect.width, rect.height)
    }
  }

  forEachSceneLayer(({ canvas }) => {
    if (!canvas.width || !canvas.height) return
    if (canvas === logo) return
    const rect = canvas.getBoundingClientRect()
    if (rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) return
    ctx.drawImage(canvas, rect.left, rect.top, rect.width, rect.height)
  })
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
        <nav className="fluid-glass-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className="fluid-glass-nav-item"
              onClick={() => {
                if (!item.link) return
                if (item.link.startsWith('#')) window.location.hash = item.link
                else window.location.href = item.link
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  )
}

function GlassBar({ hitRef }: { hitRef: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<THREE.Mesh>(null!)
  const sceneMeshRef = useRef<THREE.Mesh>(null!)
  const sceneMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const buffer = useFBO({ samples: 0 })
  const [scene] = useState(() => new THREE.Scene())
  const sceneTextureRef = useRef<THREE.CanvasTexture | null>(null)
  const sceneCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const geoKeyRef = useRef('')
  const geometryRef = useRef<THREE.BufferGeometry>(createStadiumGeometry(1, 0.2, 0.08))

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, window.innerWidth)
    canvas.height = Math.max(1, window.innerHeight)
    sceneCanvasRef.current = canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    sceneTextureRef.current = texture
    if (sceneMatRef.current) {
      sceneMatRef.current.map = texture
      sceneMatRef.current.needsUpdate = true
    }
    return () => {
      texture.dispose()
      sceneTextureRef.current = null
      sceneCanvasRef.current = null
      geometryRef.current.dispose()
    }
  }, [])

  useFrame((state) => {
    if (!ref.current) return
    const { gl, viewport, camera } = state
    const v = viewport.getCurrentViewport(camera, [0, 0, 15])
    const hit = hitRef.current
    const rect = hit?.getBoundingClientRect()
    const rawH = rect?.height || hit?.offsetHeight || 64
    const hitW = rect?.width || hit?.offsetWidth || window.innerWidth * BAR_WIDTH_RATIO
    const hitH = Math.max(1, rawH - BAR_INSET_TOP_PX - BAR_INSET_BOTTOM_PX)
    const centerY = rect
      ? rect.top + BAR_INSET_TOP_PX + hitH / 2
      : BAR_TOP_GAP_PX + BAR_INSET_TOP_PX + hitH / 2
    const barY = v.height / 2 - (centerY / window.innerHeight) * v.height

    const worldW = (hitW / window.innerWidth) * v.width
    const worldH = (hitH / window.innerHeight) * v.height
    const worldD = worldH * BAR_THICKNESS_RATIO
    const key = `${worldW.toFixed(4)}:${worldH.toFixed(4)}:${worldD.toFixed(4)}`
    if (key !== geoKeyRef.current) {
      geoKeyRef.current = key
      const next = createStadiumGeometry(worldW, worldH, worldD)
      const prev = geometryRef.current
      geometryRef.current = next
      ref.current.geometry = next
      if (prev !== next) prev.dispose()
    }

    ref.current.position.set(0, barY, 15)
    ref.current.scale.set(1, 1, 1)

    const sceneCanvas = sceneCanvasRef.current
    const sceneTexture = sceneTextureRef.current
    const sceneMesh = sceneMeshRef.current
    if (sceneCanvas && sceneTexture && sceneMesh) {
      const w = Math.max(1, Math.floor(window.innerWidth))
      const h = Math.max(1, Math.floor(window.innerHeight))
      if (sceneCanvas.width !== w || sceneCanvas.height !== h) {
        sceneCanvas.width = w
        sceneCanvas.height = h
      }
      const ctx = sceneCanvas.getContext('2d')
      if (ctx) {
        paintViewportScene(ctx, w, h)
        sceneTexture.needsUpdate = true
      }
      if (sceneMatRef.current && sceneMatRef.current.map !== sceneTexture) {
        sceneMatRef.current.map = sceneTexture
        sceneMatRef.current.needsUpdate = true
      }
      const world = viewport.getCurrentViewport(camera, [0, 0, 12])
      sceneMesh.position.set(0, 0, 12)
      sceneMesh.scale.set(world.width, world.height, 1)
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
        <mesh ref={sceneMeshRef} position={[0, 0, 12]}>
          <planeGeometry />
          <meshBasicMaterial ref={sceneMatRef} toneMapped={false} />
        </mesh>,
        scene,
      )}
      <mesh ref={ref} geometry={geometryRef.current}>
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

export default FluidGlass
