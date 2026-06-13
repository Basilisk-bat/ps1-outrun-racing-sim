import { describe, expect, it } from 'vitest'
import {
  calculateCenterOffset,
  createNeonRidgeLevel,
  nextCheckpoint,
  sampleTrack,
  wrapDistance,
} from '../src/game/track.ts'

describe('track manifest', () => {
  it('generates a deterministic level with ordered checkpoints', () => {
    const level = createNeonRidgeLevel()

    expect(level.id).toBe('neon-ridge-engine-m1')
    expect(level.segments.length).toBeGreaterThan(8)
    expect(level.totalLength).toBe(level.segmentLength * level.segments.length)
    expect(level.checkpoints).toEqual([...level.checkpoints].sort((a, b) => a - b))
    expect(level.props.length).toBeGreaterThan(8)
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
})
