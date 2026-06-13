import { createInitialCarState, resetCar, updateCar } from './car.ts'
import type { InputState } from './input.ts'
import {
  checkpointTargetSeconds as routeCheckpointTargetSeconds,
  createProceduralTrack,
  currentRouteSection,
  DEFAULT_ROUTE_DIFFICULTY,
  nextCheckpoint,
  sampleTrack,
} from './track.ts'
import {
  createTelemetryState,
  resetTelemetry,
  updateTelemetry,
} from './telemetry.ts'
import {
  createTrafficRuntimeState,
  createTrafficSnapshot,
  resetTrafficRuntimeState,
  resolveTrafficContact,
} from './traffic.ts'
import type { CarState } from './car.ts'
import type {
  LevelManifest,
  ProceduralTrackOptions,
  RouteDifficultyId,
  RouteSection,
  TrackSample,
} from './track.ts'
import type { TelemetryState } from './telemetry.ts'
import type { TrafficRuntimeState, TrafficSnapshot } from './traffic.ts'

export interface RacingSnapshot {
  car: CarState
  level: LevelManifest
  track: TrackSample
  currentSection: RouteSection
  telemetry: TelemetryState
  traffic: TrafficSnapshot
  nextCheckpoint: number
  checkpointTargetSeconds: number
}

export class RacingSim {
  readonly level: LevelManifest
  readonly car = createInitialCarState()
  readonly telemetry = createTelemetryState()
  readonly traffic: TrafficRuntimeState = createTrafficRuntimeState()

  constructor(
    difficultyId: RouteDifficultyId = DEFAULT_ROUTE_DIFFICULTY,
    trackOptions: Omit<ProceduralTrackOptions, 'difficultyId'> = {},
  ) {
    this.level = createProceduralTrack({ difficultyId, ...trackOptions })
  }

  step(input: InputState, dt: number): RacingSnapshot {
    const track = sampleTrack(this.level, this.car.distance)
    const roadContact = updateCar(this.car, input, track, dt)
    const trafficContact = resolveTrafficContact(
      this.traffic,
      this.level,
      this.car,
      this.telemetry.elapsed + dt,
    )
    const collided = roadContact.collided || trafficContact.collided
    updateTelemetry(
      this.telemetry,
      this.level,
      this.car,
      dt,
      collided,
      trafficContact.vehicle ? `TRAFFIC ${trafficContact.vehicle.id}` : undefined,
    )

    return this.snapshot()
  }

  reset(): RacingSnapshot {
    resetCar(this.car)
    resetTelemetry(this.telemetry, this.car)
    resetTrafficRuntimeState(this.traffic)
    return this.snapshot()
  }

  snapshot(): RacingSnapshot {
    return {
      car: this.car,
      level: this.level,
      track: sampleTrack(this.level, this.car.distance),
      currentSection: currentRouteSection(this.level, this.car.distance),
      telemetry: this.telemetry,
      traffic: createTrafficSnapshot(this.level, this.car, this.telemetry.elapsed, this.traffic),
      nextCheckpoint: nextCheckpoint(this.level, this.car.distance),
      checkpointTargetSeconds: cumulativeCheckpointTargetSeconds(
        this.level,
        this.car.distance,
        this.telemetry.currentLap,
      ),
    }
  }
}

function cumulativeCheckpointTargetSeconds(
  level: LevelManifest,
  distance: number,
  currentLap: number,
): number {
  return routeCheckpointTargetSeconds(level, distance) + currentLap * level.targetTimeSeconds
}
