import { useCallback, useEffect, useRef, useState } from 'react'
import { RhombusDraw } from './RhombusDraw'
import { CubeDraw } from './superCubeDraw/CubeDraw'
import { HypercubeDraw } from './superCubeDraw/HypercubeDraw'
import { PenteractDraw } from './superCubeDraw/PenteractDraw'
import { DimEjectFlight } from './superCubeDraw/DimEjectFlight'
import {
  buildCubeTargetSegs,
  buildHypercubeTargetSegs,
  buildSquareTargetSegs,
} from './superCubeDraw/dimEjectTargets'
import {
  captureEjectSegs,
  offsetSegs,
  type DimPoseAngles,
  type Seg2,
} from './superCubeDraw/dimPoseBridge'
import { DIM_SIZE, framePx } from './superCubeDraw/dimSize'
import {
  CUBE_LAND,
  EJECT_SETTLE_MS,
  HYPERCUBE_LAND,
} from './superCubeDraw/dimEjectPhase'
import { DIM_GREEN } from './superCubeDraw/dimColors'
import { clearDrawComplete, subscribeDrawComplete } from './sceneRegistry'

type Phase =
  | 'draw5'
  | 'fly4'
  | 'show4'
  | 'fly3'
  | 'show3'
  | 'fly2'
  | 'show2'
  | 'done'

const FLY_MS = 1100
const SLOT_GAP = 48
const SLOT_PAD_X = 20

const FRAME = {
  d2: framePx('d2'),
  d3: framePx('d3'),
  d4: framePx('d4'),
  d5: framePx('d5'),
} as const

const SIZE = {
  d2: DIM_SIZE.d2,
  d3: DIM_SIZE.d3,
  d4: DIM_SIZE.d4,
  d5: DIM_SIZE.d5,
} as const

const MARK_H = FRAME.d5
const MARK_W =
  SLOT_PAD_X * 2 +
  FRAME.d2 +
  FRAME.d3 +
  FRAME.d4 +
  FRAME.d5 +
  SLOT_GAP * 3

/** 水平中线对齐；外接框比例 1 : √3 : 3 : 3√3 */
const SLOT = {
  d2: {
    left: SLOT_PAD_X,
    top: Math.round((MARK_H - FRAME.d2) / 2),
  },
  d3: {
    left: SLOT_PAD_X + FRAME.d2 + SLOT_GAP,
    top: Math.round((MARK_H - FRAME.d3) / 2),
  },
  d4: {
    left: SLOT_PAD_X + FRAME.d2 + FRAME.d3 + SLOT_GAP * 2,
    top: Math.round((MARK_H - FRAME.d4) / 2),
  },
  d5: {
    left: SLOT_PAD_X + FRAME.d2 + FRAME.d3 + FRAME.d4 + SLOT_GAP * 3,
    top: Math.round((MARK_H - FRAME.d5) / 2),
  },
} as const

interface Flight {
  from: Seg2[]
  to: Seg2[]
  spin: number
}

