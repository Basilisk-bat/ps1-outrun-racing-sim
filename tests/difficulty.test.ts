import { describe, expect, it } from 'vitest'
import { resolveRouteDifficulty, resolveTrackSeed } from '../src/game/difficulty.ts'

describe('route difficulty resolver', () => {
  it('selects authored difficulty profiles from the URL query', () => {
    expect(resolveRouteDifficulty('?difficulty=touring')).toBe('touring')
    expect(resolveRouteDifficulty('?difficulty=RIVAL')).toBe('rival')
  })

  it('falls back to arcade for missing or unknown profiles', () => {
    expect(resolveRouteDifficulty('')).toBe('arcade')
    expect(resolveRouteDifficulty('?difficulty=practice')).toBe('arcade')
  })

  it('parses deterministic track seeds from the URL query', () => {
    expect(resolveTrackSeed('?seed=90210')).toBe(90210)
    expect(resolveTrackSeed('?difficulty=rival&seed=-42')).toBe(-42)
    expect(resolveTrackSeed('')).toBeUndefined()
    expect(resolveTrackSeed('?seed=12abc')).toBeUndefined()
    expect(resolveTrackSeed('?seed=')).toBeUndefined()
  })
})
