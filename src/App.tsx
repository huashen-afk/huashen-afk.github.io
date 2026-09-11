import { useEffect, useRef, useState } from 'react'
import { HsParticles } from './components/hs-particles/HsParticles'
import FluidGlass from './components/fluid-glass/FluidGlass'
import { LineDraw } from './components/drawTree/LineDraw'
import { HeroTickTree } from './components/drawTree/HeroTickTree'
import { DrawBoard } from './components/drawTree/drawBoard/DrawBoard'

const HERO_SEG_COUNT = 7

/** 每段横线终点处的竖向树/刻度（第 1 根为绘图板树） */
const HERO_TICKS = [
  { tree: true as const },
  { length: 64 },
  { length: 44 },
  { length: 80 },
  { length: 52 },
  { length: 70 },
  { length: 56 },
] as const

function segDrawId(i: number) {
  return `hero-seg-${i}`
}

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash
}

function useHeroSegLength(count: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [segLen, setSegLen] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    function measure() {
      setSegLen(el!.getBoundingClientRect().width / count)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [count])

  return { ref, segLen }
}

function App() {
  const hash = useHash()
  const { ref: lineRef, segLen } = useHeroSegLength(HERO_SEG_COUNT)

  if (hash === '#draw' || hash === '#/draw') {
    return <DrawBoard />
  }

  return (
    <div className="page">
      <div className="fluid-glass-overlay">
        <FluidGlass />
      </div>
      <section className="page-hero">
        <div className="page-brand">
          <HsParticles />
        </div>
        <div className="page-hero-rail">
          <div className="page-hero-line" ref={lineRef}>
            {segLen > 0
              ? Array.from({ length: HERO_SEG_COUNT }, (_, i) => (
                  <div key={segDrawId(i)} className="page-hero-line-seg">
                    <LineDraw
                      rotation={90}
                      length={segLen}
                      drawId={segDrawId(i)}
                      after={i === 0 ? undefined : segDrawId(i - 1)}
                    />
                  </div>
                ))
              : null}
          </div>
          <div className="page-hero-ticks">
            {HERO_TICKS.map((tick, i) => {
              const isLast = i === HERO_TICKS.length - 1
              return (
                <div
                  key={`${segDrawId(i)}-tick`}
                  className={`page-hero-tick${isLast ? ' is-last' : ''}`}
                  style={{ left: `${((i + 1) / HERO_SEG_COUNT) * 100}%` }}
                >
                  {'tree' in tick && tick.tree ? (
                    <HeroTickTree after={segDrawId(i)} />
                  ) : (
                    <LineDraw
                      length={'length' in tick ? tick.length : 48}
                      after={segDrawId(i)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <a className="page-draw-link" href="#draw">
          打开绘图板
        </a>
      </section>
    </div>
  )
}

export default App
