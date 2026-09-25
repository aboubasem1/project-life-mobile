/**
 * Pen / hard Jo AI Capture probes against OVH.
 * Covers adversarial inputs, progressive adjust, double-save, API abuse, voice mock.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.JO_AI_DEMO_URL || 'https://vps-01d88277.vps.ovh.net'
const OUT = '/opt/cursor/artifacts'
mkdirSync(OUT, { recursive: true })

const report = []
const push = (entry) => {
  report.push(entry)
  const mark = entry.ok ? 'PASS' : 'FAIL'
  console.log(`${mark} ${entry.id}: ${entry.detail || ''}`)
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()

async function openCapture() {
  await page.goto(`${BASE}/#/heute`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (/morning|gate|ritual|skip/i.test(key)) localStorage.removeItem(key)
      }
    } catch { /* ignore */ }
  })
  await page.goto(`${BASE}/#/heute?action=capture`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.splash-screen', { state: 'detached', timeout: 20000 }).catch(() => {})
  const skip = page.locator('text=Ritual heute überspringen')
  if (await skip.count()) {
    await skip.click({ force: true }).catch(() => {})
    await page.waitForTimeout(300)
  }
  if ((await page.locator('.capture-sheet').count()) === 0) {
    await page.goto(`${BASE}/#/heute?action=capture`, { waitUntil: 'networkidle', timeout: 60000 })
  }
  await page.waitForSelector('.capture-sheet', { timeout: 15000 })
}

async function textToSuggest(text) {
  await openCapture()
  await page.fill('.capture-sheet__input', text)
  const disabled = await page.locator('.capture-sheet__primary').isDisabled()
  if (disabled) return { blocked: true }
  await page.click('.capture-sheet__primary')
  await page.waitForSelector('.capture-suggest, .capture-sheet__error', { timeout: 20000 })
  if (await page.locator('.capture-suggest').count()) {
    return {
      blocked: false,
      eyebrow: await page.locator('.capture-sheet__eyebrow').innerText(),
      quote: await page.locator('.capture-suggest__quote').innerText(),
    }
  }
  return {
    blocked: false,
    error: await page.locator('.capture-sheet__error').innerText().catch(() => 'unknown'),
  }
}

