import type { CarState } from './car.ts'
import type { LevelManifest } from './track.ts'

export type TelemetryEventType = 'checkpoint' | 'collision' | 'offroad' | 'reset' | 'lap'
export type CheckpointGrade = 'gold' | 'silver' | 'bronze' | 'miss'

export interface TelemetryEvent {
  type: TelemetryEventType
  at: number
  distance: number
  speed: number
  details?: string
}

export interface CheckpointSplit {
  checkpointIndex: number
  lap: number
  checkpointDistance: number
  sectionId: string
  sectionTitle: string
  targetSeconds: number
  actualSeconds: number
  deltaSeconds: number
  grade: CheckpointGrade
  score: number
  cumulativeScore: number
  collisionPenalty: number
  offroadPenaltySeconds: number
}

export interface TelemetryState {
  events: TelemetryEvent[]
  elapsed: number
  topSpeed: number
  offroadTime: number
  nextCheckpointIndex: number
  currentLap: number
  checkpointSplits: CheckpointSplit[]
  score: number
  lastCheckpoint?: CheckpointSplit
  collisionCountAtLastCheckpoint: number
  offroadTimeAtLastCheckpoint: number
}

const SCORE_BY_GRADE: Record<CheckpointGrade, number> = {
  gold: 1000,
  silver: 760,
  bronze: 520,
  miss: 250,
}

export function createTelemetryState(): TelemetryState {
  return {
    events: [],
    elapsed: 0,
    topSpeed: 0,
    offroadTime: 0,
    nextCheckpointIndex: 0,
    currentLap: 0,
    checkpointSplits: [],
    score: 0,
    collisionCountAtLastCheckpoint: 0,
    offroadTimeAtLastCheckpoint: 0,
  }
}

export function updateTelemetry(
  telemetry: TelemetryState,
  level: LevelManifest,
  car: CarState,
  dt: number,
  collided: boolean,
): void {
  telemetry.elapsed += dt
  telemetry.topSpeed = Math.max(telemetry.topSpeed, car.speed)

  if (car.offroad) {
    telemetry.offroadTime += dt
    if (shouldEmitSparseEvent(telemetry, 'offroad', 1.2)) {
      pushTelemetryEvent(telemetry, car, 'offroad')
    }
  }

  if (collided) {
    pushTelemetryEvent(telemetry, car, 'collision')
  }

  const checkpointIndex = telemetry.nextCheckpointIndex
  const checkpoint = level.checkpoints[checkpointIndex]
  if (checkpoint !== undefined && car.distance >= checkpoint + level.totalLength * telemetry.currentLap) {
    const split = createCheckpointSplit(telemetry, level, car, checkpointIndex, checkpoint)
    telemetry.checkpointSplits.push(split)
    if (telemetry.checkpointSplits.length > 16) {
      telemetry.checkpointSplits.shift()
    }
    telemetry.score = split.cumulativeScore
    telemetry.lastCheckpoint = split
    telemetry.collisionCountAtLastCheckpoint = car.collisionCount
    telemetry.offroadTimeAtLastCheckpoint = telemetry.offroadTime
    pushTelemetryEvent(
      telemetry,
      car,
      'checkpoint',
      `CP ${checkpointIndex + 1} ${split.grade.toUpperCase()} ${formatSigned(split.deltaSeconds)}s`,
    )
    telemetry.nextCheckpointIndex += 1
  }

  if (car.distance >= level.totalLength * (telemetry.currentLap + 1)) {
    telemetry.currentLap += 1
    telemetry.nextCheckpointIndex = 0
    pushTelemetryEvent(telemetry, car, 'lap', `LAP ${telemetry.currentLap}`)
  }
}

export function pushTelemetryEvent(
  telemetry: TelemetryState,
  car: CarState,
  type: TelemetryEventType,
  details?: string,
): void {
  telemetry.events.push({
    type,
    at: telemetry.elapsed,
    distance: car.distance,
    speed: car.speed,
    details,
  })

  if (telemetry.events.length > 24) {
    telemetry.events.shift()
  }
}

export function resetTelemetry(telemetry: TelemetryState, car: CarState): void {
  telemetry.events = []
  telemetry.elapsed = 0
  telemetry.topSpeed = 0
  telemetry.offroadTime = 0
  telemetry.nextCheckpointIndex = 0
  telemetry.currentLap = 0
  telemetry.checkpointSplits = []
  telemetry.score = 0
  delete telemetry.lastCheckpoint
  telemetry.collisionCountAtLastCheckpoint = 0
  telemetry.offroadTimeAtLastCheckpoint = 0
  pushTelemetryEvent(telemetry, car, 'reset')
}

export function gradeCheckpoint(deltaSeconds: number): CheckpointGrade {
  if (deltaSeconds <= 0) {
    return 'gold'
  }
  if (deltaSeconds <= 2.5) {
    return 'silver'
  }
  if (deltaSeconds <= 5) {
    return 'bronze'
  }
  return 'miss'
}

export function scoreCheckpoint(
  deltaSeconds: number,
  collisionPenalty: number,
  offroadPenaltySeconds: number,
): number {
  const grade = gradeCheckpoint(deltaSeconds)
  const latePenalty = Math.max(0, Math.round(deltaSeconds * 32))
  const controlPenalty = collisionPenalty * 75 + Math.round(offroadPenaltySeconds * 14)
  return Math.max(100, SCORE_BY_GRADE[grade] - latePenalty - controlPenalty)
}

function createCheckpointSplit(
  telemetry: TelemetryState,
  level: LevelManifest,
  car: CarState,
  checkpointIndex: number,
  checkpointDistance: number,
): CheckpointSplit {
  const section = level.sections[checkpointIndex]
  const lapTargetOffset = telemetry.currentLap * level.targetTimeSeconds
  const targetSeconds = (section?.targetSeconds ?? level.targetTimeSeconds) + lapTargetOffset
  const deltaSeconds = telemetry.elapsed - targetSeconds
  const collisionPenalty = car.collisionCount - telemetry.collisionCountAtLastCheckpoint
  const offroadPenaltySeconds = telemetry.offroadTime - telemetry.offroadTimeAtLastCheckpoint
  const score = scoreCheckpoint(deltaSeconds, collisionPenalty, offroadPenaltySeconds)

  return {
    checkpointIndex,
    lap: telemetry.currentLap + 1,
    checkpointDistance,
    sectionId: section?.id ?? `checkpoint-${checkpointIndex + 1}`,
    sectionTitle: section?.title ?? `Checkpoint ${checkpointIndex + 1}`,
    targetSeconds,
    actualSeconds: telemetry.elapsed,
    deltaSeconds,
    grade: gradeCheckpoint(deltaSeconds),
    score,
    cumulativeScore: telemetry.score + score,
    collisionPenalty,
    offroadPenaltySeconds,
  }
}

function shouldEmitSparseEvent(
  telemetry: TelemetryState,
  type: TelemetryEventType,
  minGap: number,
): boolean {
  const previous = [...telemetry.events]
    .reverse()
    .find((event) => event.type === type)
  return !previous || telemetry.elapsed - previous.at >= minGap
}

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}`
}
