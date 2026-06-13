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
    expect(telemetry.checkpointScore).toBe(telemetry.lastCheckpoint?.score)
    expect(telemetry.styleScore).toBe(0)
    expect(telemetry.score).toBe(telemetry.lastCheckpoint?.score)
    expect(telemetry.events.at(-1)?.details).toContain('GOLD')
  })

  it('adds deterministic style points for controlled drift and clean driving', () => {
    const level = createNeonRidgeLevel()
    const car = createInitialCarState()
    const telemetry = createTelemetryState()
    const dt = 1 / 60

    car.speed = 92
    car.drift = 0.42
    car.lateral = 2

    for (let frame = 0; frame < 120; frame += 1) {
      updateTelemetry(telemetry, level, car, dt, false)
    }

    const driftScore = telemetry.styleScore

    expect(telemetry.styleRank).toBe('drift')
    expect(driftScore).toBeGreaterThan(90)
    expect(telemetry.score).toBe(telemetry.checkpointScore + telemetry.styleScore)
    expect(telemetry.styleCombo).toBe(telemetry.styleScore)
    expect(telemetry.bestStyleCombo).toBe(telemetry.styleCombo)
    expect(telemetry.events.some((event) => event.type === 'style')).toBe(true)

    car.drift = 0
    car.lateral = 0

    for (let frame = 0; frame < 60; frame += 1) {
      updateTelemetry(telemetry, level, car, dt, false)
    }

    expect(telemetry.styleRank).toBe('clean')
    expect(telemetry.styleScore).toBeGreaterThan(driftScore)
  })

  it('keeps checkpoint score separate from style score', () => {
    const level = createNeonRidgeLevel()
    const car = createInitialCarState()
    const telemetry = createTelemetryState()
    const firstSection = level.sections[0]
    const dt = 1 / 60

    telemetry.styleScore = 125
    telemetry.score = 125
    telemetry.elapsed = firstSection.targetSeconds + 1 - dt
    car.speed = 96
    car.distance = firstSection.checkpoint + 1
    updateTelemetry(telemetry, level, car, dt, false)

    expect(telemetry.lastCheckpoint?.score).toBeGreaterThan(0)
    expect(telemetry.checkpointScore).toBe(telemetry.lastCheckpoint?.score)
    expect(telemetry.score).toBe(telemetry.checkpointScore + 125)
  })

  it('breaks the style chain on offroad and collision states', () => {
    const level = createNeonRidgeLevel()
    const car = createInitialCarState()
    const telemetry = createTelemetryState()

    telemetry.styleCombo = 240
    telemetry.bestStyleCombo = 240
    telemetry.cleanDrivingSeconds = 3
    telemetry.styleAccumulator = 0.75
    telemetry.lastStyleAward = {
      kind: 'drift',
      points: 4,
      multiplier: 1.2,
    }
    car.speed = 90
    car.offroad = true

    updateTelemetry(telemetry, level, car, 1 / 60, false)

    expect(telemetry.styleCombo).toBe(0)
    expect(telemetry.bestStyleCombo).toBe(240)
    expect(telemetry.cleanDrivingSeconds).toBe(0)
    expect(telemetry.styleAccumulator).toBe(0)
    expect(telemetry.styleRank).toBe('risk')
    expect(telemetry.lastStyleAward).toBeUndefined()

    telemetry.styleCombo = 90
    telemetry.cleanDrivingSeconds = 2
    car.offroad = false
    updateTelemetry(telemetry, level, car, 1 / 60, true)

    expect(telemetry.styleCombo).toBe(0)
    expect(telemetry.cleanDrivingSeconds).toBe(0)
    expect(telemetry.styleRank).toBe('neutral')
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
    telemetry.checkpointScore = 800
    telemetry.styleScore = 120
    telemetry.styleCombo = 60
    telemetry.bestStyleCombo = 160
    telemetry.cleanDrivingSeconds = 4
    telemetry.styleRank = 'drift'
    telemetry.styleAccumulator = 0.5
    telemetry.lastStyleAward = {
      kind: 'drift',
      points: 4,
      multiplier: 1.1,
    }
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
    expect(telemetry.checkpointScore).toBe(0)
    expect(telemetry.styleScore).toBe(0)
    expect(telemetry.styleCombo).toBe(0)
    expect(telemetry.bestStyleCombo).toBe(0)
    expect(telemetry.cleanDrivingSeconds).toBe(0)
    expect(telemetry.styleRank).toBe('neutral')
    expect(telemetry.styleAccumulator).toBe(0)
    expect(telemetry.lastStyleAward).toBeUndefined()
    expect(telemetry.score).toBe(0)
    expect(telemetry.checkpointSplits).toEqual([])
    expect(telemetry.lastCheckpoint).toBeUndefined()
    expect(telemetry.events.at(-1)?.type).toBe('reset')
  })
})
