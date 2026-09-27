/**
 * Live probe: Jo AI beyond simple tasks — UI/system change + KO/workout.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.JO_AI_DEMO_URL || 'https://vps-01d88277.vps.ovh.net'
const OUT = '/opt/cursor/artifacts'
mkdirSync(OUT, { recursive: true })

const report = []
const push = (entry) => {
  report.push(entry)
  console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.id}: ${entry.detail || ''}`)
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

async function dismissOverlays() {
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
  }
  await page.locator('.change-preview button:has-text("Abbrechen")').click().catch(() => {})
  await page.locator('.change-preview button:has-text("Verstanden")').click().catch(() => {})
  await page.locator('.capture-sheet button[aria-label="Schließen"]').click().catch(() => {})
  await page.waitForTimeout(300)
}

async function openCapture() {
  await dismissOverlays()
  await page.goto(`${BASE}/#/heute`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.splash-screen', { state: 'detached', timeout: 20000 }).catch(() => {})
  if (await page.locator('text=Ritual heute überspringen').count()) {
    await page.locator('text=Ritual heute überspringen').click({ force: true }).catch(() => {})
    await page.waitForTimeout(400)
  }
  await page.goto(`${BASE}/#/heute?action=capture`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.splash-screen', { state: 'detached', timeout: 20000 }).catch(() => {})
  if (await page.locator('text=Ritual heute überspringen').count()) {
    await page.locator('text=Ritual heute überspringen').click({ force: true }).catch(() => {})
  }
  await page.waitForSelector('.capture-sheet__input', { timeout: 20000 })
}

async function submitText(text) {
  await openCapture()
  await page.fill('.capture-sheet__input', text, { timeout: 10000 })
  await page.click('.capture-sheet__primary')
  await page.waitForTimeout(1500)
  let changePreview = 0
  for (const sel of ['.change-preview', 'text=Übernehmen', 'text=Anwenden']) {
    changePreview += await page.locator(sel).count().catch(() => 0)
  }
  return {
    changePreview,
    suggest: await page.locator('.capture-suggest').count(),
    eyebrow: await page.locator('.capture-sheet__eyebrow, .change-preview .eyebrow').first().innerText().catch(() => ''),
    meta: await page.locator('.capture-suggest__meta, .change-preview__list').first().innerText().catch(() => ''),
    body: await page.locator('body').innerText().catch(() => ''),
  }
}

try {
  const task = await submitText('Milch kaufen')
  push({ id: 'simple-task', ok: task.suggest > 0 && /Vorschlag/i.test(task.eyebrow), detail: task.eyebrow })
  await dismissOverlays()

  const uiEnergy = await submitText('Entferne Energy von Heute')
  push({
    id: 'ui-change-energy',
    ok: uiEnergy.changePreview > 0 || /Energy removed|Änderung/i.test(uiEnergy.body),
    detail: uiEnergy.body.replace(/\s+/g, ' ').slice(0, 200),
  })
  await page.screenshot({ path: `${OUT}/kf-ui-energy.png` })
  await dismissOverlays()

  const uiLab = await submitText('Lab kompakter mit progressive disclosure')
  push({
    id: 'ui-change-lab',
    ok: uiLab.changePreview > 0 || /Lab density|compact|Änderung/i.test(uiLab.body),
    detail: uiLab.body.replace(/\s+/g, ' ').slice(0, 200),
  })
  await page.screenshot({ path: `${OUT}/kf-ui-lab.png` })
  await dismissOverlays()

  const koBefore = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('life-os-morning-ritual-progress') || 'null') } catch { return null }
  })
  const ko = await submitText('10 KO gemacht')
  push({
    id: 'ko-suggest',
    ok: ko.suggest > 0 && /KO|Workout|Vorschlag/i.test(`${ko.eyebrow}\n${ko.meta}`),
    detail: `${ko.eyebrow} | ${ko.meta}`.replace(/\s+/g, ' ').slice(0, 180),
  })
  if (ko.suggest > 0) {
    await page.click('.capture-sheet__primary')
    await page.waitForTimeout(1000)
  }
  const koAfter = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('life-os-morning-ritual-progress') || 'null') } catch { return null }
  })
  push({
    id: 'ko-ritual-write',
    ok: Number(koAfter?.ko || 0) >= 10,
    detail: JSON.stringify({ before: koBefore?.ko ?? 0, after: koAfter?.ko ?? 0 }),
  })
  await page.screenshot({ path: `${OUT}/kf-ko.png` })
  await dismissOverlays()

  const meal = await submitText('Proteinshake getrunken')
  push({
    id: 'meal-keyfeature',
    ok: meal.suggest > 0 && /Mahlzeit|Vorschlag/i.test(`${meal.eyebrow}\n${meal.meta}`),
    detail: `${meal.eyebrow} | ${meal.meta}`.replace(/\s+/g, ' ').slice(0, 160),
  })
} catch (error) {
  push({ id: 'fatal', ok: false, detail: String(error) })
}

await browser.close()
writeFileSync(`${OUT}/jo-ai-keyfeature-report.json`, JSON.stringify(report, null, 2))
const failed = report.filter(i => !i.ok)
console.log(JSON.stringify({ total: report.length, failed: failed.length, failedIds: failed.map(i => i.id) }, null, 2))
process.exit(failed.length ? 1 : 0)
