import { describe, expect, it } from 'vitest'
import {
  calculateCenterOffset,
  checkpointTargetSeconds,
  createProceduralTrack,
  createNeonRidgeLevel,
  ROUTE_DIFFICULTY_PROFILES,
  currentRouteSection,
  nextCheckpoint,
  sampleTrack,
  wrapDistance,
} from '../src/game/track.ts'

describe('track manifest', () => {
  it('generates a deterministic endless ridge without a player-provided seed', () => {
    const level = createNeonRidgeLevel()

    expect(level.id).toBe('neon-ridge-drift-m2')
    expect(level.title).toBe('Neon Ridge Drift')
    expect(level.difficulty).toEqual(ROUTE_DIFFICULTY_PROFILES.arcade)
    expect(level.generator).toBe('infinite-ridge-v1')
    expect(level.segments.length).toBeGreaterThan(24)
    expect(level.totalLength).toBe(level.segmentLength * level.segments.length)
    expect(level.checkpoints).toEqual([...level.checkpoints].sort((a, b) => a - b))
    expect(level.checkpoints).toEqual(level.sections.map((section) => section.checkpoint))
    expect(level.targetTimeSeconds).toBe(level.sections.at(-1)?.targetSeconds)
    expect(level.props.length).toBeGreaterThan(8)
    expect(level.traffic.length).toBeGreaterThan(4)
  })

  it('preserves the canonical ridge identities while generating from section themes', () => {
    const level = createNeonRidgeLevel()

    expect(level.sections.map((section) => section.id)).toEqual([
      'city-overlook',
      'switchback-arc',
      'neon-causeway',
      'radio-crest',
      'city-overlook-2',
      'switchback-arc-2',
      'neon-causeway-2',
      'radio-crest-2',
    ])
    expect(level.sections.slice(0, 4).map((section) => section.targetSeconds)).toEqual([
      4.2,
      7.5,
      10.8,
      14.1,
    ])
  })

  it('creates deterministic seeded procedural variants', () => {
    const first = createProceduralTrack({ seed: 90210 })
    const second = createProceduralTrack({ seed: 90210 })
    const alternate = createProceduralTrack({ seed: 13579 })

    expect(second.sections).toEqual(first.sections)
    expect(second.segments).toEqual(first.segments)
    expect(second.props).toEqual(first.props)
    expect(alternate.segments.map((segment) => segment.curve)).not.toEqual(
      first.segments.map((segment) => segment.curve),
    )
    expect(alternate.props.map((prop) => [prop.side, prop.kind, prop.offset])).not.toEqual(
      first.props.map((prop) => [prop.side, prop.kind, prop.offset]),
    )
    expect(alternate.traffic.map((vehicle) => [vehicle.lane, vehicle.kind, vehicle.speed])).not.toEqual(
      first.traffic.map((vehicle) => [vehicle.lane, vehicle.kind, vehicle.speed]),
    )
  })

  it('places deterministic traffic inside authored route sections', () => {
    const level = createNeonRidgeLevel()
    const sectionIds = new Set(level.sections.map((section) => section.id))

    expect(level.traffic).toHaveLength(level.sections.length * 2)
    expect(level.traffic.every((vehicle) => sectionIds.has(vehicle.sectionId))).toBe(true)
    expect(level.traffic.every((vehicle) => Math.abs(vehicle.lane) === 1)).toBe(true)
    expect(level.traffic.every((vehicle) => vehicle.speed >= 26 && vehicle.speed <= 44)).toBe(true)
    expect(level.traffic.map((vehicle) => vehicle.distance)).toEqual(
      [...level.traffic.map((vehicle) => vehicle.distance)].sort((a, b) => a - b),
    )
  })

  it('supports longer procedural route manifests with contiguous sections', () => {
    const level = createProceduralTrack({
      difficultyId: 'touring',
      seed: 24680,
      sectionCount: 6,
    })

    expect(level.sections).toHaveLength(6)
    expect(level.checkpoints).toHaveLength(6)
    expect(level.segments).toHaveLength(24)
    expect(level.sections[4].id).toBe('city-overlook-2')
    expect(new Set(level.sections.map((section) => section.id)).size).toBe(
      level.sections.length,
    )
    expect(level.sections[0].start).toBe(0)
    expect(level.sections.at(-1)?.end).toBe(level.totalLength)

    for (let index = 1; index < level.sections.length; index += 1) {
      expect(level.sections[index].start).toBe(level.sections[index - 1].end)
      expect(level.sections[index].targetSeconds).toBeGreaterThan(
        level.sections[index - 1].targetSeconds,
      )
    }
  })

  it('scales checkpoint targets for alternate route difficulty profiles', () => {
    const touring = createNeonRidgeLevel('touring')
    const arcade = createNeonRidgeLevel('arcade')
    const rival = createNeonRidgeLevel('rival')

    expect(touring.difficulty.title).toBe('Touring')
    expect(rival.difficulty.title).toBe('Rival')
    expect(touring.sections[0].targetSeconds).toBeGreaterThan(
      arcade.sections[0].targetSeconds,
    )
    expect(rival.sections[0].targetSeconds).toBeLessThan(
      arcade.sections[0].targetSeconds,
    )
    expect(touring.targetTimeSeconds).toBeGreaterThan(arcade.targetTimeSeconds)
    expect(rival.targetTimeSeconds).toBeLessThan(arcade.targetTimeSeconds)
    expect(rival.difficulty.silverDeltaSeconds).toBeLessThan(
      arcade.difficulty.silverDeltaSeconds,
    )
    expect(touring.difficulty.bronzeDeltaSeconds).toBeGreaterThan(
      arcade.difficulty.bronzeDeltaSeconds,
    )
  })

  it('defines contiguous named route sections with pacing targets', () => {
    const level = createNeonRidgeLevel()

    expect(level.sections[0].start).toBe(0)
    expect(level.sections.at(-1)?.end).toBe(level.totalLength)

    for (let index = 0; index < level.sections.length; index += 1) {
      const section = level.sections[index]
      const previous = level.sections[index - 1]
      const next = level.sections[index + 1]

      expect(section.end).toBeGreaterThan(section.start)
      expect(section.checkpoint).toBe(section.end)
      if (previous) {
        expect(section.start).toBe(previous.end)
        expect(section.targetSeconds).toBeGreaterThan(previous.targetSeconds)
      }
      if (next) {
        expect(section.end).toBe(next.start)
      }
    }
  })

  it('maps samples and props back to their level-design sections', () => {
    const level = createNeonRidgeLevel()
    const sectionIds = new Set(level.sections.map((section) => section.id))
    const propSectionIds = new Set(level.props.map((prop) => prop.sectionId))

    expect(propSectionIds).toEqual(sectionIds)
    for (const segment of level.segments) {
      expect(sectionIds.has(segment.sectionId)).toBe(true)
    }
  })

  it('wraps long distances back into the current lap', () => {
    const level = createNeonRidgeLevel()

    expect(wrapDistance(level.totalLength + 12, level.totalLength)).toBe(12)
    expect(sampleTrack(level, level.totalLength + 32).distance).toBe(32)
  })

  it('samples road width and center offset without discontinuous jumps', () => {
    const level = createNeonRidgeLevel()
    const before = sampleTrack(level, 127)
    const after = sampleTrack(level, 129)

    expect(before.roadWidth).toBeGreaterThan(10)
    expect(Math.abs(after.centerX - before.centerX)).toBeLessThan(1.2)
    expect(calculateCenterOffset(level, 0)).toBe(0)
  })

  it('reports the next checkpoint in lap space', () => {
    const level = createNeonRidgeLevel()

    expect(nextCheckpoint(level, 10)).toBe(level.checkpoints[0])
    expect(nextCheckpoint(level, level.checkpoints[0] + 2)).toBe(level.checkpoints[1])
  })

  it('reports the active route section and target time for the next checkpoint', () => {
    const level = createNeonRidgeLevel()
    const secondSection = level.sections[1]

    expect(currentRouteSection(level, 12).id).toBe(level.sections[0].id)
    expect(currentRouteSection(level, secondSection.start + 8).id).toBe(secondSection.id)
    expect(checkpointTargetSeconds(level, secondSection.start + 8)).toBe(
      secondSection.targetSeconds,
    )
  })
})
