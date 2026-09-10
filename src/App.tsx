import { HsParticles } from './components/hs-particles/HsParticles'
import FluidGlass from './components/fluid-glass/FluidGlass'
import { LineDraw } from './components/drawTree/LineDraw'
import { RhombusDraw } from './components/drawTree/RhombusDraw'

const HERO_TICKS = [
  { left: 14, length: 36, rhombus: true },
  { left: 26, length: 64 },
  { left: 41, length: 44 },
  { left: 58, length: 80 },
  { left: 72, length: 52 },
  { left: 88, length: 70 },
] as const

function App() {
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
                key={`${tick.left}-${tick.length}`}
                className="page-hero-tick"
                style={{ left: `${tick.left}%` }}
              >
                <LineDraw length={tick.length} />
                {'rhombus' in tick && tick.rhombus ? (
                  <div className="page-hero-tick-shape">
                    <RhombusDraw side={16} minAngle={60} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
