import { describe, expect, it } from 'vitest'
import { RacingSim } from '../src/game/sim.ts'

describe('racing sim snapshots', () => {
  it('reports cumulative checkpoint target time after lap rollover', () => {
    const sim = new RacingSim()
    const firstCheckpointTarget = sim.level.sections[0].targetSeconds
    const finishTarget = sim.level.targetTimeSeconds

    sim.car.distance = sim.level.totalLength + 1
    sim.telemetry.currentLap = 1

    expect(sim.snapshot().checkpointTargetSeconds).toBe(firstCheckpointTarget + finishTarget)
  })
})
