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
    </div>
  )
}

export default App
