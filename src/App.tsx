import { useEffect, useState } from 'react'
import { HsParticles } from './components/hs-particles/HsParticles'
import FluidGlass from './components/fluid-glass/FluidGlass'
import { LineDraw } from './components/drawTree/LineDraw'
import { HeroTickTree } from './components/drawTree/HeroTickTree'
import { DrawBoard } from './components/drawTree/drawBoard/DrawBoard'

const HERO_TICKS = [
  { left: 14, tree: true },
  { left: 26, length: 64 },
  { left: 41, length: 44 },
  { left: 58, length: 80 },
  { left: 72, length: 52 },
  { left: 88, length: 70 },
] as const

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash
}

function App() {
  const hash = useHash()
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
          <div className="page-hero-line">
            <LineDraw rotation={90} />
          </div>
          <div className="page-hero-ticks">
            {HERO_TICKS.map((tick) => (
              <div
                key={`${tick.left}-${'tree' in tick ? 'tree' : tick.length}`}
                className="page-hero-tick"
                style={{ left: `${tick.left}%` }}
              >
                {'tree' in tick && tick.tree ? (
                  <HeroTickTree />
                ) : (
                  <LineDraw length={'length' in tick ? tick.length : 48} />
                )}
              </div>
            ))}
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
