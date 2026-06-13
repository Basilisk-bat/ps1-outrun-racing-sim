import { createInitialCarState, resetCar, updateCar } from './car.ts'
import type { InputState } from './input.ts'
import {
  checkpointTargetSeconds,
  createNeonRidgeLevel,
  currentRouteSection,
  nextCheckpoint,
  sampleTrack,
} from './track.ts'
import {
  createTelemetryState,
  resetTelemetry,
  updateTelemetry,
} from './telemetry.ts'
import type { CarState } from './car.ts'
import type { LevelManifest, RouteSection, TrackSample } from './track.ts'
import type { TelemetryState } from './telemetry.ts'

export interface RacingSnapshot {
  car: CarState
  level: LevelManifest
  track: TrackSample
  currentSection: RouteSection
  telemetry: TelemetryState
  nextCheckpoint: number
  checkpointTargetSeconds: number
}

export class RacingSim {
  readonly level = createNeonRidgeLevel()
  readonly car = createInitialCarState()
  readonly telemetry = createTelemetryState()

  step(input: InputState, dt: number): RacingSnapshot {
    const track = sampleTrack(this.level, this.car.distance)
    const result = updateCar(this.car, input, track, dt)
    updateTelemetry(this.telemetry, this.level, this.car, dt, result.collided)

    return this.snapshot()
  }

  reset(): RacingSnapshot {
    resetCar(this.car)
    resetTelemetry(this.telemetry, this.car)
    return this.snapshot()
  }

  snapshot(): RacingSnapshot {
    return {
      car: this.car,
      level: this.level,
      track: sampleTrack(this.level, this.car.distance),
      currentSection: currentRouteSection(this.level, this.car.distance),
      telemetry: this.telemetry,
      nextCheckpoint: nextCheckpoint(this.level, this.car.distance),
      checkpointTargetSeconds: checkpointTargetSeconds(this.level, this.car.distance),
    }
  }
}
