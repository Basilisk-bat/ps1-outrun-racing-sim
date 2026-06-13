import type { CarState } from './car.ts'
import type { LevelManifest } from './track.ts'

export type TelemetryEventType = 'checkpoint' | 'collision' | 'offroad' | 'reset' | 'lap'

export interface TelemetryEvent {
  type: TelemetryEventType
  at: number
  distance: number
  speed: number
  details?: string
}

export interface TelemetryState {
  events: TelemetryEvent[]
  elapsed: number
  topSpeed: number
  offroadTime: number
  nextCheckpointIndex: number
  currentLap: number
}

export function createTelemetryState(): TelemetryState {
  return {
    events: [],
    elapsed: 0,
    topSpeed: 0,
    offroadTime: 0,
    nextCheckpointIndex: 0,
    currentLap: 0,
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

  const checkpoint = level.checkpoints[telemetry.nextCheckpointIndex]
  if (checkpoint !== undefined && car.distance >= checkpoint + level.totalLength * telemetry.currentLap) {
    pushTelemetryEvent(telemetry, car, 'checkpoint', `CP ${telemetry.nextCheckpointIndex + 1}`)
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
  pushTelemetryEvent(telemetry, car, 'reset')
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
