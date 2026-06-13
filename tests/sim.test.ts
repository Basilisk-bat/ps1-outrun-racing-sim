import { describe, expect, it } from 'vitest'
import { RacingSim } from '../src/game/sim.ts'
import { sampleTrack } from '../src/game/track.ts'
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
    expect(
      snapshot.telemetry.events.some(
        (event) => event.type === 'collision' && event.details?.includes(vehicle.id),
      ),
    ).toBe(true)

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

  it('exposes active drift zone and rival pressure in snapshots', () => {
    const sim = new RacingSim('rival')
    const zone = sim.level.driftZones[0]

    sim.car.distance = zone.start + 4
    sim.car.speed = 94
    sim.car.drift = 0.46

    const snapshot = sim.step(neutralInput, 1 / 60)

    expect(snapshot.telemetry.activeDriftZoneId).toBe(zone.id)
    expect(snapshot.telemetry.activeDriftZoneTarget).toBe(zone.targetScore)
    expect(snapshot.telemetry.rivalPressure).toBeGreaterThanOrEqual(0)
  })

  it('uses recovery gates once per lap to rescue bad route states', () => {
    const sim = new RacingSim('rival')
    const gate = sim.level.recoveryGates[0]
    const sample = sampleTrack(sim.level, gate.distance)

    sim.car.distance = gate.distance
    sim.car.speed = 64
    sim.car.lateral = sample.roadWidth * 0.62
    sim.car.lateralVelocity = 7
    sim.car.recoverySeconds = 0.6
    sim.car.offroad = true
    const timeBefore = sim.telemetry.timeRemaining

    const snapshot = sim.step(neutralInput, 1 / 60)

    expect(snapshot.telemetry.recoveryGateUses).toBe(1)
    expect(snapshot.telemetry.lastRecoveryGate?.gateId).toBe(gate.id)
    expect(snapshot.telemetry.lastArcadeBanner).toContain('RECOVERY GATE')
    expect(snapshot.telemetry.events.at(-1)?.type).toBe('recovery-gate')
    expect(snapshot.car.offroad).toBe(false)
    expect(Math.abs(snapshot.car.lateral)).toBeLessThan(sample.roadWidth * 0.5)
    expect(snapshot.car.recoverySeconds).toBe(0)
    expect(snapshot.car.boostMeter).toBeGreaterThan(0)
    expect(snapshot.telemetry.timeRemaining).toBeGreaterThan(timeBefore)

    const afterFirstUse = snapshot.telemetry.recoveryGateUses
    sim.car.offroad = true
    sim.car.recoverySeconds = 0.5
    sim.step(neutralInput, 1 / 60)

    expect(sim.snapshot().telemetry.recoveryGateUses).toBe(afterFirstUse)
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
