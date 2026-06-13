import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import type { Page } from '@playwright/test'

test('renders a nonblank playable canvas', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  const canvas = page.getByTestId('game-canvas')
  await expect(canvas).toBeVisible()
  const canvasRect = await canvas.boundingBox()
  expect(canvasRect?.width).toBeGreaterThan(300)
  expect(canvasRect?.height).toBeGreaterThan(300)

  const screenshot = await canvas.screenshot()
  const png = PNG.sync.read(screenshot)
  const uniqueColors = new Set<string>()

  for (let y = 0; y < png.height; y += 20) {
    for (let x = 0; x < png.width; x += 20) {
      const offset = (png.width * y + x) * 4
      uniqueColors.add(
        `${png.data[offset]},${png.data[offset + 1]},${png.data[offset + 2]},${png.data[offset + 3]}`,
      )
    }
  }

  expect(uniqueColors.size).toBeGreaterThan(8)
})

test('input changes speed, distance, and steering state', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)
  const before = await readState(page)

  await page.keyboard.down('ArrowUp')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(900)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.up('ArrowUp')

  const after = await readState(page)
  expect(after.speed).toBeGreaterThan(before.speed)
  expect(after.distance).toBeGreaterThan(before.distance)
  expect(after.lateral).toBeGreaterThan(before.lateral)
})

test('drift score economy state is exposed in browser telemetry', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  await page.keyboard.down('ArrowUp')
  await page.waitForFunction(() => {
    const state = window.__RPK_RACING_STATE__
    return Boolean(state && state.speed >= 54)
  })
  await page.keyboard.down('ArrowRight')
  await page.keyboard.down('ArrowDown')
  let driftState: Awaited<ReturnType<typeof readState>> | undefined
  try {
    await page.waitForFunction(
      () => {
        const state = window.__RPK_RACING_STATE__
        return Boolean(
          state &&
            state.gameMode === 'drift' &&
            state.driftScore > 0 &&
            state.driftCombo > 0 &&
            state.bestDriftCombo >= state.driftCombo &&
            state.styleRank === 'drift' &&
            state.score === state.checkpointScore + state.styleScore,
        )
      },
      undefined,
      { timeout: 6_000 },
    )
    driftState = await readState(page)
  } finally {
    await page.keyboard.up('ArrowDown')
    await page.keyboard.up('ArrowRight')
    await page.keyboard.up('ArrowUp')
  }

  const state = await readState(page)
  if (!driftState) {
    throw new Error('Missing drift telemetry state')
  }
  expect(state.gameMode).toBe('drift')
  expect(state.difficultyId).toBe('arcade')
  expect(state.difficultyTitle).toBe('Arcade')
  expect(state.generator).toBe('infinite-ridge-v1')
  expect(driftState.styleRank).toBe('drift')
  expect(state.driftScore).toBeGreaterThan(0)
  expect(state.driftCombo).toBeGreaterThan(0)
  expect(state.bestDriftCombo).toBeGreaterThanOrEqual(state.driftCombo)
  expect(state.score).toBe(state.checkpointScore + state.styleScore)
  expect(state.timeRemaining).toBeGreaterThan(0)
  expect(state.raceExpired).toBe(false)
  expect(state.lastArcadeBanner.length).toBeGreaterThan(0)
  expect(state.boostMeter).toBeGreaterThan(0)
  expect(state.rivalPressure).toBeGreaterThanOrEqual(0)
  expect(state.rivalStatus.length).toBeGreaterThan(0)
  expect(state.trafficVehicles).toBeGreaterThan(4)
  expect(state.trafficHits).toBe(0)
  expect(state.nearestTrafficDistance).toBeGreaterThan(0)

  await expect(page.getByTestId('hud-panel')).toContainText('DRF')
  await expect(page.getByTestId('hud-panel')).toContainText('COM')
  await expect(page.getByTestId('hud-panel')).toContainText('BST')
  await expect(page.getByTestId('hud-panel')).toContainText('NIT')
  await expect(page.getByTestId('hud-panel')).toContainText('ZON')
  await expect(page.getByTestId('hud-panel')).toContainText('RIV')
  await expect(page.getByTestId('hud-panel')).toContainText('TIM')
  await expect(page.getByTestId('debug-panel')).toContainText('AWD')
  await expect(page.getByTestId('debug-panel')).toContainText('ZSC')
  await expect(page.getByTestId('debug-panel')).toContainText('EXT')
  await expect(page.getByTestId('debug-panel')).toContainText('RCV')
  await expect(page.getByTestId('hud-panel')).toContainText('TRF')
  await expect(page.getByTestId('arcade-banner')).toBeVisible()
  await expect(page.getByTestId('title-strip')).toContainText('DRIFT')
})

