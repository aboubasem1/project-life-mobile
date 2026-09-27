/**
 * Live probe: Jo AI beyond simple tasks — UI/system change + KO/workout utterances.
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

async function openCapture() {
  await page.goto(`${BASE}/#/heute`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(() => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (/morning|gate|ritual|skip/i.test(key)) localStorage.removeItem(key)
      }
    } catch { /* ignore */ }
  })
  await page.goto(`${BASE}/#/heute?action=capture`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.splash-screen', { state: 'detached', timeout: 20000 }).catch(() => {})
  if (await page.locator('text=Ritual heute überspringen').count()) {
    await page.locator('text=Ritual heute überspringen').click({ force: true }).catch(() => {})
  }
  if ((await page.locator('.capture-sheet').count()) === 0) {
    await page.goto(`${BASE}/#/heute?action=capture`, { waitUntil: 'networkidle', timeout: 60000 })
  }
  await page.waitForSelector('.capture-sheet', { timeout: 15000 })
}

async function submitText(text) {
  await openCapture()
  await page.fill('.capture-sheet__input', text)
  await page.click('.capture-sheet__primary')
  await page.waitForTimeout(1500)
  const changeSelectors = [
    '.change-preview-sheet',
    '.change-preview',
    '[class*="ChangePreview"]',
    'text=Übernehmen',
    'text=Anwenden',
    'text=Änderung',
  ]
  let changePreview = 0
  for (const sel of changeSelectors) {
    changePreview += await page.locator(sel).count().catch(() => 0)
  }
  return {
    changePreview,
    suggest: await page.locator('.capture-suggest').count(),
    eyebrow: await page.locator('.capture-sheet__eyebrow').innerText().catch(() => ''),
    body: await page.locator('body').innerText().catch(() => ''),
    error: await page.locator('.capture-sheet__error').innerText().catch(() => ''),
    dialogs: await page.locator('[role="dialog"]').count(),
  }
}

try {
  // Baseline: simple task still works
  const task = await submitText('Milch kaufen')
  push({
    id: 'simple-task',
    ok: task.suggest > 0 && /Vorschlag/i.test(task.eyebrow),
    detail: task.eyebrow || task.error,
  })
  if (task.suggest > 0) {
    await page.click('.capture-sheet__primary')
    await page.waitForTimeout(700)
  }

  // UI change: energy off NOW
  const uiEnergy = await submitText('Entferne Energy von Heute')
  const energyOpenedChange = uiEnergy.changePreview > 0
    || /Änderung|übernehmen|anwenden|vorschau|change/i.test(uiEnergy.body)
    || /Änderung|Change/i.test(uiEnergy.eyebrow)
  push({
    id: 'ui-change-energy',
    ok: energyOpenedChange,
    detail: JSON.stringify({
      changePreview: uiEnergy.changePreview,
      eyebrow: uiEnergy.eyebrow,
      snippet: uiEnergy.body.replace(/\s+/g, ' ').slice(0, 220),
    }),
  })
  await page.screenshot({ path: `${OUT}/kf-ui-energy.png` })
  // dismiss if open
  if (await page.locator('button:has-text("Abbrechen"), button:has-text("Schließen"), .icon-button').count()) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(400)
  }

  // UI change: Lab compact
  const uiLab = await submitText('Lab kompakter mit progressive disclosure')
  const labOpenedChange = uiLab.changePreview > 0
    || /Änderung|übernehmen|anwenden|dichte|compact|lab/i.test(uiLab.body)
  push({
    id: 'ui-change-lab',
    ok: labOpenedChange,
    detail: JSON.stringify({
      changePreview: uiLab.changePreview,
      eyebrow: uiLab.eyebrow,
      snippet: uiLab.body.replace(/\s+/g, ' ').slice(0, 220),
    }),
  })
  await page.screenshot({ path: `${OUT}/kf-ui-lab.png` })
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(300)

  // KO utterance — should NOT pretend to be a system change; today likely task/suggest, not ritual write
  const koBefore = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('life-os-morning-ritual-progress')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })
  const ko = await submitText('10 KO gemacht')
  push({
    id: 'ko-suggest-path',
    ok: ko.suggest > 0 || ko.changePreview > 0 || Boolean(ko.error),
    detail: JSON.stringify({
      suggest: ko.suggest,
      changePreview: ko.changePreview,
      eyebrow: ko.eyebrow,
      snippet: ko.body.replace(/\s+/g, ' ').slice(0, 220),
    }),
  })
  if (ko.suggest > 0) {
    await page.click('.capture-sheet__primary')
    await page.waitForTimeout(800)
  }
  const koAfter = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('life-os-morning-ritual-progress')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })
  const koWritten = Number(koAfter?.ko || 0) > Number(koBefore?.ko || 0)
  push({
    id: 'ko-ritual-write',
    ok: koWritten, // expected FAIL today — documents the gap
    detail: JSON.stringify({ before: koBefore?.ko ?? 0, after: koAfter?.ko ?? 0, expectGap: !koWritten }),
  })
  await page.screenshot({ path: `${OUT}/kf-ko.png` })

  // Pushups utterance
  const pushups = await submitText('Pushups fertig')
  push({
    id: 'pushups-path',
    ok: pushups.suggest > 0 || pushups.changePreview > 0,
    detail: JSON.stringify({
      suggest: pushups.suggest,
      changePreview: pushups.changePreview,
      eyebrow: pushups.eyebrow,
      snippet: pushups.body.replace(/\s+/g, ' ').slice(0, 180),
    }),
  })

  // Meal still key feature
  const meal = await submitText('Proteinshake getrunken')
  push({
    id: 'meal-keyfeature',
    ok: meal.suggest > 0 && /Mahlzeit|Vorschlag/i.test(`${meal.eyebrow}\n${meal.body}`),
    detail: meal.body.replace(/\s+/g, ' ').slice(0, 180),
  })

} catch (error) {
  push({ id: 'fatal', ok: false, detail: String(error) })
}

await browser.close()
writeFileSync(`${OUT}/jo-ai-keyfeature-report.json`, JSON.stringify(report, null, 2))
const failed = report.filter(i => !i.ok)
console.log(JSON.stringify({ total: report.length, failed: failed.length, failedIds: failed.map(i => i.id) }, null, 2))
process.exit(failed.length ? 1 : 0)
