import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { Canvas, createPortal, useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, useFBO, useGLTF } from '@react-three/drei'
import { forEachSceneLayer } from '../drawTree/sceneRegistry'

const GLB = '/assets/3d/bar.glb'
const GEOMETRY_KEY = 'Cube'
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

const NAV_ITEMS: { label: string; link: string }[] = [
  { label: '主页', link: '' },
  { label: '项目', link: '' },
  { label: '日志', link: '' },
]

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
  const { nodes } = useGLTF(GLB)
  const geometry = (nodes[GEOMETRY_KEY] as THREE.Mesh | undefined)?.geometry
  const buffer = useFBO({ samples: 0 })
  const [scene] = useState(() => new THREE.Scene())
  const sceneTextureRef = useRef<THREE.CanvasTexture | null>(null)
  const sceneCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const geoSizeRef = useRef({ x: 1, y: 1, z: 1 })

  useEffect(() => {
    if (!geometry) return
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) return
    geoSizeRef.current = {
      x: box.max.x - box.min.x || 1,
      y: box.max.y - box.min.y || 1,
      z: box.max.z - box.min.z || 1,
    }
  }, [geometry])

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
    }
  }, [])

  useFrame((state) => {
    if (!ref.current) return
    const { gl, viewport, camera } = state
    const v = viewport.getCurrentViewport(camera, [0, 0, 15])
    const hit = hitRef.current
    const hitH = hit?.offsetHeight || 64
    const hitW = hit?.offsetWidth || window.innerWidth * BAR_WIDTH_RATIO
    const centerFromTop = BAR_TOP_GAP_PX + hitH / 2
    const barY = v.height / 2 - (centerFromTop / window.innerHeight) * v.height

    ref.current.position.set(0, barY, 15)

    const geo = geoSizeRef.current
    const scaleX = ((hitW / window.innerWidth) * v.width) / geo.x
    const targetWorldH = ((hitH * 0.96) / window.innerHeight) * v.height
    const scaleZ = targetWorldH / geo.z
    const scaleY = scaleZ * BAR_THICKNESS_RATIO
    ref.current.scale.set(scaleX, scaleY, scaleZ)

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
      <mesh ref={ref} rotation-x={Math.PI / 2} geometry={geometry}>
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
