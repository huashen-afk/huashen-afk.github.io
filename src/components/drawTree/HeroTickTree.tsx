import { LineDraw } from './LineDraw'
import { RhombusDraw } from './RhombusDraw'
import { CircleDraw } from './CircleDraw'

/** 绘图板场景树；原点 (30, 33)。数组顺序即自上而下绘制顺序。 */
const PARTS = [
  {
    key: 'line-mtwqn5m3',
    type: 'line' as const,
    x: 26,
    y: 0,
    props: { length: 82, rotation: 0, followRotate: 0 },
  },
  {
    key: 'circle-mtwry723',
    type: 'circle' as const,
    x: 6,
    y: 39,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'line-mtwrwcg8',
    type: 'line' as const,
    x: 8,
    y: 44,
    props: { length: 63, rotation: 0, followRotate: 0 },
  },
  {
    key: 'line-mtwru98a',
    type: 'line' as const,
    x: 8,
    y: 51,
    props: { length: 70, rotation: 30, followRotate: 0 },
  },
  {
    key: 'rhombus-mtwqzr5z',
    type: 'rhombus' as const,
    x: 0,
    y: 79,
    props: { side: 16, minAngle: 60, rotation: 0, followRotate: 0, instant: false },
  },
  {
    key: 'circle-mtwryds1',
    type: 'circle' as const,
    x: 42,
    y: 85,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'line-mtwrx6p2',
    type: 'line' as const,
    x: 44,
    y: 91,
    props: { length: 36, rotation: 0, followRotate: 0 },
  },
  {
    key: 'rhombus-mtwqn84q',
    type: 'rhombus' as const,
    x: 14,
    y: 96,
    props: { side: 24, minAngle: 60, rotation: 0, followRotate: 0, instant: false },
  },
  {
    key: 'line-mtwqnnid',
    type: 'line' as const,
    x: 8,
    y: 118,
    props: { length: 72, rotation: 30, followRotate: 0 },
  },
  {
    key: 'line-mtwqy2t8',
    type: 'line' as const,
    x: 8,
    y: 119,
    props: { length: 32, rotation: 0, followRotate: 0 },
  },
  {
    key: 'rhombus-mtwqzz29',
    type: 'rhombus' as const,
    x: 36,
    y: 126,
    props: { side: 16, minAngle: 60, rotation: 0, followRotate: 0, instant: false },
  },
  {
    key: 'line-mtwqq2oa',
    type: 'line' as const,
    x: 26,
    y: 149,
    props: { length: 48, rotation: 0, followRotate: 0 },
  },
  {
    key: 'circle-mtwr5539',
    type: 'circle' as const,
    x: 6,
    y: 153,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'line-mtwrf1tz',
    type: 'line' as const,
    x: 8,
    y: 159,
    props: { length: 58, rotation: 0, followRotate: 0 },
  },
  {
    key: 'line-mtwr6ypp',
    type: 'line' as const,
    x: 44,
    y: 180,
    props: { length: 73, rotation: 0, followRotate: 0 },
  },
  {
    key: 'circle-mtwqtfmd',
    type: 'circle' as const,
    x: 24,
    y: 199,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'line-mtwqw05z',
    type: 'line' as const,
    x: 26,
    y: 205,
    props: { length: 88, rotation: 0, followRotate: 0 },
  },
  {
    key: 'circle-mtwrf6uf',
    type: 'circle' as const,
    x: 6,
    y: 218,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'circle-mtwr7cva',
    type: 'circle' as const,
    x: 40,
    y: 254,
    props: { radius: 6, clockwise: true, followRotate: 0 },
  },
  {
    key: 'circle-mtwregzb',
    type: 'circle' as const,
    x: 20,
    y: 295,
    props: { radius: 8, clockwise: true, followRotate: 0 },
  },
] as const

function partDrawId(key: string) {
  return `hero-tree-${key}`
}

interface HeroTickTreeProps {
  /** 前驱横线段 drawId；完成后从树顶开始依次绘制 */
  after?: string
}

/** 首页第一根刻度树（绘图板场景） */
export function HeroTickTree({ after }: HeroTickTreeProps) {
  return (
    <div className="hero-tick-tree" aria-hidden>
      {PARTS.map((part, i) => {
        const drawId = partDrawId(part.key)
        const partAfter = i === 0 ? after : partDrawId(PARTS[i - 1].key)
        return (
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
                drawId={drawId}
                after={partAfter}
              />
            ) : part.type === 'rhombus' ? (
              <RhombusDraw
                side={part.props.side}
                minAngle={part.props.minAngle}
                rotation={part.props.rotation}
                followRotate={part.props.followRotate}
                instant={part.props.instant}
                drawId={drawId}
                after={partAfter}
              />
            ) : (
              <CircleDraw
                radius={part.props.radius}
                clockwise={part.props.clockwise}
                followRotate={part.props.followRotate}
                drawId={drawId}
                after={partAfter}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
