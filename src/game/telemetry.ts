import type { CarState } from './car.ts'
import type { LevelManifest } from './track.ts'

export type TelemetryEventType =
  | 'checkpoint'
  | 'collision'
  | 'offroad'
  | 'reset'
  | 'lap'
  | 'style'
export type CheckpointGrade = 'gold' | 'silver' | 'bronze' | 'miss'
export type StyleRank = 'neutral' | 'clean' | 'drift' | 'risk'

export interface StyleAward {
  kind: 'clean' | 'drift'
  points: number
  multiplier: number
}

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
  checkpointScore: number
  styleScore: number
  styleCombo: number
  bestStyleCombo: number
  cleanDrivingSeconds: number
  styleRank: StyleRank
  styleAccumulator: number
  lastStyleAward?: StyleAward
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
    checkpointScore: 0,
    styleScore: 0,
    styleCombo: 0,
    bestStyleCombo: 0,
    cleanDrivingSeconds: 0,
    styleRank: 'neutral',
    styleAccumulator: 0,
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

  const styleAward = updateStyleScoring(telemetry, car, dt, collided)
  if (styleAward > 0 && shouldEmitSparseEvent(telemetry, 'style', 1.1)) {
    const award = telemetry.lastStyleAward
    pushTelemetryEvent(
      telemetry,
      car,
      'style',
      award
        ? `${award.kind.toUpperCase()} +${award.points} x${award.multiplier.toFixed(1)}`
        : `STYLE +${styleAward}`,
    )
  }

  const checkpointIndex = telemetry.nextCheckpointIndex
  const checkpoint = level.checkpoints[checkpointIndex]
  if (checkpoint !== undefined && car.distance >= checkpoint + level.totalLength * telemetry.currentLap) {
    const split = createCheckpointSplit(telemetry, level, car, checkpointIndex, checkpoint)
    telemetry.checkpointSplits.push(split)
    if (telemetry.checkpointSplits.length > 16) {
      telemetry.checkpointSplits.shift()
    }
    telemetry.lastCheckpoint = split
    telemetry.collisionCountAtLastCheckpoint = car.collisionCount
    telemetry.offroadTimeAtLastCheckpoint = telemetry.offroadTime
    pushTelemetryEvent(
      telemetry,
      car,
      'checkpoint',
      `CP ${checkpointIndex + 1} ${split.grade.toUpperCase()} ${formatSigned(split.deltaSeconds)}s`,
    )
    telemetry.checkpointScore = split.cumulativeScore
    telemetry.score = telemetry.checkpointScore + telemetry.styleScore
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
  telemetry.checkpointScore = 0
  telemetry.styleScore = 0
  telemetry.styleCombo = 0
  telemetry.bestStyleCombo = 0
  telemetry.cleanDrivingSeconds = 0
  telemetry.styleRank = 'neutral'
  telemetry.styleAccumulator = 0
  telemetry.score = 0
  delete telemetry.lastStyleAward
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
    cumulativeScore: telemetry.checkpointScore + score,
    collisionPenalty,
    offroadPenaltySeconds,
  }
}

function updateStyleScoring(
  telemetry: TelemetryState,
  car: CarState,
  dt: number,
  collided: boolean,
): number {
  if (collided || car.offroad) {
    telemetry.styleCombo = 0
    telemetry.cleanDrivingSeconds = 0
    telemetry.styleAccumulator = 0
    telemetry.styleRank = car.offroad ? 'risk' : 'neutral'
    delete telemetry.lastStyleAward
    return 0
  }

  telemetry.cleanDrivingSeconds += dt

  const driftIntensity = Math.abs(car.drift)
  const speedRatio = clamp(car.speed / 110, 0, 1.25)
  const controlledDrift = car.speed >= 52 && driftIntensity >= 0.24
  const cleanLine = car.speed >= 70 && Math.abs(car.lateral) <= 4.6
  const comboMultiplier = 1 + Math.min(1.25, telemetry.styleCombo / 900)

  let pointsPerSecond = 0
  let kind: StyleAward['kind'] | undefined

  if (controlledDrift) {
    pointsPerSecond = (26 + driftIntensity * 88) * speedRatio
    telemetry.styleRank = 'drift'
    kind = 'drift'
  } else if (cleanLine) {
    pointsPerSecond = Math.min(34, 10 + telemetry.cleanDrivingSeconds * 3.2) * speedRatio
    telemetry.styleRank = 'clean'
    kind = 'clean'
  } else {
    telemetry.styleRank = 'neutral'
  }

  telemetry.styleAccumulator += pointsPerSecond * comboMultiplier * dt
  const points = Math.floor(telemetry.styleAccumulator)

  if (points <= 0 || !kind) {
    telemetry.score = telemetry.checkpointScore + telemetry.styleScore
    return 0
  }

  telemetry.styleAccumulator -= points
  telemetry.styleScore += points
  telemetry.styleCombo += points
  telemetry.bestStyleCombo = Math.max(telemetry.bestStyleCombo, telemetry.styleCombo)
  telemetry.score = telemetry.checkpointScore + telemetry.styleScore
  telemetry.lastStyleAward = {
    kind,
    points,
    multiplier: comboMultiplier,
  }

  return points
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
