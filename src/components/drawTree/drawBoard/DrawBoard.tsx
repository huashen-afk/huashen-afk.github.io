import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  createDrawItem,
  DRAW_CATALOG,
  EMPTY_SCENE,
  getCatalog,
  SCENE_STORAGE_KEY,
  type DrawItem,
  type DrawKind,
  type DrawScene,
} from './drawCatalog'
import sceneFile from './drawBoard.scene.json'

const SAVE_URL = '/__draw_board_save'

function nowScene(items: DrawItem[]): DrawScene {
  return { version: 1, updatedAt: new Date().toISOString(), items }
}

function loadInitial(): DrawScene {
  try {
    const raw = localStorage.getItem(SCENE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DrawScene
      if (parsed?.version === 1 && Array.isArray(parsed.items)) return parsed
    }
  } catch {
    /* ignore */
  }
  const file = sceneFile as DrawScene
  if (file?.version === 1 && Array.isArray(file.items) && file.items.length > 0) {
    return file
  }
  return { ...EMPTY_SCENE, updatedAt: new Date().toISOString(), items: [] }
}

function exposeScene(scene: DrawScene) {
  ;(window as unknown as { __DRAW_BOARD_SCENE__?: DrawScene }).__DRAW_BOARD_SCENE__ = scene
}