test('authored drift zones score in browser telemetry', async ({ page }) => {
  await page.goto('/?difficulty=rival')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  await page.keyboard.down('ArrowUp')
  await page.waitForFunction(() => {
    const state = window.__RPK_RACING_STATE__
    return Boolean(state && state.speed >= 58)
  })
  await page.keyboard.down('ArrowRight')
  await page.keyboard.down('ArrowDown')
  try {
    await page.waitForFunction(
      () => {
        const state = window.__RPK_RACING_STATE__
        return Boolean(
          state &&
            state.activeDriftZoneId &&
            state.activeDriftZoneScore > 0 &&
            state.activeDriftZoneTarget > 0,
        )
      },
      undefined,
      { timeout: 8_000 },
    )
  } finally {
    await page.keyboard.up('ArrowDown')
    await page.keyboard.up('ArrowRight')
    await page.keyboard.up('ArrowUp')
  }

  const state = await readState(page)
  expect(state.activeDriftZoneId).toContain('drift-zone')
  expect(state.activeDriftZoneTitle).toContain('Drift')
  expect(state.driftZoneScore).toBeGreaterThan(0)
  expect(state.rivalGapMeters).not.toBeNaN()
  expect(state.rivalPressure).toBeGreaterThanOrEqual(0)
  await expect(page.getByTestId('hud-panel')).toContainText('ZON')
  await expect(page.getByTestId('hud-panel')).toContainText('RIV')
  await expect(page.getByTestId('debug-panel')).toContainText('ZSC')
})

test('boost charges from drift input and drains while held', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  await page.keyboard.down('ArrowUp')
  await page.waitForFunction(() => {
    const state = window.__RPK_RACING_STATE__
    return Boolean(state && state.speed >= 58)
  })
  await page.keyboard.down('ArrowRight')
  await page.keyboard.down('ArrowDown')
  let chargedBoost = 0
  let drainedBoost = 0
  try {
    await page.waitForFunction(() => {
      const state = window.__RPK_RACING_STATE__
      return Boolean(state && state.boostMeter >= 8 && state.styleRank === 'drift')
    })
    chargedBoost = (await readState(page)).boostMeter

    await page.keyboard.down('Space')
    await page.waitForFunction((boostBefore) => {
      const state = window.__RPK_RACING_STATE__
      return Boolean(state && state.boostActive && state.boostMeter < boostBefore)
    }, chargedBoost)
    drainedBoost = (await readState(page)).boostMeter
  } finally {
    await page.keyboard.up('Space')
    await page.keyboard.up('ArrowDown')
    await page.keyboard.up('ArrowRight')
    await page.keyboard.up('ArrowUp')
  }

  const state = await readState(page)
  expect(chargedBoost).toBeGreaterThan(0)
  expect(drainedBoost).toBeLessThan(chargedBoost)
  expect(state.boostMeter).toBeGreaterThanOrEqual(0)
  await expect(page.getByTestId('hud-panel')).toContainText('NIT')
})

test('difficulty query parameter selects the playable route profile', async ({ page }) => {
  await page.goto('/?difficulty=rival')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  const state = await readState(page)
  expect(state.difficultyId).toBe('rival')
  expect(state.difficultyTitle).toBe('Rival')

  await expect(page.getByTestId('title-strip')).toContainText('RIVAL DRIFT')
})

test('the ridge opens as an endless drift game without a seed parameter', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  const state = await readState(page)
  expect(state.gameMode).toBe('drift')
  expect(state.generator).toBe('infinite-ridge-v1')
  await expect(page.getByTestId('debug-panel')).not.toContainText('GEN')
})

test('arcade timer counts down in browser telemetry', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  const before = await readState(page)
  await page.waitForTimeout(750)
  const after = await readState(page)

  expect(before.timeRemaining).toBeGreaterThan(after.timeRemaining)
  expect(after.timeRemaining).toBeGreaterThan(0)
  expect(after.timeExtendedSeconds).toBe(0)
  expect(after.raceExpired).toBe(false)
  expect(after.lastArcadeBanner).toBeTruthy()
  await expect(page.getByTestId('arcade-banner')).toContainText(after.lastArcadeBanner)
})

test('hud panels are framed without overlapping each other', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  const hud = await page.getByTestId('hud-panel').boundingBox()
  const debug = await page.getByTestId('debug-panel').boundingBox()
  const banner = await page.getByTestId('arcade-banner').boundingBox()
  const title = await page.getByTestId('title-strip').boundingBox()
  const viewport = page.viewportSize()

  expect(hud).not.toBeNull()
  expect(debug).not.toBeNull()
  expect(banner).not.toBeNull()
  expect(title).not.toBeNull()
  expect(viewport).not.toBeNull()

  if (!hud || !debug || !banner || !title || !viewport) {
    return
  }

  expect(overlaps(hud, debug)).toBe(false)
  expect(overlaps(hud, banner)).toBe(false)
  expect(overlaps(hud, title)).toBe(false)
  expect(overlaps(debug, banner)).toBe(false)
  expect(overlaps(debug, title)).toBe(false)
  expect(overlaps(banner, title)).toBe(false)
  expect(hud.x).toBeGreaterThanOrEqual(0)
  expect(debug.x + debug.width).toBeLessThanOrEqual(viewport.width)
  expect(banner.x).toBeGreaterThanOrEqual(0)
  expect(banner.x + banner.width).toBeLessThanOrEqual(viewport.width)
  expect(title.y + title.height).toBeLessThanOrEqual(viewport.height)
})

async function readState(page: Page) {
  return page.evaluate(() => {
    if (!window.__RPK_RACING_STATE__) {
      throw new Error('Missing racing state')
    }
    return window.__RPK_RACING_STATE__
  })
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
