import { HsParticles } from './components/hs-particles/HsParticles'
import FluidGlass from './components/fluid-glass/FluidGlass'
import { LineDraw } from './components/drawTree/LineDraw'
import { CircleDraw } from './components/drawTree/CircleDraw'
import { RhombusDraw } from './components/drawTree/RhombusDraw'
import { TriangleDraw } from './components/drawTree/TriangleDraw'
import { CurveDraw } from './components/drawTree/CurveDraw'

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
      </section>
      <main className="page-main">
        <LineDraw />
        <div className="page-main-shapes">
          <CircleDraw radius={56} />
          <RhombusDraw side={64} minAngle={30} />
          <TriangleDraw />
          <CurveDraw
            from={{ x: 0, y: 40 }}
            to={{ x: 180, y: 40 }}
            curvature={56}
            bendAt={0.45}
          />
        </div>
      </main>
      <footer className="page-footer">
        <p className="page-footer-text">测试用文字</p>
      </footer>
    </div>
  )
}

export default App
