import { HsParticles } from './components/hs-particles/HsParticles'

function App() {
  return (
    <div className="page">
      <aside className="page-brand">
        <HsParticles />
      </aside>
      <main className="page-main">
        <p className="test-copy">这是一段测试文字</p>
      </main>
    </div>
  )
}

export default App
