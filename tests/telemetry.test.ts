import { describe, expect, it } from 'vitest'
import { createInitialCarState } from '../src/game/car.ts'
import { createNeonRidgeLevel } from '../src/game/track.ts'
import {
  createTelemetryState,
  gradeCheckpoint,
  pushTelemetryEvent,
  resetTelemetry,
  scoreCheckpoint,
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

  it('records graded checkpoint splits against route target times', () => {
    const level = createNeonRidgeLevel()
    const car = createInitialCarState()
    const telemetry = createTelemetryState()
    const firstSection = level.sections[0]
    const dt = 1 / 60

    telemetry.elapsed = firstSection.targetSeconds - 0.35 - dt
    car.speed = 96
    car.distance = firstSection.checkpoint + 1
    updateTelemetry(telemetry, level, car, dt, false)

    expect(telemetry.lastCheckpoint?.sectionId).toBe(firstSection.id)
    expect(telemetry.lastCheckpoint?.targetSeconds).toBeCloseTo(firstSection.targetSeconds)
    expect(telemetry.lastCheckpoint?.actualSeconds).toBeCloseTo(firstSection.targetSeconds - 0.35)
    expect(telemetry.lastCheckpoint?.deltaSeconds).toBeCloseTo(-0.35)
    expect(telemetry.lastCheckpoint?.grade).toBe('gold')
    expect(telemetry.score).toBe(telemetry.lastCheckpoint?.score)
    expect(telemetry.events.at(-1)?.details).toContain('GOLD')
  })

  it('grades and scores checkpoint penalties deterministically', () => {
    expect(gradeCheckpoint(-0.1)).toBe('gold')
    expect(gradeCheckpoint(1.5)).toBe('silver')
    expect(gradeCheckpoint(4.8)).toBe('bronze')
    expect(gradeCheckpoint(5.1)).toBe('miss')
    expect(scoreCheckpoint(1.2, 2, 3)).toBeLessThan(scoreCheckpoint(1.2, 0, 0))
    expect(scoreCheckpoint(120, 10, 30)).toBe(100)
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
    telemetry.score = 800
    telemetry.checkpointSplits = [
      {
        checkpointIndex: 0,
        lap: 1,
        checkpointDistance: 256,
        sectionId: 'sunset-gate',
        sectionTitle: 'Sunset Gate',
        targetSeconds: 9.5,
        actualSeconds: 9,
        deltaSeconds: -0.5,
        grade: 'gold',
        score: 1000,
        cumulativeScore: 1000,
        collisionPenalty: 0,
        offroadPenaltySeconds: 0,
      },
    ]
    telemetry.lastCheckpoint = telemetry.checkpointSplits[0]

    resetTelemetry(telemetry, car)

    expect(telemetry.elapsed).toBe(0)
    expect(telemetry.topSpeed).toBe(0)
    expect(telemetry.offroadTime).toBe(0)
    expect(telemetry.nextCheckpointIndex).toBe(0)
    expect(telemetry.score).toBe(0)
    expect(telemetry.checkpointSplits).toEqual([])
    expect(telemetry.lastCheckpoint).toBeUndefined()
    expect(telemetry.events.at(-1)?.type).toBe('reset')
  })
})