/** 绘图板：可放置 drawTree 全库组件，完成后写入场景 JSON 供拉取 */
export function DrawBoard() {
  const [scene, setScene] = useState<DrawScene>(loadInitial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null)

  const selected = scene.items.find((i) => i.id === selectedId) ?? null

  useEffect(() => {
    exposeScene(scene)
    localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(scene))
  }, [scene])

  const updateItems = useCallback((fn: (items: DrawItem[]) => DrawItem[]) => {
    setScene((prev) => nowScene(fn(prev.items)))
  }, [])

  useEffect(() => {
    if (!selectedId) return

    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const step = e.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else if (e.key === 'ArrowUp') dy = -step
      else if (e.key === 'ArrowDown') dy = step
      else return

      e.preventDefault()
      updateItems((items) =>
        items.map((it) =>
          it.id === selectedId ? { ...it, x: it.x + dx, y: it.y + dy } : it,
        ),
      )
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, updateItems])

  const addAtCenter = useCallback(
    (type: DrawKind) => {
      const el = boardRef.current
      const w = el?.clientWidth ?? 640
      const h = el?.clientHeight ?? 400
      const item = createDrawItem(type, w * 0.5 - 20, h * 0.35)
      updateItems((items) => [...items, item])
      setSelectedId(item.id)
    },
    [updateItems],
  )

  const onPointerDownItem = (e: ReactPointerEvent, id: string) => {
    e.stopPropagation()
    setSelectedId(id)
    const item = scene.items.find((i) => i.id === id)
    if (!item) return
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = {
      id,
      ox: e.clientX - rect.left - item.x,
      oy: e.clientY - rect.top - item.y,
    }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    const rect = boardRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const x = Math.round(e.clientX - rect.left - drag.ox)
    const y = Math.round(e.clientY - rect.top - drag.oy)
    updateItems((items) =>
      items.map((it) => (it.id === drag.id ? { ...it, x, y } : it)),
    )
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const patchProps = (key: string, value: unknown) => {
    if (!selectedId) return
    updateItems((items) =>
      items.map((it) =>
        it.id === selectedId ? { ...it, props: { ...it.props, [key]: value } } : it,
      ),
    )
  }

  const removeSelected = () => {
    if (!selectedId) return
    updateItems((items) => items.filter((i) => i.id !== selectedId))
    setSelectedId(null)
  }

  const clearAll = () => {
    setScene(nowScene([]))
    setSelectedId(null)
    setStatus('已清空')
  }

  const saveToProject = async () => {
    const payload = nowScene(scene.items)
    setScene(payload)
    exposeScene(payload)
    try {
      const res = await fetch(SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('已写入 drawBoard.scene.json，可让助手拉取')
    } catch (err) {
      setStatus(`写入失败：${err instanceof Error ? err.message : String(err)}（仍可用 window.__DRAW_BOARD_SCENE__）`)
    }
  }

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(nowScene(scene.items), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'drawBoard.scene.json'
    a.click()
    URL.revokeObjectURL(url)
    setStatus('已下载 JSON')
  }

  return (
    <div className="draw-board">
      <header className="draw-board-bar">
        <strong>绘图板</strong>
        <span className="draw-board-hint">放置组件 → 拖拽 / 方向键微调（Shift 加速）→「写入项目」</span>
        <a className="draw-board-link" href="#/">
          回首页
        </a>
        <button type="button" onClick={downloadJson}>
          下载 JSON
        </button>
        <button type="button" className="draw-board-primary" onClick={() => void saveToProject()}>
          写入项目
        </button>
        <button type="button" onClick={clearAll}>
          清空
        </button>
      </header>

      <div className="draw-board-body">
        <aside className="draw-board-palette">
          <p className="draw-board-label">组件库</p>
          {DRAW_CATALOG.map((c) => (
            <button key={c.type} type="button" onClick={() => addAtCenter(c.type)}>
              + {c.label}
            </button>
          ))}
        </aside>

        <div
          ref={boardRef}
          className="draw-board-canvas"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerDown={() => setSelectedId(null)}
        >
          {scene.items.map((item) => {
            const cat = getCatalog(item.type)
            if (!cat) return null
            const Comp = cat.Component
            const active = item.id === selectedId
            return (
              <div
                key={item.id}
                className={`draw-board-item${active ? ' is-active' : ''}`}
                style={{ left: item.x, top: item.y }}
                onPointerDown={(e) => onPointerDownItem(e, item.id)}
              >
                <Comp {...item.props} />
              </div>
            )
          })}
        </div>

        <aside className="draw-board-props">
          <p className="draw-board-label">属性</p>
          {!selected ? (
            <p className="draw-board-empty">选中画布中的图形</p>
          ) : (
            <>
              <p className="draw-board-meta">
                {getCatalog(selected.type)?.label} · {selected.id}
              </p>
              <label>
                x
                <input
                  type="number"
                  value={selected.x}
                  onChange={(e) =>
                    updateItems((items) =>
                      items.map((it) =>
                        it.id === selected.id ? { ...it, x: Number(e.target.value) } : it,
                      ),
                    )
                  }
                />
              </label>
              <label>
                y
                <input
                  type="number"
                  value={selected.y}
                  onChange={(e) =>
                    updateItems((items) =>
                      items.map((it) =>
                        it.id === selected.id ? { ...it, y: Number(e.target.value) } : it,
                      ),
                    )
                  }
                />
              </label>
              {Object.entries(selected.props).map(([key, val]) => {
                if (typeof val === 'boolean') {
                  return (
                    <label key={key}>
                      {key}
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => patchProps(key, e.target.checked)}
                      />
                    </label>
                  )
                }
                if (typeof val === 'number') {
                  return (
                    <label key={key}>
                      {key}
                      <input
                        type="number"
                        value={val}
                        step="any"
                        onChange={(e) => patchProps(key, Number(e.target.value))}
                      />
                    </label>
                  )
                }
                if (typeof val === 'string') {
                  return (
                    <label key={key}>
                      {key}
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => patchProps(key, e.target.value)}
                      />
                    </label>
                  )
                }
                return (
                  <label key={key}>
                    {key} (JSON)
                    <textarea
                      rows={3}
                      value={JSON.stringify(val)}
                      onChange={(e) => {
                        try {
                          patchProps(key, JSON.parse(e.target.value))
                        } catch {
                          /* typing */
                        }
                      }}
                    />
                  </label>
                )
              })}
              <button type="button" onClick={removeSelected}>
                删除选中
              </button>
            </>
          )}
          {status ? <p className="draw-board-status">{status}</p> : null}
          <pre className="draw-board-json" data-draw-export>
            {JSON.stringify(scene, null, 2)}
          </pre>
        </aside>
      </div>
    </div>
  )
}
