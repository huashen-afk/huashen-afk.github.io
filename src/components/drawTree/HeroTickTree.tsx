import { LineDraw } from './LineDraw'
import { RhombusDraw } from './RhombusDraw'

/** 相对原点：绘图板场景归一化后的第一棵树 */
const ORIGIN_X = 1120
const ORIGIN_Y = 133

const PARTS = [
  {
    key: 'stem-l',
    type: 'line' as const,
    x: 1134 - ORIGIN_X,
    y: 133 - ORIGIN_Y,
    props: { length: 68, rotation: 0, followRotate: 0 },
  },
  {
    key: 'stem-r',
    type: 'line' as const,
    x: 1140 - ORIGIN_X,
    y: 133 - ORIGIN_Y,
    props: { length: 68, rotation: 0, followRotate: 0 },
  },
  {
    key: 'branch-r',
    type: 'line' as const,
    x: 1140 - ORIGIN_X,
    y: 200 - ORIGIN_Y,
    props: { length: 19, rotation: 30, followRotate: 0 },
  },
  {
    key: 'branch-l',
    type: 'line' as const,
    x: 1120 - ORIGIN_X,
    y: 225 - ORIGIN_Y,
    props: { length: 28, rotation: 30, followRotate: 0 },
  },
  {
    key: 'stem-b',
    type: 'line' as const,
    x: 1135 - ORIGIN_X,
    y: 249 - ORIGIN_Y,
    props: { length: 48, rotation: 0, followRotate: 0 },
  },
  {
    key: 'diamond',
    type: 'rhombus' as const,
    x: 1123 - ORIGIN_X,
    y: 201 - ORIGIN_Y,
    props: {
      side: 22,
      minAngle: 60,
      rotation: 0,
      followRotate: 0,
      instant: true,
    },
  },
] as const

/** 首页第一根刻度：双竖线 + 斜线 + 菱形组合 */
export function HeroTickTree() {
  return (
    <div className="hero-tick-tree" aria-hidden>
      {PARTS.map((part) => (
        <div
          key={part.key}
          className="hero-tick-tree-part"
          style={{ left: part.x, top: part.y }}
        >
          {part.type === 'line' ? (
            <LineDraw
              length={part.props.length}
              rotation={part.props.rotation}
              followRotate={part.props.followRotate}
            />
          ) : (
            <RhombusDraw
              side={part.props.side}
              minAngle={part.props.minAngle}
              rotation={part.props.rotation}
              followRotate={part.props.followRotate}
              instant={part.props.instant}
            />
          )}
        </div>
      ))}
    </div>
  )
}
