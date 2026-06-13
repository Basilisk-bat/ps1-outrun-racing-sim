import { describe, expect, it } from 'vitest'
import { createInitialCarState } from '../src/game/car.ts'
import { createNeonRidgeLevel } from '../src/game/track.ts'
import {
  createTelemetryState,
  pushTelemetryEvent,
  resetTelemetry,
  updateTelemetry,
} from '../src/game/telemetry.ts'

describe('telemetry', () => {
  it('tracks top speed and checkpoint events', () => {
    const level = createNeonRidgeLevel()
    const car = createInitialCarState()
    const telemetry = createTelemetryState()

    car.speed = 88
    car.distance = level.checkpoints[0] + 1
    updateTelemetry(telemetry, level, car, 1 / 60, false)

    expect(telemetry.topSpeed).toBe(88)
    expect(telemetry.nextCheckpointIndex).toBe(1)
    expect(telemetry.events.at(-1)?.type).toBe('checkpoint')
  })

  it('keeps the event list bounded', () => {
    const car = createInitialCarState()
    const telemetry = createTelemetryState()

    for (let index = 0; index < 40; index += 1) {
      pushTelemetryEvent(telemetry, car, 'collision')
    }

    expect(telemetry.events.length).toBe(24)
  })

  it('resets elapsed, top speed, offroad, and checkpoint state', () => {
    const car = createInitialCarState()
    const telemetry = createTelemetryState()
    telemetry.elapsed = 4
    telemetry.topSpeed = 80
    telemetry.offroadTime = 2
    telemetry.nextCheckpointIndex = 2

    resetTelemetry(telemetry, car)

    expect(telemetry.elapsed).toBe(0)
    expect(telemetry.topSpeed).toBe(0)
    expect(telemetry.offroadTime).toBe(0)
    expect(telemetry.nextCheckpointIndex).toBe(0)
    expect(telemetry.events.at(-1)?.type).toBe('reset')
  })
})