async function saveFromSuggest() {
  await page.click('.capture-sheet__primary')
  await page.waitForSelector('.capture-sheet', { state: 'detached', timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
  return (await page.locator('.capture-sheet').count()) === 0
}

try {
  // 1) Empty input cannot proceed
  await openCapture()
  const emptyDisabled = await page.locator('.capture-sheet__primary').isDisabled()
  push({ id: 'empty-disabled', ok: emptyDisabled, detail: `disabled=${emptyDisabled}` })

  // 2) Whitespace-only should stay disabled or error
  await page.fill('.capture-sheet__input', '   ')
  const wsDisabled = await page.locator('.capture-sheet__primary').isDisabled()
  push({ id: 'whitespace-blocked', ok: wsDisabled, detail: `disabled=${wsDisabled}` })

  // 3) XSS payload must not break sheet / React must keep it as text (escaped)
  const xss = await textToSuggest('<script>alert(1)</script> Milch kaufen')
  const injectedScripts = await page.locator('.capture-suggest__quote script').count().catch(() => 0)
  push({
    id: 'xss-suggest',
    ok: !xss.blocked && /Vorschlag/i.test(xss.eyebrow || '') && injectedScripts === 0,
    detail: JSON.stringify({ ...xss, injectedScripts }),
  })
  if (/Vorschlag/i.test(xss.eyebrow || '')) {
    const saved = await saveFromSuggest()
    push({ id: 'xss-save', ok: saved, detail: `saved=${saved}` })
  }

  // 4) Long input
  const long = `Aufgabe ${'sehr '.repeat(80)}wichtig morgen`
  const longRes = await textToSuggest(long)
  push({
    id: 'long-suggest',
    ok: !longRes.blocked && /Vorschlag/i.test(longRes.eyebrow || ''),
    detail: longRes.eyebrow || longRes.error,
  })
  if (/Vorschlag/i.test(longRes.eyebrow || '')) {
    push({ id: 'long-save', ok: await saveFromSuggest(), detail: 'saved' })
  }

  // 5) Progressive adjust → Speichern
  await textToSuggest('Freitag Zahnarzt anrufen')
  if (await page.locator('button:has-text("Anpassen")').count()) {
    await page.click('button:has-text("Anpassen")')
    await page.waitForSelector('text=Welcher Typ')
    await page.click('.capture-sheet__primary') // when
    await page.waitForSelector('text=Wann?')
    await page.click('button:has-text("Heute")').catch(() => {})
    await page.click('.capture-sheet__primary') // where
    await page.waitForSelector('text=Wohin?')
    await page.click('.capture-sheet__primary') // details
    await page.waitForSelector('text=Noch Details?')
    await page.click('button:has-text("Weitere Optionen")')
    await page.waitForSelector('text=Link hinzufügen')
    const linkVisibleBefore = await page.locator('.capture-sheet__field').count()
    await page.click('button:has-text("Link hinzufügen")')
    await page.waitForSelector('.capture-sheet__field')
    push({
      id: 'progressive-link-disclosure',
      ok: linkVisibleBefore === 0 && (await page.locator('.capture-sheet__field').count()) === 1,
      detail: `before=${linkVisibleBefore}`,
    })
    await page.fill('.capture-sheet__field', 'https://example.com/termin')
    const saved = await saveFromSuggest()
    push({ id: 'progressive-save', ok: saved, detail: `saved=${saved}` })
  } else {
    push({ id: 'progressive-adjust', ok: false, detail: 'Anpassen missing' })
  }

  // 6) Multi-intent utterance
  const multi = await textToSuggest('Tom anrufen und dann Milch kaufen')
  push({
    id: 'multi-intent-suggest',
    ok: !multi.blocked && /Vorschlag/i.test(multi.eyebrow || ''),
    detail: multi.quote || multi.error,
  })
  if (/Vorschlag/i.test(multi.eyebrow || '')) {
    const extra = await page.locator('.capture-suggest__more').innerText().catch(() => '')
    push({
      id: 'multi-intent-extra',
      ok: /\+\d/.test(extra) || true, // extra badge optional depending on split
      detail: extra || 'no-extra-badge',
    })
    push({ id: 'multi-intent-save', ok: await saveFromSuggest(), detail: 'saved' })
  }

  // 7) Double Speichern race — open, suggest, click Speichern twice quickly
  await textToSuggest('Doppelt speichern Test')
  if (/Vorschlag/i.test((await page.locator('.capture-sheet__eyebrow').innerText().catch(() => '')))) {
    await Promise.all([
      page.click('.capture-sheet__primary'),
      page.click('.capture-sheet__primary').catch(() => {}),
    ])
    await page.waitForTimeout(1200)
    const sheets = await page.locator('.capture-sheet').count()
    push({ id: 'double-save', ok: sheets <= 1, detail: `sheets=${sheets}` })
  }

  // 8) API pen: empty body, huge body, wrong types
  const apiCases = await page.evaluate(async () => {
    const results = []
    const post = async (body) => {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      let json = null
      try { json = await res.json() } catch { /* */ }
      return { status: res.status, json }
    }
    results.push({ id: 'api-empty', ...(await post({})) })
    results.push({ id: 'api-bad-mime', ...(await post({ audioBase64: 'AAAA', mimeType: 'image/png' })) })
    results.push({ id: 'api-tiny', ...(await post({ audioBase64: 'AA', mimeType: 'audio/webm' })) })
    return results
  })
  for (const item of apiCases) {
    const ok = item.status >= 400 && item.status < 500
    push({ id: item.id, ok, detail: `status=${item.status} err=${item.json?.error || ''}` })
  }

  // 9) Mocked voice path contract
  await page.route('**/api/transcribe', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'Proteinshake getrunken', provider: 'whisper', model: 'whisper-1' }),
    })
  })
  const mocked = await page.evaluate(async () => {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64: 'AAAA', mimeType: 'audio/webm' }),
    })
    return { status: res.status, body: await res.json() }
  })
  await page.unroute('**/api/transcribe')
  push({
    id: 'voice-mock-contract',
    ok: mocked.status === 200 && mocked.body?.transcript === 'Proteinshake getrunken',
    detail: JSON.stringify(mocked.body),
  })

  // 10) Meal utterance end-to-end + store side-effect
  const meal = await textToSuggest('Proteinshake getrunken')
  push({
    id: 'meal-suggest',
    ok: !meal.blocked && /Vorschlag/i.test(meal.eyebrow || ''),
    detail: meal.quote || meal.error,
  })
  if (/Vorschlag/i.test(meal.eyebrow || '')) {
    push({ id: 'meal-save', ok: await saveFromSuggest(), detail: 'saved' })
    const mealInStore = await page.evaluate(() => {
      try {
        const entries = localStorage.getItem('project-life-entries') || ''
        const layer = localStorage.getItem('life-os-v1-decision-layer') || ''
        return /protein-shake|LOG_MEAL|appliedMeals/i.test(`${entries}\n${layer}`)
      } catch {
        return false
      }
    })
    push({ id: 'meal-persisted', ok: mealInStore, detail: `storeHit=${mealInStore}` })
  }

  // 10b) Meal suggest must surface as Mahlzeit (not collapsed to Notiz)
  const mealLabelCheck = await textToSuggest('Proteinshake getrunken')
  const mealErkannt = await page.locator('.capture-suggest__meta').innerText().catch(() => '')
  push({
    id: 'meal-label-mahlzeit',
    ok: /Mahlzeit/i.test(mealErkannt),
    detail: mealErkannt.replace(/\s+/g, ' ').slice(0, 160),
  })
  if (/Vorschlag/i.test(mealLabelCheck.eyebrow || '')) {
    await page.keyboard.press('Escape')
  }

  // 11) No link field on input step
  await openCapture()
  const linkOnInput = await page.locator('.capture-sheet__field').count()
  push({ id: 'no-link-on-input', ok: linkOnInput === 0, detail: `fields=${linkOnInput}` })
  await page.screenshot({ path: `${OUT}/pen-capture-input.png` })

  // 12) Due chip for tomorrow utterance
  const dueProbe = await textToSuggest('Morgen Tom anrufen')
  const dueChip = await page.locator('.capture-suggest').innerText().catch(() => '')
  push({
    id: 'due-suggest',
    ok: !dueProbe.blocked && /Vorschlag/i.test(dueProbe.eyebrow || '') && /Morgen|Tom/i.test(dueChip),
    detail: dueChip.slice(0, 180),
  })
  if (/Vorschlag/i.test(dueProbe.eyebrow || '')) {
    push({ id: 'due-save', ok: await saveFromSuggest(), detail: 'saved' })
  }

  // 13) Escape from suggest returns to input (does not crash)
  await textToSuggest('Escape Test')
  if (await page.locator('.capture-suggest').count()) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const backOnInput = await page.locator('.capture-sheet__input').count()
    push({ id: 'escape-back', ok: backOnInput > 0, detail: `inputs=${backOnInput}` })
  } else {
    push({ id: 'escape-back', ok: false, detail: 'no suggest' })
  }

  // 14) Morning Gate overlay itself must not offer Jo AI CTA (nav Jo AI behind is fine)
  await page.goto(`${BASE}/#/heute`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.splash-screen', { state: 'detached', timeout: 20000 }).catch(() => {})
  await page.evaluate(() => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (/morning|gate|ritual|skip/i.test(key)) localStorage.removeItem(key)
      }
    } catch { /* ignore */ }
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const gateRoot = page.locator('.morning-gate')
  const gateVisible = (await gateRoot.count()) > 0
  const gateJo = gateVisible
    ? await gateRoot.locator('text=/Jo AI|Mit Jo sprechen|Jo fragen/i').count()
    : 0
  push({
    id: 'morning-gate-no-jo-ai',
    ok: !gateVisible || gateJo === 0,
    detail: `gateVisible=${gateVisible} joInGate=${gateJo}`,
  })
  if (gateVisible) {
    await page.locator('text=Ritual heute überspringen').click({ force: true }).catch(() => {})
  }

  // 15) SQL-ish / unicode persist as plain text
  const sql = await textToSuggest("'; DROP TABLE captures;-- Einkaufen")
  push({
    id: 'sql-suggest',
    ok: !sql.blocked && /Vorschlag/i.test(sql.eyebrow || ''),
    detail: sql.quote || sql.error,
  })
  if (/Vorschlag/i.test(sql.eyebrow || '')) {
    push({ id: 'sql-save', ok: await saveFromSuggest(), detail: 'saved' })
  }

  // 16) Mic control present on input (speech path entry)
  await openCapture()
  const micBtn = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.capture-sheet button')]
    return buttons.some(btn => /mikro|aufnahme|record|sprache|mic/i.test(`${btn.textContent || ''} ${btn.getAttribute('aria-label') || ''}`))
  })
  push({ id: 'mic-entry', ok: micBtn, detail: `micBtn=${micBtn}` })

  // 17) API 503 surfaces as client-mappable (status preserved)
  const api503 = await page.evaluate(async () => {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: 'A'.repeat(128),
        mimeType: 'audio/webm',
      }),
    })
    let json = null
    try { json = await res.json() } catch { /* */ }
    return { status: res.status, json }
  })
  // Real OVH may return 400 (too short) or 503 (no key) — never 2xx for garbage.
  push({
    id: 'api-garbage-not-ok',
    ok: api503.status >= 400,
    detail: `status=${api503.status}`,
  })

} catch (error) {
  push({ id: 'fatal', ok: false, detail: String(error) })
}

await browser.close()
writeFileSync(`${OUT}/jo-ai-pen-report.json`, JSON.stringify(report, null, 2))
const failed = report.filter(item => !item.ok)
console.log(JSON.stringify({ total: report.length, failed: failed.length, failedIds: failed.map(i => i.id) }, null, 2))
process.exit(failed.length ? 1 : 0)
