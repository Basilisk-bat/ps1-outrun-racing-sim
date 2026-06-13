import { describe, expect, it } from 'vitest'
import { CAR_LIMITS, createInitialCarState, updateCar } from '../src/game/car.ts'
import type { InputState } from '../src/game/input.ts'
import type { TrackSample } from '../src/game/track.ts'

const neutralInput: InputState = {
  accelerate: false,
  brake: false,
  boost: false,
  steer: 0,
  reset: false,
}

const flatTrack: TrackSample = {
  distance: 0,
  centerX: 0,
  elevation: 0,
  curve: 0,
  roadWidth: 16,
}

describe('car physics', () => {
  it('accelerates and clamps to max speed', () => {
    const car = createInitialCarState()
    const input = { ...neutralInput, accelerate: true }

    for (let index = 0; index < 260; index += 1) {
      updateCar(car, input, flatTrack, 1 / 60)
    }

    expect(car.speed).toBeGreaterThan(90)
    expect(car.speed).toBeLessThanOrEqual(CAR_LIMITS.maxSpeed)
    expect(car.distance).toBeGreaterThan(100)
  })

  it('brakes without exceeding reverse speed', () => {
    const car = createInitialCarState()
    car.speed = 32

    for (let index = 0; index < 160; index += 1) {
      updateCar(car, { ...neutralInput, brake: true }, flatTrack, 1 / 60)
    }

    expect(car.speed).toBeGreaterThanOrEqual(CAR_LIMITS.reverseSpeed)
  })

  it('steers within a bounded heading and produces drift', () => {
    const car = createInitialCarState()
    car.speed = 92

    updateCar(car, { ...neutralInput, steer: 1 }, flatTrack, 1 / 6)

    expect(car.lateral).toBeGreaterThan(0)
    expect(car.drift).toBeGreaterThan(0)
    expect(car.heading).toBeLessThanOrEqual(0.42)
  })

  it('uses brake and steer as an intentional drift input at speed', () => {
    const standardBrake = createInitialCarState()
    const driftBrake = createInitialCarState()
    standardBrake.speed = 78
    driftBrake.speed = 78

    updateCar(standardBrake, { ...neutralInput, brake: true }, flatTrack, 1 / 6)
    updateCar(driftBrake, { ...neutralInput, brake: true, steer: 1 }, flatTrack, 1 / 6)

    expect(driftBrake.speed).toBeGreaterThan(standardBrake.speed)
    expect(driftBrake.drift).toBeGreaterThan(standardBrake.drift)
    expect(driftBrake.heading).toBeGreaterThan(standardBrake.heading)
  })

  it('charges boost from controlled drift and spends it through boost input', () => {
    const car = createInitialCarState()
    const boostPad: TrackSample = { ...flatTrack, roadWidth: 48 }

    for (let frame = 0; frame < 45; frame += 1) {
      car.speed = 92
      car.lateralVelocity = 6
      updateCar(car, neutralInput, boostPad, 1 / 60)
    }

    const chargedBoost = car.boostMeter
    expect(chargedBoost).toBeGreaterThan(4)

    car.speed = 86
    updateCar(car, { ...neutralInput, accelerate: true, boost: true }, boostPad, 1 / 6)

    expect(car.boostActive).toBe(true)
    expect(car.boostMeter).toBeLessThan(chargedBoost)
    expect(car.speed).toBeGreaterThan(86)
  })

  it('marks offroad and records a collision hook when pushed past the limit', () => {
    const car = createInitialCarState()
    car.speed = 100
    car.lateral = 13
    car.boostMeter = 40

    const result = updateCar(car, neutralInput, flatTrack, 1 / 60)

    expect(result.offroad).toBe(true)
    expect(result.collided).toBe(true)
    expect(car.collisionCount).toBe(1)
    expect(car.boostMeter).toBeLessThan(40)
    expect(car.recoverySeconds).toBeGreaterThan(0)
    expect(Math.abs(car.lateral)).toBeLessThanOrEqual(flatTrack.roadWidth * 0.68)

    car.speed = 88
    updateCar(car, { ...neutralInput, accelerate: true, boost: true }, flatTrack, 1 / 60)
    expect(car.boostActive).toBe(false)
  })
})
