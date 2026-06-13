import type { InputState } from './input.ts'
import { RacingSim } from './sim.ts'
import type { RacingSnapshot } from './sim.ts'
import type { CheckpointGrade, CheckpointSplit } from './telemetry.ts'

export type PaceVerdict = 'too-fast' | 'on-pace' | 'too-slow' | 'incomplete'

export interface TraceSample {
  elapsed: number
  distance: number
  speed: number
  lateral: number
  sectionId: string
  offroad: boolean
  collisions: number
  score: number
  styleScore: number
}

export interface CalibrationSummary {
  elapsed: number
  completedLaps: number
  completedCheckpoints: number
  finalDistance: number
  topSpeed: number
  collisions: number
  offroadTime: number
  score: number
  checkpointScore: number
  styleScore: number
  bestStyleCombo: number
  averageDeltaSeconds: number | null
  worstDeltaSeconds: number | null
  bestDeltaSeconds: number | null
  paceVerdict: PaceVerdict
  gradeCounts: Record<CheckpointGrade, number>
}

export interface CalibrationTrace {
  samples: TraceSample[]
  checkpoints: CheckpointSplit[]
  summary: CalibrationSummary
}

export interface CalibrationTraceOptions {
  maxSeconds?: number
  fixedDt?: number
  sampleEverySeconds?: number
  targetSpeed?: number
}

const DEFAULT_MAX_SECONDS = 52
const DEFAULT_FIXED_DT = 1 / 60
const DEFAULT_SAMPLE_EVERY_SECONDS = 0.5
const DEFAULT_TARGET_SPEED = 88

export function runCalibrationTrace(
  options: CalibrationTraceOptions = {},
): CalibrationTrace {
  const maxSeconds = options.maxSeconds ?? DEFAULT_MAX_SECONDS
  const fixedDt = options.fixedDt ?? DEFAULT_FIXED_DT
  const sampleEverySeconds = options.sampleEverySeconds ?? DEFAULT_SAMPLE_EVERY_SECONDS
  const targetSpeed = options.targetSpeed ?? DEFAULT_TARGET_SPEED
  const sim = new RacingSim()
  const samples: TraceSample[] = []
  let nextSampleAt = 0
  let snapshot = sim.snapshot()

  while (snapshot.telemetry.elapsed < maxSeconds && snapshot.telemetry.currentLap < 1) {
    const input = createCalibrationInput(snapshot, targetSpeed)
    snapshot = sim.step(input, fixedDt)

    if (snapshot.telemetry.elapsed + fixedDt * 0.5 >= nextSampleAt) {
      samples.push(createTraceSample(snapshot))
      nextSampleAt += sampleEverySeconds
    }
  }

  return {
    samples,
    checkpoints: [...snapshot.telemetry.checkpointSplits],
    summary: createCalibrationSummary(snapshot),
  }
}

function createCalibrationInput(
  snapshot: RacingSnapshot,
  targetSpeed: number,
): InputState {
  const curveFeedForward = snapshot.track.curve * 0.92
  const centerCorrection = -snapshot.car.lateral * 0.24
  const damping = -snapshot.car.lateralVelocity * 0.08
  const steerDemand = curveFeedForward + centerCorrection + damping
  const speedError = targetSpeed - snapshot.car.speed

  return {
    accelerate: speedError > -2,
    brake: speedError < -8 || Math.abs(snapshot.car.lateral) > snapshot.track.roadWidth * 0.55,
    steer: quantizeSteer(steerDemand),
    reset: false,
  }
}

function createTraceSample(snapshot: RacingSnapshot): TraceSample {
  return {
    elapsed: round(snapshot.telemetry.elapsed),
    distance: round(snapshot.car.distance),
    speed: round(snapshot.car.speed),
    lateral: round(snapshot.car.lateral),
    sectionId: snapshot.currentSection.id,
    offroad: snapshot.car.offroad,
    collisions: snapshot.car.collisionCount,
    score: snapshot.telemetry.score,
    styleScore: snapshot.telemetry.styleScore,
  }
}

function createCalibrationSummary(snapshot: RacingSnapshot): CalibrationSummary {
  const checkpoints = snapshot.telemetry.checkpointSplits
  const deltas = checkpoints.map((checkpoint) => checkpoint.deltaSeconds)
  const averageDeltaSeconds =
    deltas.length > 0 ? deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length : null
  const worstDeltaSeconds = deltas.length > 0 ? Math.max(...deltas) : null
  const bestDeltaSeconds = deltas.length > 0 ? Math.min(...deltas) : null

  return {
    elapsed: round(snapshot.telemetry.elapsed),
    completedLaps: snapshot.telemetry.currentLap,
    completedCheckpoints: checkpoints.length,
    finalDistance: round(snapshot.car.distance),
    topSpeed: round(snapshot.telemetry.topSpeed),
    collisions: snapshot.car.collisionCount,
    offroadTime: round(snapshot.telemetry.offroadTime),
    score: snapshot.telemetry.score,
    checkpointScore: snapshot.telemetry.checkpointScore,
    styleScore: snapshot.telemetry.styleScore,
    bestStyleCombo: snapshot.telemetry.bestStyleCombo,
    averageDeltaSeconds: nullableRound(averageDeltaSeconds),
    worstDeltaSeconds: nullableRound(worstDeltaSeconds),
    bestDeltaSeconds: nullableRound(bestDeltaSeconds),
    paceVerdict: classifyPace(snapshot, averageDeltaSeconds),
    gradeCounts: countGrades(checkpoints),
  }
}

function classifyPace(
  snapshot: RacingSnapshot,
  averageDeltaSeconds: number | null,
): PaceVerdict {
  if (snapshot.telemetry.currentLap < 1) {
    return 'incomplete'
  }
  if (averageDeltaSeconds === null) {
    return 'incomplete'
  }
  if (averageDeltaSeconds < -3) {
    return 'too-fast'
  }
  if (averageDeltaSeconds > 4) {
    return 'too-slow'
  }
  return 'on-pace'
}

function countGrades(checkpoints: CheckpointSplit[]): Record<CheckpointGrade, number> {
  return checkpoints.reduce<Record<CheckpointGrade, number>>(
    (counts, checkpoint) => {
      counts[checkpoint.grade] += 1
      return counts
    },
    {
      gold: 0,
      silver: 0,
      bronze: 0,
      miss: 0,
    },
  )
}

function nullableRound(value: number | null): number | null {
  return value === null ? null : round(value)
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function quantizeSteer(value: number): InputState['steer'] {
  if (value > 0.12) {
    return 1
  }
  if (value < -0.12) {
    return -1
  }
  return 0
}
