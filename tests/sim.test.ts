import { describe, expect, it } from 'vitest'
import { RacingSim } from '../src/game/sim.ts'
import { trafficVehiclePose } from '../src/game/traffic.ts'
import type { InputState } from '../src/game/input.ts'

const neutralInput: InputState = {
  accelerate: false,
  brake: false,
  boost: false,
  steer: 0,
  reset: false,
}

describe('racing sim snapshots', () => {
  it('reports cumulative checkpoint target time after lap rollover', () => {
    const sim = new RacingSim()
    const firstCheckpointTarget = sim.level.sections[0].targetSeconds
    const finishTarget = sim.level.targetTimeSeconds

    sim.car.distance = sim.level.totalLength + 1
    sim.telemetry.currentLap = 1

    expect(sim.snapshot().checkpointTargetSeconds).toBe(firstCheckpointTarget + finishTarget)
  })

  it('resolves deterministic traffic contacts through collision telemetry', () => {
    const sim = new RacingSim()
    const vehicle = sim.level.traffic[0]
    const pose = trafficVehiclePose(sim.level, vehicle, vehicle.distance - 1, 0)

    sim.car.distance = vehicle.distance - 1
    sim.car.lateral = pose.laneLateral
    sim.car.speed = 92

    const snapshot = sim.step(neutralInput, 1 / 60)

    expect(snapshot.car.collisionCount).toBe(1)
    expect(snapshot.car.speed).toBeLessThan(92)
    expect(snapshot.traffic.hitCount).toBe(1)
    expect(snapshot.traffic.lastHitVehicleId).toBe(vehicle.id)
    expect(snapshot.telemetry.events.at(-1)?.type).toBe('collision')
    expect(snapshot.telemetry.events.at(-1)?.details).toContain(vehicle.id)

    const reset = sim.reset()
    expect(reset.traffic.hitCount).toBe(0)
    expect(reset.traffic.lastHitVehicleId).toBeNull()
    expect(reset.traffic.nearMissCount).toBe(0)
  })

  it('awards boost and drift score for close traffic near-misses', () => {
    const sim = new RacingSim()
    const vehicle = sim.level.traffic[0]
    const pose = trafficVehiclePose(sim.level, vehicle, vehicle.distance - 2, 0)

    sim.car.distance = vehicle.distance - 2
    sim.car.lateral = pose.laneLateral + 3.2
    sim.car.speed = 92

    const snapshot = sim.step(neutralInput, 1 / 60)

    expect(snapshot.car.collisionCount).toBe(0)
    expect(snapshot.traffic.hitCount).toBe(0)
    expect(snapshot.traffic.nearMissCount).toBe(1)
    expect(snapshot.traffic.lastNearMissVehicleId).toBe(vehicle.id)
    expect(snapshot.car.boostMeter).toBeGreaterThan(0)
    expect(snapshot.telemetry.styleRank).toBe('near-miss')
    expect(snapshot.telemetry.lastStyleAward?.kind).toBe('near-miss')
    expect(snapshot.telemetry.lastArcadeBanner).toBe('NEAR MISS')
    expect(snapshot.telemetry.events.at(-1)?.type).toBe('near-miss')
  })

  it('does not let wrapped traffic hit an idle car from behind', () => {
    const sim = new RacingSim('rival', { seed: 90210 })

    for (let frame = 0; frame < 60 * 30; frame += 1) {
      sim.step(neutralInput, 1 / 60)
    }

    expect(sim.car.speed).toBe(0)
    expect(sim.car.collisionCount).toBe(0)
    expect(sim.traffic.hitCount).toBe(0)
  })
})
