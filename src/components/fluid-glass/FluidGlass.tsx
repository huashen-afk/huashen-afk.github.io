import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { Canvas, createPortal, useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, useFBO, useGLTF } from '@react-three/drei'

const GLB = '/assets/3d/bar.glb'
const GEOMETRY_KEY = 'Cube'
const LOGO_SELECTOR = '.hs-canvas'
const PAGE_SELECTOR = '.page'
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

  // 对齐 index.css .page 背景
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
  const logoRef = useRef<THREE.Mesh>(null!)
  const bgRef = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const bgMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const { nodes } = useGLTF(GLB)
  const geometry = (nodes[GEOMETRY_KEY] as THREE.Mesh | undefined)?.geometry
  const buffer = useFBO({ samples: 0 })
  const [scene] = useState(() => new THREE.Scene())
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const bgTextureRef = useRef<THREE.CanvasTexture | null>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const logoCanvasRef = useRef<HTMLCanvasElement | null>(null)
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
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = Math.max(1, window.innerWidth)
    bgCanvas.height = Math.max(1, window.innerHeight)
    bgCanvasRef.current = bgCanvas
    const bgTexture = new THREE.CanvasTexture(bgCanvas)
    bgTexture.colorSpace = THREE.SRGBColorSpace
    bgTextureRef.current = bgTexture
    if (bgMatRef.current) {
      bgMatRef.current.map = bgTexture
      bgMatRef.current.needsUpdate = true
    }

    const canvas = document.querySelector<HTMLCanvasElement>(LOGO_SELECTOR)
    if (canvas) {
      logoCanvasRef.current = canvas
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
      textureRef.current = texture
      if (matRef.current) {
        matRef.current.map = texture
        matRef.current.needsUpdate = true
      }
    }

    return () => {
      bgTexture.dispose()
      bgTextureRef.current = null
      bgCanvasRef.current = null
      textureRef.current?.dispose()
      textureRef.current = null
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

    const bgCanvas = bgCanvasRef.current
    const bgTexture = bgTextureRef.current
    const bgMesh = bgRef.current
    if (bgCanvas && bgTexture && bgMesh) {
      const w = Math.max(1, Math.floor(window.innerWidth))
      const h = Math.max(1, Math.floor(window.innerHeight))
      if (bgCanvas.width !== w || bgCanvas.height !== h) {
        bgCanvas.width = w
        bgCanvas.height = h
      }
      const bgCtx = bgCanvas.getContext('2d')
      if (bgCtx) {
        paintPageBackground(bgCtx, w, h)
        bgTexture.needsUpdate = true
      }
      if (bgMatRef.current && bgMatRef.current.map !== bgTexture) {
        bgMatRef.current.map = bgTexture
        bgMatRef.current.needsUpdate = true
      }
      const world = viewport.getCurrentViewport(camera, [0, 0, -4])
      bgMesh.position.set(0, 0, -4)
      bgMesh.scale.set(world.width, world.height, 1)
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
          <mesh ref={bgRef} position={[0, 0, -4]}>
            <planeGeometry />
            <meshBasicMaterial ref={bgMatRef} toneMapped={false} />
          </mesh>
          <mesh ref={logoRef} visible={false}>
            <planeGeometry />
            <meshBasicMaterial ref={matRef} transparent toneMapped={false} />
          </mesh>
        </>,
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
