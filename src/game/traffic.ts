import { CAR_LIMITS } from './car.ts'
import { sampleTrack, wrapDistance } from './track.ts'
import type { CarState } from './car.ts'
import type { LevelManifest, TrafficVehicle } from './track.ts'

export interface TrafficRuntimeState {
  hitCount: number
  nearMissCount: number
  lastHitVehicleId?: string
  lastHitAt?: number
  lastNearMissVehicleId?: string
  lastNearMissAt?: number
}

export interface TrafficVehiclePose {
  vehicle: TrafficVehicle
  absoluteDistance: number
  distanceAhead: number
  laneLateral: number
}

export interface TrafficProximity {
  vehicleId: string
  kind: TrafficVehicle['kind']
  distanceAhead: number
  lane: TrafficVehicle['lane']
  laneLateral: number
  speed: number
}

export interface TrafficContact {
  collided: boolean
  vehicle?: TrafficVehicle
  distanceDelta?: number
  lateralDelta?: number
  nearMissVehicle?: TrafficVehicle
  nearMissDistanceDelta?: number
  nearMissLateralDelta?: number
}

export interface TrafficSnapshot {
  vehicleCount: number
  hitCount: number
  nearMissCount: number
  lastHitVehicleId: string | null
  lastHitAt: number | null
  lastNearMissVehicleId: string | null
  lastNearMissAt: number | null
  nearest: TrafficProximity | null
}

const TRAFFIC_LANE_FACTOR = 0.28
const TRAFFIC_HIT_LENGTH = 5.4
const TRAFFIC_HIT_WIDTH = 2.45
const TRAFFIC_NEAR_MISS_MAX_WIDTH = 5.4
const TRAFFIC_NEAR_MISS_COOLDOWN = 1.35

export function createTrafficRuntimeState(): TrafficRuntimeState {
  return {
    hitCount: 0,
    nearMissCount: 0,
  }
}

export function resetTrafficRuntimeState(runtime: TrafficRuntimeState): void {
  runtime.hitCount = 0
  runtime.nearMissCount = 0
  delete runtime.lastHitVehicleId
  delete runtime.lastHitAt
  delete runtime.lastNearMissVehicleId
  delete runtime.lastNearMissAt
}

export function resolveTrafficContact(
  runtime: TrafficRuntimeState,
  level: LevelManifest,
  car: CarState,
  elapsed: number,
): TrafficContact {
  if (car.collisionCooldown > 0) {
    return { collided: false }
  }

  const contact = findTrafficContact(level, car, elapsed)
  if (!contact.vehicle) {
    const nearMiss = findTrafficNearMiss(runtime, level, car, elapsed)
    if (nearMiss.nearMissVehicle) {
      runtime.nearMissCount += 1
      runtime.lastNearMissVehicleId = nearMiss.nearMissVehicle.id
      runtime.lastNearMissAt = elapsed
    }
    return nearMiss
  }

  car.collisionCount += 1
  car.collisionCooldown = CAR_LIMITS.collisionCooldown
  car.recoverySeconds = CAR_LIMITS.recoverySeconds
  car.boostActive = false
  car.boostMeter = Math.max(0, car.boostMeter - CAR_LIMITS.collisionBoostPenalty)
  car.speed = Math.max(18, Math.min(car.speed * 0.52, contact.vehicle.speed + 12))
  car.lateralVelocity = trafficPushDirection(contact) * Math.max(4, Math.abs(car.lateralVelocity) * 0.4)
  car.lateral += trafficPushDirection(contact) * 0.7

  runtime.hitCount += 1
  runtime.lastHitVehicleId = contact.vehicle.id
  runtime.lastHitAt = elapsed

  return contact
}

export function createTrafficSnapshot(
  level: LevelManifest,
  car: CarState,
  elapsed: number,
  runtime: TrafficRuntimeState,
): TrafficSnapshot {
  return {
    vehicleCount: level.traffic.length,
    hitCount: runtime.hitCount,
    nearMissCount: runtime.nearMissCount,
    lastHitVehicleId: runtime.lastHitVehicleId ?? null,
    lastHitAt: runtime.lastHitAt ?? null,
    lastNearMissVehicleId: runtime.lastNearMissVehicleId ?? null,
    lastNearMissAt: runtime.lastNearMissAt ?? null,
    nearest: nearestTraffic(level, car.distance, elapsed),
  }
}

export function nearestTraffic(
  level: LevelManifest,
  carDistance: number,
  elapsed: number,
): TrafficProximity | null {
  const nearest = level.traffic
    .map((vehicle) => trafficVehiclePose(level, vehicle, carDistance, elapsed))
    .sort((a, b) => a.distanceAhead - b.distanceAhead)[0]

  if (!nearest) {
    return null
  }

  return {
    vehicleId: nearest.vehicle.id,
    kind: nearest.vehicle.kind,
    distanceAhead: nearest.distanceAhead,
    lane: nearest.vehicle.lane,
    laneLateral: nearest.laneLateral,
    speed: nearest.vehicle.speed,
  }
}

