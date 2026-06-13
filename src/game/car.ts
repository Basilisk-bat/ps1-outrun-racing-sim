import type { InputState } from './input.ts'
import type { TrackSample } from './track.ts'

export interface CarState {
  speed: number
  distance: number
  lateral: number
  lateralVelocity: number
  drift: number
  heading: number
  offroad: boolean
  collisionCount: number
  collisionCooldown: number
  boostMeter: number
  boostActive: boolean
  recoverySeconds: number
}

export interface CarUpdateResult {
  collided: boolean
  offroad: boolean
}

export const CAR_LIMITS = {
  maxSpeed: 132,
  reverseSpeed: -18,
  acceleration: 76,
  braking: 92,
  driftBrake: 46,
  drag: 14,
  offroadDrag: 62,
  steerForce: 42,
  lateralDamping: 5.2,
  driftDamping: 2.6,
  driftKick: 34,
  boostMaxSpeed: 154,
  boostAcceleration: 92,
  boostDrain: 38,
  boostDriftCharge: 16,
  boostMinSpeed: 38,
  nearMissBoostAward: 18,
  collisionBoostPenalty: 24,
  collisionCooldown: 0.8,
  recoverySeconds: 1.15,
}

const MAX_BOOST_METER = 100

export function createInitialCarState(): CarState {
  return {
    speed: 0,
    distance: 12,
    lateral: 0,
    lateralVelocity: 0,
    drift: 0,
    heading: 0,
    offroad: false,
    collisionCount: 0,
    collisionCooldown: 0,
    boostMeter: 0,
    boostActive: false,
    recoverySeconds: 0,
  }
}

export function updateCar(
  car: CarState,
  input: InputState,
  track: TrackSample,
  dt: number,
): CarUpdateResult {
  const roadHalfWidth = track.roadWidth * 0.5
  const collisionLimit = track.roadWidth * 0.68
  const wasOffroad = Math.abs(car.lateral) > roadHalfWidth
  const driftIntent = input.brake && input.steer !== 0 && car.speed > 30
  car.collisionCooldown = Math.max(0, car.collisionCooldown - dt)
  car.recoverySeconds = Math.max(0, car.recoverySeconds - dt)
  const boosting =
    input.boost &&
    car.boostMeter > 0 &&
    car.speed >= CAR_LIMITS.boostMinSpeed &&
    !wasOffroad &&
    car.recoverySeconds === 0
  const engineForce = input.accelerate ? CAR_LIMITS.acceleration : 0
  const brakeForce = input.brake
    ? driftIntent
      ? CAR_LIMITS.driftBrake
      : CAR_LIMITS.braking
    : 0
  const drag = wasOffroad ? CAR_LIMITS.offroadDrag : CAR_LIMITS.drag
  const dragForce = car.speed > 0 ? drag : drag * 0.35
  const speedDelta =
    engineForce + (boosting ? CAR_LIMITS.boostAcceleration : 0) - brakeForce - dragForce

  car.speed = clamp(
    car.speed + speedDelta * dt,
    CAR_LIMITS.reverseSpeed,
    boosting ? CAR_LIMITS.boostMaxSpeed : CAR_LIMITS.maxSpeed,
  )

  if (!input.accelerate && !input.brake && Math.abs(car.speed) < 1.5) {
    car.speed = 0
  }

  const speedRatio = Math.max(0.18, Math.abs(car.speed) / CAR_LIMITS.maxSpeed)
  const curvePush = -track.curve * Math.max(0.2, speedRatio) * 10
  const steerPush = input.steer * CAR_LIMITS.steerForce * speedRatio
  const driftPush = driftIntent ? input.steer * CAR_LIMITS.driftKick * speedRatio : 0

  car.lateralVelocity += (steerPush + curvePush + driftPush) * dt
  car.lateralVelocity *= Math.exp(
    -(driftIntent ? CAR_LIMITS.driftDamping : CAR_LIMITS.lateralDamping) * dt,
  )
  car.lateral += car.lateralVelocity * dt
  car.drift = clamp(car.lateralVelocity / 12 + (driftIntent ? input.steer * 0.18 : 0), -1.2, 1.2)
  car.heading = clamp(car.drift * 0.32 + track.curve * 0.12, -0.52, 0.52)
  car.distance += Math.max(0, car.speed) * dt
  car.offroad = Math.abs(car.lateral) > roadHalfWidth
  car.boostActive = boosting && car.boostMeter > 0

  if (car.boostActive) {
    car.boostMeter = clamp(car.boostMeter - CAR_LIMITS.boostDrain * dt, 0, MAX_BOOST_METER)
  } else if (car.speed >= CAR_LIMITS.boostMinSpeed && Math.abs(car.drift) >= 0.22 && !car.offroad) {
    car.boostMeter = clamp(
      car.boostMeter + CAR_LIMITS.boostDriftCharge * Math.abs(car.drift) * dt,
      0,
      MAX_BOOST_METER,
    )
  }

  let collided = false
  if (Math.abs(car.lateral) > collisionLimit && car.collisionCooldown === 0) {
    collided = true
    car.collisionCount += 1
    car.collisionCooldown = CAR_LIMITS.collisionCooldown
    car.recoverySeconds = CAR_LIMITS.recoverySeconds
    car.boostActive = false
    car.boostMeter = Math.max(0, car.boostMeter - CAR_LIMITS.collisionBoostPenalty)
    car.speed = Math.max(22, car.speed * 0.58)
    car.lateral = Math.sign(car.lateral) * collisionLimit
    car.lateralVelocity *= -0.22
  }

  return {
    collided,
    offroad: car.offroad,
  }
}

export function resetCar(car: CarState): void {
  const fresh = createInitialCarState()
  car.speed = fresh.speed
  car.distance = fresh.distance
  car.lateral = fresh.lateral
  car.lateralVelocity = fresh.lateralVelocity
  car.drift = fresh.drift
  car.heading = fresh.heading
  car.offroad = fresh.offroad
  car.collisionCount = fresh.collisionCount
  car.collisionCooldown = fresh.collisionCooldown
  car.boostMeter = fresh.boostMeter
  car.boostActive = fresh.boostActive
  car.recoverySeconds = fresh.recoverySeconds
}

export function awardCarBoost(car: CarState, amount: number): void {
  car.boostMeter = clamp(car.boostMeter + amount, 0, MAX_BOOST_METER)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
