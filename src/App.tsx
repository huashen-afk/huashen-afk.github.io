import { HexBackground } from './components/hex-background/HexBackground'
import { HsParticles } from './components/hs-particles/HsParticles'

function App() {
  return (
    <div className="page">
      <HexBackground />
      <aside className="page-brand">
        <HsParticles />
      </aside>
      <main className="page-main" />
    </div>
  )
}

export default App
