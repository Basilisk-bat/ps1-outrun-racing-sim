import { describe, expect, it } from 'vitest'
import { runCalibrationTrace } from '../src/game/calibration.ts'

describe('calibration trace', () => {
  it('captures a deterministic clean-line playthrough summary', () => {
    const firstTrace = runCalibrationTrace()
    const secondTrace = runCalibrationTrace()

    expect(firstTrace.summary).toEqual(secondTrace.summary)
    expect(firstTrace.summary.completedLaps).toBe(1)
    expect(firstTrace.summary.completedCheckpoints).toBe(4)
    expect(firstTrace.summary.collisions).toBe(0)
    expect(firstTrace.summary.score).toBe(
      firstTrace.summary.checkpointScore + firstTrace.summary.styleScore,
    )
    expect(firstTrace.summary.averageDeltaSeconds).toBeGreaterThan(-2)
    expect(firstTrace.summary.averageDeltaSeconds).toBeLessThan(-0.5)
    expect(firstTrace.summary.paceVerdict).toBe('on-pace')
    expect(firstTrace.summary.gradeCounts).toEqual({
      gold: 4,
      silver: 0,
      bronze: 0,
      miss: 0,
    })
    expect(firstTrace.checkpoints.map((checkpoint) => checkpoint.sectionId)).toEqual([
      'sunset-gate',
      'glass-narrows',
      'magenta-crest',
      'final-drop',
    ])
    expect(firstTrace.checkpoints.map((checkpoint) => checkpoint.targetSeconds)).toEqual([
      4.2,
      7.5,
      10.8,
      14.1,
    ])
  })

  it('records bounded sampled frames for calibration review', () => {
    const trace = runCalibrationTrace({
      maxSeconds: 12,
      sampleEverySeconds: 1,
      targetSpeed: 74,
    })

    expect(trace.samples.length).toBeGreaterThan(8)
    expect(trace.samples.length).toBeLessThanOrEqual(13)
    expect(trace.samples[0].elapsed).toBeLessThan(0.05)
    expect(trace.samples.at(-1)?.elapsed).toBeGreaterThan(8)
    expect(trace.samples.every((sample) => sample.sectionId.length > 0)).toBe(true)
  })
})
