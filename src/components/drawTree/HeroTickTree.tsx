import { LineDraw } from './LineDraw'
import { RhombusDraw } from './RhombusDraw'
import { CircleDraw } from './CircleDraw'

/** 绘图板场景树；原点 (30, 34)。 */
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
    y: 28,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'line-mtwrwcg8',
    type: 'line' as const,
    x: 8,
    y: 33,
    props: { length: 46, rotation: 0, followRotate: 0 },
  },
  {
    key: 'line-mtwru98a',
    type: 'line' as const,
    x: 8,
    y: 52,
    props: { length: 70, rotation: 30, followRotate: 0 },
  },
  {
    key: 'rhombus-mtwqzr5z',
    type: 'rhombus' as const,
    x: 0,
    y: 78,
    props: { side: 16, minAngle: 60, rotation: 0, followRotate: 0, instant: true },
  },
  {
    key: 'circle-mtwryds1',
    type: 'circle' as const,
    x: 42,
    y: 92,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'rhombus-mtwqn84q',
    type: 'rhombus' as const,
    x: 14,
    y: 95,
    props: { side: 24, minAngle: 60, rotation: 0, followRotate: 0, instant: true },
  },
  {
    key: 'line-mtwrx6p2',
    type: 'line' as const,
    x: 44,
    y: 98,
    props: { length: 28, rotation: 0, followRotate: 0 },
  },
  {
    key: 'line-mtwqnnid',
    type: 'line' as const,
    x: 8,
    y: 117,
    props: { length: 72, rotation: 30, followRotate: 0 },
  },
  {
    key: 'line-mtwqy2t8',
    type: 'line' as const,
    x: 8,
    y: 118,
    props: { length: 32, rotation: 0, followRotate: 0 },
  },
  {
    key: 'rhombus-mtwqzz29',
    type: 'rhombus' as const,
    x: 36,
    y: 125,
    props: { side: 16, minAngle: 60, rotation: 0, followRotate: 0, instant: true },
  },
  {
    key: 'line-mtwqq2oa',
    type: 'line' as const,
    x: 26,
    y: 148,
    props: { length: 48, rotation: 0, followRotate: 0 },
  },
  {
    key: 'circle-mtwr5539',
    type: 'circle' as const,
    x: 6,
    y: 152,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'line-mtwrf1tz',
    type: 'line' as const,
    x: 8,
    y: 158,
    props: { length: 58, rotation: 0, followRotate: 0 },
  },
  {
    key: 'line-mtwr6ypp',
    type: 'line' as const,
    x: 44,
    y: 179,
    props: { length: 73, rotation: 0, followRotate: 0 },
  },
  {
    key: 'circle-mtwqtfmd',
    type: 'circle' as const,
    x: 24,
    y: 198,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'line-mtwqw05z',
    type: 'line' as const,
    x: 26,
    y: 204,
    props: { length: 88, rotation: 0, followRotate: 0 },
  },
  {
    key: 'circle-mtwrf6uf',
    type: 'circle' as const,
    x: 6,
    y: 217,
    props: { radius: 4, clockwise: true, followRotate: 0 },
  },
  {
    key: 'circle-mtwr7cva',
    type: 'circle' as const,
    x: 40,
    y: 253,
    props: { radius: 6, clockwise: true, followRotate: 0 },
  },
  {
    key: 'circle-mtwregzb',
    type: 'circle' as const,
    x: 20,
    y: 294,
    props: { radius: 8, clockwise: true, followRotate: 0 },
  },
] as const

/** 首页第一根刻度树（绘图板场景） */
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
          ) : part.type === 'rhombus' ? (
            <RhombusDraw
              side={part.props.side}
              minAngle={part.props.minAngle}
              rotation={part.props.rotation}
              followRotate={part.props.followRotate}
              instant={part.props.instant}
            />
          ) : (
            <CircleDraw
              radius={part.props.radius}
              clockwise={part.props.clockwise}
              followRotate={part.props.followRotate}
            />
          )}
        </div>
      ))}
    </div>
  )
}