export function trafficVehiclePose(
  level: LevelManifest,
  vehicle: TrafficVehicle,
  carDistance: number,
  elapsed: number,
): TrafficVehiclePose {
  const distanceAhead = trafficDistanceAhead(level, vehicle, carDistance, elapsed)
  const absoluteDistance = carDistance + distanceAhead

  return {
    vehicle,
    absoluteDistance,
    distanceAhead,
    laneLateral: trafficLaneLateral(level, vehicle, absoluteDistance),
  }
}

function findTrafficContact(
  level: LevelManifest,
  car: CarState,
  elapsed: number,
): TrafficContact {
  const contacts = level.traffic
    .map((vehicle) => {
      const trafficDistance = trafficDistanceAt(level, vehicle, elapsed)
      const distanceDelta = signedLapDelta(trafficDistance, car.distance, level.totalLength)
      const laneLateral = trafficLaneLateral(level, vehicle, trafficDistance)
      const lateralDelta = car.lateral - laneLateral

      return {
        collided:
          car.speed > vehicle.speed + 4 &&
          distanceDelta >= -1 &&
          distanceDelta <= TRAFFIC_HIT_LENGTH &&
          Math.abs(lateralDelta) <= TRAFFIC_HIT_WIDTH,
        vehicle,
        distanceDelta,
        lateralDelta,
      }
    })
    .filter((contact) => contact.collided)
    .sort((a, b) => Math.abs(a.distanceDelta) - Math.abs(b.distanceDelta))

  return contacts[0] ?? { collided: false }
}

function findTrafficNearMiss(
  runtime: TrafficRuntimeState,
  level: LevelManifest,
  car: CarState,
  elapsed: number,
): TrafficContact {
  const nearMisses = level.traffic
    .map((vehicle) => {
      const trafficDistance = trafficDistanceAt(level, vehicle, elapsed)
      const distanceDelta = signedLapDelta(trafficDistance, car.distance, level.totalLength)
      const laneLateral = trafficLaneLateral(level, vehicle, trafficDistance)
      const lateralDelta = car.lateral - laneLateral
      const recentlyAwarded =
        runtime.lastNearMissVehicleId === vehicle.id &&
        runtime.lastNearMissAt !== undefined &&
        elapsed - runtime.lastNearMissAt < TRAFFIC_NEAR_MISS_COOLDOWN

      return {
        collided: false,
        nearMissVehicle: vehicle,
        nearMissDistanceDelta: distanceDelta,
        nearMissLateralDelta: lateralDelta,
        nearMiss:
          !recentlyAwarded &&
          car.speed > vehicle.speed + 10 &&
          distanceDelta >= -1.5 &&
          distanceDelta <= TRAFFIC_HIT_LENGTH + 1.8 &&
          Math.abs(lateralDelta) > TRAFFIC_HIT_WIDTH &&
          Math.abs(lateralDelta) <= TRAFFIC_NEAR_MISS_MAX_WIDTH,
      }
    })
    .filter((contact) => contact.nearMiss)
    .sort((a, b) => Math.abs(a.nearMissDistanceDelta ?? 0) - Math.abs(b.nearMissDistanceDelta ?? 0))

  return nearMisses[0] ?? { collided: false }
}

function trafficDistanceAt(
  level: LevelManifest,
  vehicle: TrafficVehicle,
  elapsed: number,
): number {
  return wrapDistance(vehicle.distance + vehicle.speed * elapsed, level.totalLength)
}

function trafficDistanceAhead(
  level: LevelManifest,
  vehicle: TrafficVehicle,
  carDistance: number,
  elapsed: number,
): number {
  const trafficDistance = trafficDistanceAt(level, vehicle, elapsed)
  return wrapDistance(trafficDistance - wrapDistance(carDistance, level.totalLength), level.totalLength)
}

function trafficLaneLateral(
  level: LevelManifest,
  vehicle: TrafficVehicle,
  distance: number,
): number {
  return sampleTrack(level, distance).roadWidth * TRAFFIC_LANE_FACTOR * vehicle.lane
}

function signedLapDelta(targetDistance: number, carDistance: number, totalLength: number): number {
  const ahead = wrapDistance(targetDistance - wrapDistance(carDistance, totalLength), totalLength)
  return ahead > totalLength * 0.5 ? ahead - totalLength : ahead
}

function trafficPushDirection(contact: TrafficContact): -1 | 1 {
  if (contact.lateralDelta && Math.abs(contact.lateralDelta) > 0.1) {
    return contact.lateralDelta > 0 ? 1 : -1
  }

  return contact.vehicle?.lane === -1 ? 1 : -1
}
