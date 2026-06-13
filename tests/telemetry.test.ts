import { describe, expect, it } from 'vitest'
import { createInitialCarState } from '../src/game/car.ts'
import { createNeonRidgeLevel } from '../src/game/track.ts'
import {
  ARCADE_START_TIME_SECONDS,
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
    expect(telemetry.timeRemaining).toBeCloseTo(ARCADE_START_TIME_SECONDS - dt + 7)
    expect(telemetry.timeExtendedSeconds).toBe(7)
    expect(telemetry.lastArcadeBanner).toBe('GOLD CHECKPOINT +7s')
    expect(telemetry.events.at(-2)?.type).toBe('time-extend')
    expect(telemetry.events.at(-1)?.details).toContain('GOLD')
  })

  it('runs a cabinet countdown and emits a bounded time-over state', () => {
    const level = createNeonRidgeLevel()
    const car = createInitialCarState()
    const telemetry = createTelemetryState()

    expect(telemetry.timeRemaining).toBe(ARCADE_START_TIME_SECONDS)
    expect(telemetry.lastArcadeBanner).toBe('ROLLING START')

    telemetry.timeRemaining = 0.01
    updateTelemetry(telemetry, level, car, 0.02, false)
    updateTelemetry(telemetry, level, car, 0.02, false)

    expect(telemetry.timeRemaining).toBe(0)
    expect(telemetry.raceExpired).toBe(true)
    expect(telemetry.lastArcadeBanner).toBe('TIME OVER')
    expect(telemetry.events.filter((event) => event.type === 'time-over')).toHaveLength(1)
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

  it('scores and clears authored drift zones', () => {
    const level = createNeonRidgeLevel()
    const car = createInitialCarState()
    const telemetry = createTelemetryState()
    const zone = level.driftZones[0]
    const dt = 1 / 60

    car.speed = 94
    car.drift = 0.48
    car.distance = zone.start + 2

    for (let frame = 0; frame < 210; frame += 1) {
      updateTelemetry(telemetry, level, car, dt, false)
    }

    expect(telemetry.activeDriftZoneId).toBe(zone.id)
    expect(telemetry.activeDriftZoneScore).toBeGreaterThan(zone.targetScore)
    expect(telemetry.driftZoneScore).toBeGreaterThan(zone.targetScore)
    expect(telemetry.styleRank).toBe('drift')

    car.distance = zone.end + 1
    updateTelemetry(telemetry, level, car, dt, false)

    expect(telemetry.activeDriftZoneId).toBeUndefined()
    expect(telemetry.lastDriftZoneResult?.zoneId).toBe(zone.id)
    expect(telemetry.lastDriftZoneResult?.cleared).toBe(true)
    expect(telemetry.completedDriftZones).toHaveLength(1)
    expect(telemetry.lastArcadeBanner).toContain('ZONE CLEAR')
    expect(telemetry.lastStyleAward?.kind).toBe('zone')
  })

  it('tracks rival pressure against route target pace', () => {
    const level = createNeonRidgeLevel('rival')
    const car = createInitialCarState()
    const telemetry = createTelemetryState()

    telemetry.elapsed = level.targetTimeSeconds * 0.5
    car.distance = level.totalLength * 0.35
    updateTelemetry(telemetry, level, car, 1 / 60, false)

    expect(telemetry.rivalGapMeters).toBeLessThan(0)
    expect(telemetry.rivalPressure).toBeGreaterThan(50)
    expect(telemetry.rivalStatus).toBe('pressure')

    car.distance = level.totalLength * 0.68
    updateTelemetry(telemetry, level, car, 1 / 60, false)

    expect(telemetry.rivalGapMeters).toBeGreaterThan(0)
    expect(telemetry.rivalStatus).toBe('ahead')
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
    const arcade = createNeonRidgeLevel('arcade')
    const rival = createNeonRidgeLevel('rival')

    expect(gradeCheckpoint(-0.1)).toBe('gold')
    expect(gradeCheckpoint(1.5)).toBe('silver')
    expect(gradeCheckpoint(4.8)).toBe('bronze')
    expect(gradeCheckpoint(5.1)).toBe('miss')
    expect(gradeCheckpoint(2.2, arcade.difficulty)).toBe('silver')
    expect(gradeCheckpoint(2.2, rival.difficulty)).toBe('bronze')
    expect(scoreCheckpoint(2.2, 0, 0, rival.difficulty)).toBeLessThan(
      scoreCheckpoint(2.2, 0, 0, arcade.difficulty),
    )
    expect(scoreCheckpoint(1.2, 2, 3)).toBeLessThan(scoreCheckpoint(1.2, 0, 0))
    expect(scoreCheckpoint(120, 10, 30)).toBe(100)
  })

  it('uses level difficulty when grading checkpoint splits', () => {
    const level = createNeonRidgeLevel('rival')
    const car = createInitialCarState()
    const telemetry = createTelemetryState()
    const firstSection = level.sections[0]
    const dt = 1 / 60

    telemetry.elapsed = firstSection.targetSeconds + 2.2 - dt
    car.speed = 96
    car.distance = firstSection.checkpoint + 1
    updateTelemetry(telemetry, level, car, dt, false)

    expect(telemetry.lastCheckpoint?.targetSeconds).toBeCloseTo(firstSection.targetSeconds)
    expect(telemetry.lastCheckpoint?.deltaSeconds).toBeCloseTo(2.2)
    expect(telemetry.lastCheckpoint?.grade).toBe('bronze')
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
    telemetry.driftZoneScore = 150
    telemetry.activeDriftZoneId = 'city-overlook-drift-zone'
    telemetry.activeDriftZoneTitle = 'City Overlook Drift'
    telemetry.activeDriftZoneScore = 80
    telemetry.activeDriftZoneTarget = 120
    telemetry.completedDriftZones = [
      {
        zoneId: 'switchback-arc-drift-zone',
        sectionId: 'switchback-arc',
        title: 'Switchback Arc Drift',
        score: 128,
        targetScore: 120,
        cleared: true,
        bonusScore: 66,
      },
    ]
    telemetry.lastDriftZoneResult = telemetry.completedDriftZones[0]
    telemetry.rivalGapMeters = -42
    telemetry.rivalPressure = 73
    telemetry.rivalStatus = 'pressure'
    telemetry.timeRemaining = 3
    telemetry.timeExtendedSeconds = 9
    telemetry.raceExpired = true
    telemetry.lastArcadeBanner = 'TIME OVER'
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
    expect(telemetry.driftZoneScore).toBe(0)
    expect(telemetry.activeDriftZoneId).toBeUndefined()
    expect(telemetry.activeDriftZoneTitle).toBe('OPEN ROAD')
    expect(telemetry.activeDriftZoneScore).toBe(0)
    expect(telemetry.activeDriftZoneTarget).toBe(0)
    expect(telemetry.completedDriftZones).toEqual([])
    expect(telemetry.lastDriftZoneResult).toBeUndefined()
    expect(telemetry.rivalGapMeters).toBe(0)
    expect(telemetry.rivalPressure).toBe(0)
    expect(telemetry.rivalStatus).toBe('even')
    expect(telemetry.timeRemaining).toBe(ARCADE_START_TIME_SECONDS)
    expect(telemetry.timeExtendedSeconds).toBe(0)
    expect(telemetry.raceExpired).toBe(false)
    expect(telemetry.lastArcadeBanner).toBe('ROLLING START')
    expect(telemetry.checkpointSplits).toEqual([])
    expect(telemetry.lastCheckpoint).toBeUndefined()
    expect(telemetry.events.at(-1)?.type).toBe('reset')
  })
})
