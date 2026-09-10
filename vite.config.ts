import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const SCENE_PATH = path.resolve(
  rootDir,
  'src/components/drawTree/drawBoard/drawBoard.scene.json',
)

function drawBoardSavePlugin(): Plugin {
  return {
    name: 'draw-board-save',
    configureServer(server) {
      server.middlewares.use('/__draw_board_save', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(Buffer.from(c)))
        req.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8')
            const data = JSON.parse(raw)
            fs.writeFileSync(SCENE_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, path: SCENE_PATH }))
          } catch (err) {
            res.statusCode = 400
            res.end(String(err))
          }
        })
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), drawBoardSavePlugin()],
})
