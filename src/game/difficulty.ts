import {
  DEFAULT_ROUTE_DIFFICULTY,
  ROUTE_DIFFICULTY_PROFILES,
} from './track.ts'
import type { RouteDifficultyId } from './track.ts'

export function resolveRouteDifficulty(search: string): RouteDifficultyId {
  const value = new URLSearchParams(search).get('difficulty')?.toLowerCase()

  if (value && value in ROUTE_DIFFICULTY_PROFILES) {
    return value as RouteDifficultyId
  }

  return DEFAULT_ROUTE_DIFFICULTY
}

export function resolveTrackSeed(search: string): number | undefined {
  const value = new URLSearchParams(search).get('seed')?.trim()
  if (!value) {
    return undefined
  }

  if (!/^-?\d+$/.test(value)) {
    return undefined
  }

  const seed = Number.parseInt(value, 10)
  return Number.isFinite(seed) ? seed : undefined
}