/** 落地 to = 真组件首帧外形；initialPose 与之一致 */
export function TopologyMark() {
  const [phase, setPhase] = useState<Phase>('draw5')
  const [flight, setFlight] = useState<Flight | null>(null)
  const [pose4, setPose4] = useState<DimPoseAngles | null>(null)
  const [pose3, setPose3] = useState<DimPoseAngles | null>(null)
  const phaseRef = useRef<Phase>('draw5')
  const busyRef = useRef(false)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    return () => {
      ;['topo-5', 'topo-4', 'topo-3', 'topo-2'].forEach(clearDrawComplete)
    }
  }, [])

  const startFly4 = useCallback(async () => {
    if (busyRef.current || phaseRef.current !== 'draw5') return
    busyRef.current = true
    // 绘制完成后等待 1s，此时 5 维相位到达可弹出姿态
    await new Promise((r) => setTimeout(r, EJECT_SETTLE_MS))
    if (phaseRef.current !== 'draw5') {
      busyRef.current = false
      return
    }
    const snap = await captureEjectSegs('d5', SLOT.d5)
    if (!snap?.segs.length) {
      busyRef.current = false
      setPhase('show4')
      return
    }
    const landPose: DimPoseAngles = { ...HYPERCUBE_LAND }
    const target = buildHypercubeTargetSegs(SIZE.d4, landPose)
    setPose4(landPose)
    setFlight({
      from: snap.segs,
      to: offsetSegs(target.segs, SLOT.d4.left, SLOT.d4.top),
      spin: 0,
    })
    setPhase('fly4')
  }, [])

  const startFly3 = useCallback(async () => {
    if (busyRef.current || phaseRef.current !== 'show4') return
    busyRef.current = true
    await new Promise((r) => setTimeout(r, EJECT_SETTLE_MS))
    if (phaseRef.current !== 'show4') {
      busyRef.current = false
      return
    }
    const snap = await captureEjectSegs('d4', SLOT.d4)
    if (!snap?.segs.length) {
      busyRef.current = false
      setPhase('show3')
      return
    }
    const landPose: DimPoseAngles = { ...CUBE_LAND }
    const target = buildCubeTargetSegs(SIZE.d3, landPose)
    setPose3(landPose)
    setFlight({
      from: snap.segs,
      to: offsetSegs(target.segs, SLOT.d3.left, SLOT.d3.top),
      spin: 0,
    })
    setPhase('fly3')
  }, [])

  const startFly2 = useCallback(async () => {
    if (busyRef.current || phaseRef.current !== 'show3') return
    busyRef.current = true
    await new Promise((r) => setTimeout(r, EJECT_SETTLE_MS))
    if (phaseRef.current !== 'show3') {
      busyRef.current = false
      return
    }
    const snap = await captureEjectSegs('d3', SLOT.d3)
    if (!snap?.segs.length) {
      busyRef.current = false
      setPhase('show2')
      return
    }
    const target = buildSquareTargetSegs(SIZE.d2, 45, 90)
    setFlight({
      from: snap.segs,
      to: offsetSegs(target.segs, SLOT.d2.left, SLOT.d2.top),
      spin: 0,
    })
    setPhase('fly2')
  }, [])

  useEffect(() => {
    return subscribeDrawComplete('topo-5', () => {
      void startFly4()
    })
  }, [startFly4])

  useEffect(() => {
    return subscribeDrawComplete('topo-4', () => {
      void startFly3()
    })
  }, [startFly3])

  useEffect(() => {
    return subscribeDrawComplete('topo-3', () => {
      void startFly2()
    })
  }, [startFly2])

  useEffect(() => {
    return subscribeDrawComplete('topo-2', () => setPhase('done'))
  }, [])

  const onFly4Done = useCallback(() => {
    setFlight(null)
    busyRef.current = false
    setPhase('show4')
  }, [])

  const onFly3Done = useCallback(() => {
    setFlight(null)
    busyRef.current = false
    setPhase('show3')
  }, [])

  const onFly2Done = useCallback(() => {
    setFlight(null)
    busyRef.current = false
    setPhase('show2')
  }, [])

  const show4 =
    phase === 'show4' ||
    phase === 'fly3' ||
    phase === 'show3' ||
    phase === 'fly2' ||
    phase === 'show2' ||
    phase === 'done'
  const show3 =
    phase === 'show3' || phase === 'fly2' || phase === 'show2' || phase === 'done'
  const show2 = phase === 'show2' || phase === 'done'

  return (
    <div
      className="topology-mark"
      style={{ width: MARK_W, height: MARK_H }}
      aria-label="多维结构拓扑全状态可视化"
    >
      <div className="topology-mark-item" style={{ left: SLOT.d5.left, top: SLOT.d5.top }}>
        <PenteractDraw size={SIZE.d5} drawId="topo-5" followRotate={0} />
      </div>

      {show4 ? (
        <div className="topology-mark-item" style={{ left: SLOT.d4.left, top: SLOT.d4.top }}>
          <HypercubeDraw
            size={SIZE.d4}
            drawId="topo-4"
            followRotate={0}
            instant
            initialPose={pose4 ?? undefined}
          />
        </div>
      ) : null}

      {show3 ? (
        <div className="topology-mark-item" style={{ left: SLOT.d3.left, top: SLOT.d3.top }}>
          <CubeDraw
            size={SIZE.d3}
            drawId="topo-3"
            followRotate={0}
            instant
            initialPose={pose3 ?? undefined}
          />
        </div>
      ) : null}

      {show2 ? (
        <div className="topology-mark-item" style={{ left: SLOT.d2.left, top: SLOT.d2.top }}>
          <RhombusDraw
            side={SIZE.d2}
            minAngle={90}
            rotation={45}
            drawId="topo-2"
            followRotate={0}
            instant
            strokeColor={DIM_GREEN}
          />
        </div>
      ) : null}

      {flight && (phase === 'fly4' || phase === 'fly3' || phase === 'fly2') ? (
        <DimEjectFlight
          key={phase}
          width={MARK_W}
          height={MARK_H}
          fromSegs={flight.from}
          toSegs={flight.to}
          spinDeg={flight.spin}
          durationMs={FLY_MS}
          onDone={
            phase === 'fly4' ? onFly4Done : phase === 'fly3' ? onFly3Done : onFly2Done
          }
        />
      ) : null}
    </div>
  )
}
