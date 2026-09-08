import { useEffect, useRef, useState } from 'react'

/** 视口内路径绘制速度（px/s，沿周长） */
const DRAW_SPEED = 240

interface TriangleDrawProps {
  /**
   * 两角或三角（度）。传入三个时忽略最后一个。
   * 与 sides 一起决定形状与尺寸；默认等边 [60, 60]
   */
  angles?: [number, number] | [number, number, number]
  /** 三边长度 [a, b, c]（对边分别对应角 A、B、C）；默认等边 */
  sides?: [number, number, number]
  /** 是否顺时针绘制，默认 true */
  clockwise?: boolean
  /** 图形自身旋转角度（度），默认 0 */
  rotation?: number
}

function resolveAngles(angles: [number, number] | [number, number, number]): [number, number] {
  return [angles[0], angles[1]]
}

function buildTriangle(
  anglePair: [number, number],
  sideLens: [number, number, number],
): { path: string; width: number; height: number; cx: number; cy: number; perimeter: number } {
  let A = (anglePair[0] * Math.PI) / 180
  let B = (anglePair[1] * Math.PI) / 180
  let C = Math.PI - A - B

  if (!(C > 0.01 && A > 0.01 && B > 0.01)) {
    A = Math.PI / 3
    B = Math.PI / 3
    C = Math.PI / 3
  }

  const [sa, sb, sc] = sideLens.map((s) => Math.max(1, s)) as [number, number, number]
  // 正弦定理：用三边期望长度估一个公共比值
  const ratio =
    (sa / Math.sin(A) + sb / Math.sin(B) + sc / Math.sin(C)) / 3
  const a = ratio * Math.sin(A)
  const b = ratio * Math.sin(B)
  const c = ratio * Math.sin(C)

  // 顶点 A 在原点，边 AB=c 沿 +x；顺时针取 C 在 +y（SVG）
  const Ax = 0
  const Ay = 0
  const Bx = c
  const By = 0
  const Cx = b * Math.cos(A)
  const Cy = b * Math.sin(A)

  const minX = Math.min(Ax, Bx, Cx)
  const maxX = Math.max(Ax, Bx, Cx)
  const minY = Math.min(Ay, By, Cy)
  const maxY = Math.max(Ay, By, Cy)
  const pad = 1
  const width = Math.max(2, maxX - minX + pad * 2)
  const height = Math.max(2, maxY - minY + pad * 2)
  const ox = -minX + pad
  const oy = -minY + pad

  const xA = Ax + ox
  const yA = Ay + oy
  const xB = Bx + ox
  const yB = By + oy
  const xC = Cx + ox
  const yC = Cy + oy

  // 顺时针：A → B → C → A
  const path = `M ${xA} ${yA} L ${xB} ${yB} L ${xC} ${yC} Z`
  const perimeter = a + b + c
  const cx = width / 2
  const cy = height / 2

  return { path, width, height, cx, cy, perimeter }
}

export function TriangleDraw({
  angles = [60, 60],
  sides = [64, 64, 64],
  clockwise = true,
  rotation = 0,
}: TriangleDrawProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawnRef = useRef(0)
  const [drawn, setDrawn] = useState(0)

  const anglePair = resolveAngles(angles)
  const { path, width, height, cx, cy, perimeter } = buildTriangle(anglePair, sides)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    drawnRef.current = 0
    setDrawn(0)

    let frame = 0
    let running = true
    let last = performance.now()

    function tick(now: number) {
      if (!running || !wrap) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const rect = wrap.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isVisible =
        rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh

      if (isVisible && drawnRef.current < perimeter) {
        drawnRef.current = Math.min(perimeter, drawnRef.current + DRAW_SPEED * dt)
        setDrawn(drawnRef.current)
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
    }
  }, [perimeter, path])

  const dashOffset = perimeter - drawn
  const transform = clockwise
    ? undefined
    : `translate(${cx} ${cy}) scale(-1 1) translate(${-cx} ${-cy})`

  return (
    <div
      ref={wrapRef}
      className="triangledraw-wrap"
      style={{ width, height, transform: `rotate(${rotation}deg)` }}
      aria-hidden
    >
      <svg
        className="triangledraw-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <path
          className="triangledraw-path"
          d={path}
          fill="none"
          stroke="#d8d2c8"
          strokeWidth={1}
          strokeDasharray={perimeter}
          strokeDashoffset={dashOffset}
          transform={transform}
        />
      </svg>
    </div>
  )
}
