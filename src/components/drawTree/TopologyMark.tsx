import { RhombusDraw } from './RhombusDraw'

/** 多维结构拓扑全状态可视化 — 正方形基底 */
export function TopologyMark() {
  return (
    <div className="topology-mark" aria-label="多维结构拓扑全状态可视化">
      <div className="topology-mark-item" style={{ left: 70, top: 40 }}>
        <RhombusDraw
          side={80}
          minAngle={90}
          rotation={45}
          drawId="topo-square"
          followRotate={3}
        />
      </div>
    </div>
  )
}
