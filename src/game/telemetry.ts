import type { CarState } from './car.ts'
import { currentDriftZone, ROUTE_DIFFICULTY_PROFILES } from './track.ts'
import type { LevelManifest, RouteDifficultyProfile } from './track.ts'

export type TelemetryEventType =
  | 'checkpoint'
  | 'boost'
  | 'collision'
  | 'near-miss'
  | 'offroad'
  | 'reset'
  | 'lap'
  | 'style'
  | 'drift-zone'
  | 'time-extend'
  | 'time-over'
export type CheckpointGrade = 'gold' | 'silver' | 'bronze' | 'miss'
export type StyleRank = 'neutral' | 'clean' | 'drift' | 'risk' | 'near-miss'
export type RivalStatus = 'ahead' | 'even' | 'pressure'

export interface StyleAward {
  kind: 'clean' | 'drift' | 'near-miss' | 'zone'
  points: number
  multiplier: number
}

export interface DriftZoneResult {
  zoneId: string
  sectionId: string
  title: string
  score: number
  targetScore: number
  cleared: boolean
  bonusScore: number
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
  driftZoneScore: number
  activeDriftZoneId?: string
  activeDriftZoneTitle: string
  activeDriftZoneScore: number
  activeDriftZoneTarget: number
  completedDriftZones: DriftZoneResult[]
  lastDriftZoneResult?: DriftZoneResult
  rivalGapMeters: number
  rivalPressure: number
  rivalStatus: RivalStatus
  timeRemaining: number
  timeExtendedSeconds: number
  raceExpired: boolean
  lastArcadeBanner: string
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
const TIME_EXTENSION_BY_GRADE: Record<CheckpointGrade, number> = {
  gold: 7,
  silver: 5,
  bronze: 3,
  miss: 1.5,
}
export const ARCADE_START_TIME_SECONDS = 42
const DEFAULT_DIFFICULTY_PROFILE = ROUTE_DIFFICULTY_PROFILES.arcade

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
    driftZoneScore: 0,
    activeDriftZoneTitle: 'OPEN ROAD',
    activeDriftZoneScore: 0,
    activeDriftZoneTarget: 0,
    completedDriftZones: [],
    rivalGapMeters: 0,
    rivalPressure: 0,
    rivalStatus: 'even',
    timeRemaining: ARCADE_START_TIME_SECONDS,
    timeExtendedSeconds: 0,
    raceExpired: false,
    lastArcadeBanner: 'ROLLING START',
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
  collisionDetails?: string,
  nearMissDetails?: string,
): void {
  telemetry.elapsed += dt
  if (!telemetry.raceExpired) {
    telemetry.timeRemaining = Math.max(0, telemetry.timeRemaining - dt)
  }
  telemetry.topSpeed = Math.max(telemetry.topSpeed, car.speed)

  if (car.offroad) {
    telemetry.offroadTime += dt
    if (shouldEmitSparseEvent(telemetry, 'offroad', 1.2)) {
      pushTelemetryEvent(telemetry, car, 'offroad')
    }
  }

  if (collided) {
    telemetry.lastArcadeBanner = 'RECOVER'
    pushTelemetryEvent(telemetry, car, 'collision', collisionDetails)
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
  updateRivalPressure(telemetry, level, car)
  updateDriftZoneScoring(telemetry, level, car, dt, collided)

  if (nearMissDetails) {
    const nearMissPoints = 150 + Math.round(Math.min(80, car.speed * 0.45))
    applyStyleAward(telemetry, 'near-miss', nearMissPoints, 1.4)
    telemetry.lastArcadeBanner = 'NEAR MISS'
    pushTelemetryEvent(telemetry, car, 'near-miss', `${nearMissDetails} +${nearMissPoints}`)
  }

  if (car.boostActive && shouldEmitSparseEvent(telemetry, 'boost', 1.15)) {
    telemetry.lastArcadeBanner = 'BOOST'
    pushTelemetryEvent(telemetry, car, 'boost', 'NITRO')
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
    extendArcadeTimer(telemetry, car, split)
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

  if (!telemetry.raceExpired && telemetry.timeRemaining <= 0) {
    telemetry.raceExpired = true
    telemetry.lastArcadeBanner = 'TIME OVER'
    pushTelemetryEvent(telemetry, car, 'time-over')
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
  telemetry.driftZoneScore = 0
  telemetry.activeDriftZoneTitle = 'OPEN ROAD'
  telemetry.activeDriftZoneScore = 0
  telemetry.activeDriftZoneTarget = 0
  telemetry.completedDriftZones = []
  telemetry.rivalGapMeters = 0
  telemetry.rivalPressure = 0
  telemetry.rivalStatus = 'even'
  delete telemetry.activeDriftZoneId
  delete telemetry.lastDriftZoneResult
  telemetry.timeRemaining = ARCADE_START_TIME_SECONDS
  telemetry.timeExtendedSeconds = 0
  telemetry.raceExpired = false
  telemetry.lastArcadeBanner = 'ROLLING START'
  delete telemetry.lastStyleAward
  delete telemetry.lastCheckpoint
  telemetry.collisionCountAtLastCheckpoint = 0
  telemetry.offroadTimeAtLastCheckpoint = 0
  pushTelemetryEvent(telemetry, car, 'reset')
}

function updateDriftZoneScoring(
  telemetry: TelemetryState,
  level: LevelManifest,
  car: CarState,
  dt: number,
  collided: boolean,
): void {
  const zone = currentDriftZone(level, car.distance)

  if (telemetry.activeDriftZoneId && telemetry.activeDriftZoneId !== zone?.id) {
    finalizeDriftZone(telemetry, car)
  }

  if (!zone) {
    telemetry.activeDriftZoneTitle = 'OPEN ROAD'
    telemetry.activeDriftZoneTarget = 0
    return
  }

  if (telemetry.activeDriftZoneId !== zone.id) {
    telemetry.activeDriftZoneId = zone.id
    telemetry.activeDriftZoneTitle = zone.title
    telemetry.activeDriftZoneScore = 0
    telemetry.activeDriftZoneTarget = zone.targetScore
    telemetry.lastArcadeBanner = `DRIFT ZONE ${zone.targetScore}`
    pushTelemetryEvent(telemetry, car, 'drift-zone', `ENTER ${zone.title}`)
  }

  if (collided || car.offroad || telemetry.raceExpired) {
    return
  }

  const driftIntensity = Math.abs(car.drift)
  if (car.speed < 42 || driftIntensity < 0.2) {
    return
  }

  const speedRatio = clamp(car.speed / 112, 0.65, 1.35)
  const zoneMultiplier = level.difficulty.id === 'rival' ? 1.18 : level.difficulty.id === 'touring' ? 0.9 : 1
  const points = Math.floor((28 + driftIntensity * 116) * speedRatio * zoneMultiplier * dt)

  if (points <= 0) {
    return
  }

  telemetry.activeDriftZoneScore += points
  telemetry.driftZoneScore += points
  applyStyleAward(telemetry, 'zone', points, 1.25)

  if (shouldEmitSparseEvent(telemetry, 'drift-zone', 1.25)) {
    pushTelemetryEvent(telemetry, car, 'drift-zone', `${zone.title} +${points}`)
  }
}

function finalizeDriftZone(telemetry: TelemetryState, car: CarState): void {
  const result: DriftZoneResult = {
    zoneId: telemetry.activeDriftZoneId ?? 'unknown-zone',
    sectionId: telemetry.activeDriftZoneId?.replace('-drift-zone', '') ?? 'unknown',
    title: telemetry.activeDriftZoneTitle,
    score: telemetry.activeDriftZoneScore,
    targetScore: telemetry.activeDriftZoneTarget,
    cleared: telemetry.activeDriftZoneScore >= telemetry.activeDriftZoneTarget,
    bonusScore: 0,
  }

  if (result.cleared) {
    result.bonusScore = Math.max(60, Math.round(result.targetScore * 0.55))
    applyStyleAward(telemetry, 'zone', result.bonusScore, 1.5)
    telemetry.lastArcadeBanner = `ZONE CLEAR +${result.bonusScore}`
  } else {
    telemetry.lastArcadeBanner = 'ZONE MISSED'
  }

  telemetry.completedDriftZones.push(result)
  if (telemetry.completedDriftZones.length > 16) {
    telemetry.completedDriftZones.shift()
  }
  telemetry.lastDriftZoneResult = result
  pushTelemetryEvent(
    telemetry,
    car,
    'drift-zone',
    `${result.cleared ? 'CLEAR' : 'MISS'} ${result.title} ${result.score}/${result.targetScore}`,
  )
  delete telemetry.activeDriftZoneId
  telemetry.activeDriftZoneTitle = 'OPEN ROAD'
  telemetry.activeDriftZoneScore = 0
  telemetry.activeDriftZoneTarget = 0
}

function updateRivalPressure(
  telemetry: TelemetryState,
  level: LevelManifest,
  car: CarState,
): void {
  const targetLap = Math.max(1, level.targetTimeSeconds)
  const lapElapsed = Math.max(0, telemetry.elapsed - telemetry.currentLap * targetLap)
  const rivalDistance =
    telemetry.currentLap * level.totalLength +
    clamp(lapElapsed / targetLap, 0, 1) * level.totalLength
  const gap = car.distance - rivalDistance

  telemetry.rivalGapMeters = Math.round(gap)
  telemetry.rivalPressure = Math.round(clamp((-gap + 90) / 1.8, 0, 100))
  telemetry.rivalStatus = gap >= 45 ? 'ahead' : gap <= -30 ? 'pressure' : 'even'

  if (telemetry.rivalStatus === 'pressure' && shouldEmitSparseEvent(telemetry, 'drift-zone', 4)) {
    telemetry.lastArcadeBanner = 'RIVAL PRESSURE'
  }
}

export function gradeCheckpoint(
  deltaSeconds: number,
  difficulty: RouteDifficultyProfile = DEFAULT_DIFFICULTY_PROFILE,
): CheckpointGrade {
  if (deltaSeconds <= 0) {
    return 'gold'
  }
  if (deltaSeconds <= difficulty.silverDeltaSeconds) {
    return 'silver'
  }
  if (deltaSeconds <= difficulty.bronzeDeltaSeconds) {
    return 'bronze'
  }
  return 'miss'
}

export function scoreCheckpoint(
  deltaSeconds: number,
  collisionPenalty: number,
  offroadPenaltySeconds: number,
  difficulty: RouteDifficultyProfile = DEFAULT_DIFFICULTY_PROFILE,
): number {
  const grade = gradeCheckpoint(deltaSeconds, difficulty)
  const latePenalty = Math.max(0, Math.round(deltaSeconds * difficulty.latePenaltyPerSecond))
  const controlPenalty = collisionPenalty * 75 + Math.round(offroadPenaltySeconds * 14)
  return Math.max(100, SCORE_BY_GRADE[grade] - latePenalty - controlPenalty)
}

function extendArcadeTimer(
  telemetry: TelemetryState,
  car: CarState,
  split: CheckpointSplit,
): void {
  const extension = TIME_EXTENSION_BY_GRADE[split.grade]
  telemetry.timeRemaining += extension
  telemetry.timeExtendedSeconds += extension
  telemetry.lastArcadeBanner = `${split.grade.toUpperCase()} CHECKPOINT +${formatTimeExtension(extension)}`
  pushTelemetryEvent(telemetry, car, 'time-extend', `+${formatTimeExtension(extension)}`)
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
  const grade = gradeCheckpoint(deltaSeconds, level.difficulty)
  const score = scoreCheckpoint(
    deltaSeconds,
    collisionPenalty,
    offroadPenaltySeconds,
    level.difficulty,
  )

  return {
    checkpointIndex,
    lap: telemetry.currentLap + 1,
    checkpointDistance,
    sectionId: section?.id ?? `checkpoint-${checkpointIndex + 1}`,
    sectionTitle: section?.title ?? `Checkpoint ${checkpointIndex + 1}`,
    targetSeconds,
    actualSeconds: telemetry.elapsed,
    deltaSeconds,
    grade,
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
  const speedRatio = clamp(car.speed / 104, 0, 1.35)
  const controlledDrift = car.speed >= 38 && driftIntensity >= 0.18
  const cleanLine = car.speed >= 74 && Math.abs(car.lateral) <= 5.2
  const comboMultiplier = 1 + Math.min(1.6, telemetry.styleCombo / 760)

  let pointsPerSecond = 0
  let kind: StyleAward['kind'] | undefined

  if (controlledDrift) {
    pointsPerSecond = (46 + driftIntensity * 142) * speedRatio
    telemetry.styleRank = 'drift'
    kind = 'drift'
  } else if (cleanLine) {
    pointsPerSecond = Math.min(22, 8 + telemetry.cleanDrivingSeconds * 2.4) * speedRatio
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

function applyStyleAward(
  telemetry: TelemetryState,
  kind: StyleAward['kind'],
  points: number,
  multiplier: number,
): void {
  telemetry.styleScore += points
  telemetry.styleCombo += points
  telemetry.bestStyleCombo = Math.max(telemetry.bestStyleCombo, telemetry.styleCombo)
  telemetry.score = telemetry.checkpointScore + telemetry.styleScore
  telemetry.lastStyleAward = {
    kind,
    points,
    multiplier,
  }
  telemetry.styleRank = kind === 'near-miss' ? 'near-miss' : telemetry.styleRank
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

function formatTimeExtension(value: number): string {
  return Number.isInteger(value) ? `${value}s` : `${value.toFixed(1)}s`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
