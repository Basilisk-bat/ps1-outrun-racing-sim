import { describe, expect, it } from 'vitest'
import { resolveRouteDifficulty } from '../src/game/difficulty.ts'

describe('route difficulty resolver', () => {
  it('selects authored difficulty profiles from the URL query', () => {
    expect(resolveRouteDifficulty('?difficulty=touring')).toBe('touring')
    expect(resolveRouteDifficulty('?difficulty=RIVAL')).toBe('rival')
  })

  it('falls back to arcade for missing or unknown profiles', () => {
    expect(resolveRouteDifficulty('')).toBe('arcade')
    expect(resolveRouteDifficulty('?difficulty=practice')).toBe('arcade')
  })
})
