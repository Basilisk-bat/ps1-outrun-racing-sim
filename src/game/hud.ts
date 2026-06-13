import type { RacingSnapshot } from './sim.ts'

export interface Hud {
  root: HTMLElement
  update: (snapshot: RacingSnapshot) => void
}

export function createHud(host: HTMLElement): Hud {
  const root = document.createElement('div')
  root.innerHTML = `
    <section class="hud-panel" data-testid="hud-panel" aria-label="Race telemetry">
      <div class="hud-title">NEON RIDGE</div>
      ${row('SPD', 'speed')}
      ${row('DST', 'distance')}
      ${row('CP', 'checkpoint')}
      ${row('SEC', 'section')}
      ${row('GRD', 'grade')}
      ${row('STY', 'style')}
      ${row('HIT', 'collisions')}
    </section>
    <section class="debug-panel" data-testid="debug-panel" aria-label="Engine debug">
      ${row('TOP', 'topSpeed')}
      ${row('PAR', 'target')}
      ${row('SPL', 'split')}
      ${row('SCR', 'score')}
      ${row('DRF', 'styleScore')}
      ${row('CHN', 'styleCombo')}
      ${row('OFF', 'offroad')}
      ${row('LAT', 'lateral')}
      ${row('LAP', 'lap')}
    </section>
    <div class="title-strip" data-testid="title-strip">ENGINE MILESTONE 01</div>
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
      set(values, 'checkpoint', `${Math.floor(snapshot.nextCheckpoint)} M`)
      set(values, 'section', snapshot.currentSection.title.toUpperCase())
      set(values, 'grade', snapshot.telemetry.lastCheckpoint?.grade.toUpperCase() ?? 'READY')
      set(values, 'style', snapshot.telemetry.styleRank.toUpperCase())
      set(values, 'collisions', `${snapshot.car.collisionCount}`)
      set(values, 'topSpeed', `${Math.round(snapshot.telemetry.topSpeed)} KMH`)
      set(values, 'target', `${snapshot.checkpointTargetSeconds.toFixed(1)} S`)
      set(
        values,
        'split',
        snapshot.telemetry.lastCheckpoint
          ? `${formatSigned(snapshot.telemetry.lastCheckpoint.deltaSeconds)} S`
          : '0.0 S',
      )
      set(values, 'score', `${snapshot.telemetry.score}`)
      set(values, 'styleScore', `${snapshot.telemetry.styleScore}`)
      set(values, 'styleCombo', `${snapshot.telemetry.styleCombo}`)
      set(values, 'offroad', `${snapshot.telemetry.offroadTime.toFixed(1)} S`)
      set(values, 'lateral', snapshot.car.lateral.toFixed(1))
      set(values, 'lap', `${snapshot.telemetry.currentLap + 1}`)
      if (titleStrip) {
        titleStrip.textContent = [
          snapshot.level.title,
          snapshot.level.difficulty.title.toUpperCase(),
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

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}`
}
