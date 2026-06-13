import { createHud } from './hud.ts'
import { resolveRouteDifficulty } from './difficulty.ts'
import { createInputController } from './input.ts'
import { createSceneRenderer } from './scene.ts'
import { runCalibrationTrace } from './calibration.ts'
import { RacingSim } from './sim.ts'
import type { CalibrationSummary } from './calibration.ts'
import type { RacingSnapshot } from './sim.ts'

declare global {
  interface Window {
    __RPK_RACING_READY__?: boolean
    __RPK_RACING_STATE__?: {
      speed: number
      distance: number
      lateral: number
      collisions: number
      offroad: boolean
      gameMode: 'drift'
      score: number
      checkpointScore: number
      driftScore: number
      driftCombo: number
      bestDriftCombo: number
      styleScore: number
      styleCombo: number
      bestStyleCombo: number
      styleRank: string
      trafficVehicles: number
      trafficHits: number
      nearestTrafficDistance: number | null
      nearestTrafficLane: number | null
      difficultyId: string
      difficultyTitle: string
      generator: string
      calibration: CalibrationSummary
    }
  }
}

const FIXED_DT = 1 / 60
const MAX_FRAME_DT = 0.08

export function bootRacingGame(host: HTMLElement): void {
  host.innerHTML = ''
  const shell = document.createElement('main')
  shell.className = 'game-shell'
  shell.dataset.testid = 'game-shell'
  host.append(shell)

  const difficultyId = resolveRouteDifficulty(window.location.search)
  const sim = new RacingSim(difficultyId)
  const input = createInputController(window)
  const renderer = createSceneRenderer(shell, sim.level)
  const hud = createHud(shell)
  const calibration = runCalibrationTrace({ difficultyId }).summary
  let accumulator = 0
  let lastTime = performance.now()
  let animationFrame = 0
  let snapshot = sim.snapshot()

  const publishState = (state: RacingSnapshot) => {
    window.__RPK_RACING_STATE__ = {
      speed: state.car.speed,
      distance: state.car.distance,
      lateral: state.car.lateral,
      collisions: state.car.collisionCount,
      offroad: state.car.offroad,
      gameMode: 'drift',
      score: state.telemetry.score,
      checkpointScore: state.telemetry.checkpointScore,
      driftScore: state.telemetry.styleScore,
      driftCombo: state.telemetry.styleCombo,
      bestDriftCombo: state.telemetry.bestStyleCombo,
      styleScore: state.telemetry.styleScore,
      styleCombo: state.telemetry.styleCombo,
      bestStyleCombo: state.telemetry.bestStyleCombo,
      styleRank: state.telemetry.styleRank,
      trafficVehicles: state.traffic.vehicleCount,
      trafficHits: state.traffic.hitCount,
      nearestTrafficDistance: state.traffic.nearest?.distanceAhead ?? null,
      nearestTrafficLane: state.traffic.nearest?.lane ?? null,
      difficultyId: state.level.difficulty.id,
      difficultyTitle: state.level.difficulty.title,
      generator: state.level.generator,
      calibration,
    }
    shell.dataset.ready = 'true'
    shell.dataset.speed = state.car.speed.toFixed(2)
    shell.dataset.distance = state.car.distance.toFixed(2)
    shell.dataset.lateral = state.car.lateral.toFixed(2)
  }

  const frame = (time: number) => {
    const frameDt = Math.min(MAX_FRAME_DT, (time - lastTime) / 1000)
    lastTime = time
    accumulator += frameDt

    if (input.consumeReset()) {
      snapshot = sim.reset()
    }

    while (accumulator >= FIXED_DT) {
      snapshot = sim.step(input.state, FIXED_DT)
      accumulator -= FIXED_DT
    }

    renderer.render(snapshot)
    hud.update(snapshot)
    publishState(snapshot)
    window.__RPK_RACING_READY__ = true
    animationFrame = requestAnimationFrame(frame)
  }

  const onResize = () => renderer.resize()
  window.addEventListener('resize', onResize)
  renderer.render(snapshot)
  hud.update(snapshot)
  publishState(snapshot)
  animationFrame = requestAnimationFrame(frame)

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(animationFrame)
    window.removeEventListener('resize', onResize)
    input.dispose()
    renderer.dispose()
    hud.root.remove()
  })
}
