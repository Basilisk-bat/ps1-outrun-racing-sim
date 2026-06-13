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

test('score economy state is exposed in browser telemetry', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  await page.keyboard.down('ArrowUp')
  try {
    await page.waitForFunction(
      () => {
        const state = window.__RPK_RACING_STATE__
        return Boolean(
          state &&
            state.speed >= 70 &&
            state.styleScore > 0 &&
            state.styleCombo > 0 &&
            state.bestStyleCombo >= state.styleCombo &&
            state.score === state.checkpointScore + state.styleScore,
        )
      },
      undefined,
      { timeout: 6_000 },
    )
  } finally {
    await page.keyboard.up('ArrowUp')
  }

  const state = await readState(page)
  expect(state.difficultyId).toBe('arcade')
  expect(state.difficultyTitle).toBe('Arcade')
  expect(state.styleRank).toBe('clean')
  expect(state.styleScore).toBeGreaterThan(0)
  expect(state.styleCombo).toBeGreaterThan(0)
  expect(state.bestStyleCombo).toBeGreaterThanOrEqual(state.styleCombo)
  expect(state.score).toBe(state.checkpointScore + state.styleScore)
  expect(state.calibration.completedLaps).toBe(1)
  expect(state.calibration.completedCheckpoints).toBe(4)
  expect(state.calibration.paceVerdict).toBe('on-pace')
  expect(state.calibration.averageDeltaSeconds).toBeGreaterThan(-2)
  expect(state.calibration.averageDeltaSeconds).toBeLessThan(-0.5)

  await expect(page.getByTestId('hud-panel')).toContainText('STY')
  await expect(page.getByTestId('debug-panel')).toContainText('DRF')
  await expect(page.getByTestId('debug-panel')).toContainText('CHN')
  await expect(page.getByTestId('title-strip')).toContainText('ARCADE')
})

test('difficulty query parameter selects the playable route profile', async ({ page }) => {
  await page.goto('/?difficulty=rival')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  const state = await readState(page)
  expect(state.difficultyId).toBe('rival')
  expect(state.difficultyTitle).toBe('Rival')
  expect(state.calibration.completedLaps).toBe(1)

  await expect(page.getByTestId('title-strip')).toContainText('RIVAL')
})

test('hud panels are framed without overlapping each other', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__RPK_RACING_READY__ === true)

  const hud = await page.getByTestId('hud-panel').boundingBox()
  const debug = await page.getByTestId('debug-panel').boundingBox()
  const title = await page.getByTestId('title-strip').boundingBox()
  const viewport = page.viewportSize()

  expect(hud).not.toBeNull()
  expect(debug).not.toBeNull()
  expect(title).not.toBeNull()
  expect(viewport).not.toBeNull()

  if (!hud || !debug || !title || !viewport) {
    return
  }

  expect(overlaps(hud, debug)).toBe(false)
  expect(overlaps(hud, title)).toBe(false)
  expect(overlaps(debug, title)).toBe(false)
  expect(hud.x).toBeGreaterThanOrEqual(0)
  expect(debug.x + debug.width).toBeLessThanOrEqual(viewport.width)
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
