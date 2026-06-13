import type { RacingSnapshot } from './sim.ts'

export interface Hud {
  root: HTMLElement
  update: (snapshot: RacingSnapshot) => void
}

export function createHud(host: HTMLElement): Hud {
  const root = document.createElement('div')
  root.innerHTML = `
    <section class="hud-panel" data-testid="hud-panel" aria-label="Drift telemetry">
      <div class="hud-title">NEON RIDGE DRIFT</div>
      ${row('SPD', 'speed')}
      ${row('DST', 'distance')}
      ${row('SEC', 'section')}
      ${row('SCR', 'score')}
      ${row('DRF', 'styleScore')}
      ${row('COM', 'styleCombo')}
      ${row('BST', 'bestStyleCombo')}
      ${row('NIT', 'boost')}
      ${row('TRF', 'traffic')}
      ${row('HIT', 'collisions')}
      ${row('MIS', 'nearMisses')}
    </section>
    <section class="debug-panel" data-testid="debug-panel" aria-label="Engine debug">
      ${row('STY', 'style')}
      ${row('TOP', 'topSpeed')}
      ${row('AWD', 'award')}
      ${row('RCV', 'recovery')}
      ${row('OFF', 'offroad')}
      ${row('LAT', 'lateral')}
      ${row('RUN', 'elapsed')}
    </section>
    <div class="title-strip" data-testid="title-strip">DRIFT MILESTONE 02</div>
  `
  host.append(root)

  const values = new Map<string, HTMLElement>()
  root.querySelectorAll<HTMLElement>('[data-hud-value]').forEach((element) => {
    values.set(element.dataset.hudValue ?? '', element)
  })
  const titleStrip = root.querySelector<HTMLElement>('[data-testid="title-strip"]')

  return {
    root,
    update: (snapshot) => {
      set(values, 'speed', `${Math.round(snapshot.car.speed).toString().padStart(3, '0')} KMH`)
      set(values, 'distance', `${Math.floor(snapshot.car.distance)} M`)
      set(values, 'section', snapshot.currentSection.title.toUpperCase())
      set(values, 'score', `${snapshot.telemetry.score}`)
      set(values, 'styleScore', `${snapshot.telemetry.styleScore}`)
      set(values, 'styleCombo', `${snapshot.telemetry.styleCombo}`)
      set(values, 'bestStyleCombo', `${snapshot.telemetry.bestStyleCombo}`)
      set(
        values,
        'boost',
        `${Math.round(snapshot.car.boostMeter)}%${snapshot.car.boostActive ? ' ON' : ''}`,
      )
      set(
        values,
        'traffic',
        snapshot.traffic.nearest
          ? `${Math.round(snapshot.traffic.nearest.distanceAhead)} M`
          : 'CLEAR',
      )
      set(values, 'collisions', `${snapshot.car.collisionCount}`)
      set(values, 'nearMisses', `${snapshot.traffic.nearMissCount}`)
      set(values, 'style', snapshot.telemetry.styleRank.toUpperCase())
      set(values, 'topSpeed', `${Math.round(snapshot.telemetry.topSpeed)} KMH`)
      set(
        values,
        'award',
        snapshot.telemetry.lastStyleAward
          ? `+${snapshot.telemetry.lastStyleAward.points}`
          : 'READY',
      )
      set(
        values,
        'recovery',
        snapshot.car.recoverySeconds > 0
          ? `${snapshot.car.recoverySeconds.toFixed(1)} S`
          : 'READY',
      )
      set(values, 'offroad', `${snapshot.telemetry.offroadTime.toFixed(1)} S`)
      set(values, 'lateral', snapshot.car.lateral.toFixed(1))
      set(values, 'elapsed', `${snapshot.telemetry.elapsed.toFixed(1)} S`)
      if (titleStrip) {
        titleStrip.textContent = [
          snapshot.level.title,
          `${snapshot.level.difficulty.title.toUpperCase()} DRIFT`,
          snapshot.currentSection.title,
        ].join(' / ')
      }
    },
  }
}

function row(label: string, key: string): string {
  return `
    <div class="hud-row">
      <span class="hud-label">${label}</span>
      <span class="hud-value" data-hud-value="${key}">0</span>
    </div>
  `
}

function set(values: Map<string, HTMLElement>, key: string, value: string): void {
  const element = values.get(key)
  if (element) {
    element.textContent = value
  }
}
