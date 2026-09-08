import { HsParticles } from './components/hs-particles/HsParticles'
import FluidGlass from './components/fluid-glass/FluidGlass'

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
      <main className="page-main" />
      <footer className="page-footer">
        <p className="page-footer-text">测试用文字</p>
      </footer>
    </div>
  )
}

export default App
