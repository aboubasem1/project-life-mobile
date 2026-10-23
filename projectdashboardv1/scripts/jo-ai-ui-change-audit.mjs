/**
 * Live audit: Jo AI UI/system change preview + apply + persist on OVH.
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
page.setDefaultTimeout(20000)

async function dismissOverlays() {
  await page.locator('.change-preview button:has-text("Fertig")').click({ force: true }).catch(() => {})
  await page.locator('.change-preview button:has-text("Abbrechen")').click({ force: true }).catch(() => {})
  await page.locator('.change-preview button:has-text("Verstanden")').click({ force: true }).catch(() => {})
  await page.locator('.change-preview button:has-text("OK")').click({ force: true }).catch(() => {})
  await page.locator('.capture-sheet button[aria-label="Schließen"]').click({ force: true }).catch(() => {})
  for (let i = 0; i < 2; i += 1) {
    await page.keyboard.press('Escape').catch(() => {})
  }
  await page.waitForTimeout(200)
}

async function skipRitualIfNeeded() {
  if (await page.locator('text=Ritual heute überspringen').count()) {
    await page.locator('text=Ritual heute überspringen').click({ force: true }).catch(() => {})
    await page.waitForTimeout(300)
  }
}

async function openCapture() {
  await dismissOverlays()
  await page.goto(`${BASE}/#/heute?action=capture`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForSelector('.splash-screen', { state: 'detached', timeout: 15000 }).catch(() => {})
  await skipRitualIfNeeded()
  // If ritual still blocks, try again
  if (!(await page.locator('.capture-sheet__input').count())) {
    await page.goto(`${BASE}/#/heute?action=capture`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await skipRitualIfNeeded()
  }
  await page.waitForSelector('.capture-sheet__input', { timeout: 15000 })
}

async function readSettings() {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('life-os-v1-settings') || 'null')
    } catch {
      return null
    }
  })
}

async function submit(text, { apply = false } = {}) {
  await openCapture()
  await page.fill('.capture-sheet__input', text)
  await page.click('.capture-sheet__primary', { force: true })
  await page.waitForTimeout(1400)

  const preview = await page.locator('.change-preview').count()
  const uebernehmen = await page.locator('.change-preview button:has-text("Übernehmen")').count()
  const verstanden = await page.locator('.change-preview button:has-text("Verstanden")').count()
  const suggest = await page.locator('.capture-suggest').count()
  const previewText = (await page.locator('.change-preview').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220)
  const heading = await page.locator('.change-preview h2').innerText().catch(() => '')

  let phaseAfter = 'none'
  let settingsAfter = null

  if (apply && uebernehmen > 0) {
    // Prefer real element.click() — Playwright point-clicks can hit mobile-nav over the sheet.
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.change-preview button')]
        .find(b => /Übernehmen/i.test(b.textContent || ''))
      btn?.click()
    })
    await page.waitForTimeout(900)
    const appliedHeading = await page.locator('.change-preview h2').innerText().catch(() => '')
    const fertig = await page.locator('.change-preview button:has-text("Fertig")').count()
    const isAppliedClass = await page.locator('.change-preview.is-applied').count()
    phaseAfter = /übernommen/i.test(appliedHeading) || fertig > 0 || isAppliedClass > 0
      ? 'applied'
      : `still:${appliedHeading || 'unknown'}`
    settingsAfter = await readSettings()
    // dismiss confirmation
    await page.locator('.change-preview button:has-text("Fertig")').click({ force: true }).catch(() => {})
    await page.waitForTimeout(200)
  } else if (apply && verstanden > 0) {
    phaseAfter = 'code'
    settingsAfter = await readSettings()
    await page.locator('.change-preview button:has-text("Verstanden")').click({ force: true }).catch(() => {})
  }

  return {
    preview: preview > 0,
    uebernehmen: uebernehmen > 0,
    verstanden: verstanden > 0,
    suggest: suggest > 0,
    previewText,
    heading,
    phaseAfter,
    settingsAfter,
  }
}

const CASES = [
  {
    id: 'energy-exclude-now',
    text: 'Entferne Energy von Heute. Energy gehört nur in Morning und Evening Gate.',
    expect: 'config',
    check: (s) => Array.isArray(s?.adaptive?.surfaces?.now?.excludeEntities)
      && s.adaptive.surfaces.now.excludeEntities.includes('energy'),
  },
  {
    id: 'lab-compact-progressive',
    text: 'Lab kompakter mit progressive disclosure',
    expect: 'config',
    check: (s) => s?.adaptive?.surfaces?.lab?.density === 'compact'
      && s?.adaptive?.surfaces?.lab?.disclosure === 'progressive',
  },
  {
    id: 'weight-after-breakfast',
    text: 'Verschiebe Gewicht nach dem Frühstück im Morning Gate',
    expect: 'config',
    check: (s) => {
      const order = s?.morningRitual?.stepOrder
      if (!Array.isArray(order)) return false
      const b = order.indexOf('medsShake')
      const w = order.indexOf('weight')
      return w >= 0 && b >= 0 && w === b + 1
    },
  },
  {
    id: 'hide-mood-morning',
    text: 'Entferne Stimmung aus dem Morning Gate',
    expect: 'config',
    check: (s) => Array.isArray(s?.morningRitual?.hiddenSteps)
      && s.morningRitual.hiddenSteps.includes('headRecovery'),
  },
  {
    id: 'code-comparison-view',
    text: 'Baue eine Vergleichsansicht für meine letzten drei Lab-Messungen',
    expect: 'code',
  },
  { id: 'gap-theme-dark', text: 'Wechsel das Theme auf Dark Mode', expect: 'fallthrough' },
  { id: 'gap-evening-hide-energy', text: 'Entferne Energy aus dem Evening Gate', expect: 'fallthrough' },
  { id: 'gap-nav-hide-lab', text: 'Verstecke Lab in der Navigation', expect: 'fallthrough' },
  { id: 'gap-hide-energy-morning', text: 'Entferne Energy aus dem Morning Gate', expect: 'fallthrough' },
]

try {
  await page.goto(`${BASE}/#/heute`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForSelector('.splash-screen', { state: 'detached', timeout: 15000 }).catch(() => {})
  await skipRitualIfNeeded()

  for (const c of CASES) {
    const r = await submit(c.text, { apply: c.expect === 'config' || c.expect === 'code' })
    await page.screenshot({ path: `${OUT}/ui-audit-${c.id}.png` }).catch(() => {})

    if (c.expect === 'config') {
      const persist = Boolean(r.settingsAfter && c.check(r.settingsAfter))
      const ok = r.preview && r.uebernehmen && r.phaseAfter === 'applied' && persist
      push({
        id: c.id,
        ok,
        detail: `preview=${r.preview} btn=${r.uebernehmen} phase=${r.phaseAfter} persist=${persist} | ${r.previewText}`,
        adaptive: r.settingsAfter?.adaptive?.surfaces ?? null,
        morning: r.settingsAfter?.morningRitual
          ? {
              stepOrder: r.settingsAfter.morningRitual.stepOrder,
              hiddenSteps: r.settingsAfter.morningRitual.hiddenSteps,
            }
          : null,
      })
    } else if (c.expect === 'code') {
      const ok = r.preview && r.verstanden && !r.uebernehmen
      push({
        id: c.id,
        ok,
        detail: `code preview=${r.preview} verstanden=${r.verstanden} uebernehmen=${r.uebernehmen} | ${r.previewText || r.heading}`,
      })
    } else {
      push({
        id: c.id,
        ok: !r.preview,
        detail: `expected fallthrough; preview=${r.preview} suggest=${r.suggest} | ${r.previewText || r.heading || 'capture'}`,
      })
    }
    await dismissOverlays()
  }
} catch (err) {
  push({ id: 'audit-crash', ok: false, detail: String(err?.stack || err) })
} finally {
  writeFileSync(`${OUT}/jo-ai-ui-change-audit.json`, JSON.stringify(report, null, 2))
  console.log('\n=== SUMMARY ===')
  for (const r of report) console.log(`${r.ok ? '✓' : '✗'} ${r.id}`)
  await browser.close()
  process.exit(report.some(r => !r.ok) ? 1 : 0)
}
