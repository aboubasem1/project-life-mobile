import { readFileSync, writeFileSync } from 'fs'

// ═══════════════════════════════════════════════════════
// DashboardView.tsx
// ═══════════════════════════════════════════════════════
let dv = readFileSync('src/views/DashboardView.tsx', 'utf8')

// 1. Add lucide imports
dv = dv.replace(
  `import { calculateScore, getScoreBreakdown } from '../lib/score'`,
  `import { calculateScore, getScoreBreakdown } from '../lib/score'
import {
  Sunrise, Zap, Brain, Apple, Briefcase, Moon, BarChart2,
  SmilePlus, Smile, Meh, Frown, AlertCircle,
  BatteryFull, Battery, BatteryMedium, BatteryLow, BatteryWarning,
} from 'lucide-react'`
)

// 2. Replace MOOD_OPTIONS + SLEEP_OPTIONS (multi-line, emoji-safe)
const oldOpts = dv.match(
  /const MOOD_OPTIONS\s+=\s+\[[^\]]+\]\s+const SLEEP_OPTIONS\s+=\s+\[[^\]]+\]/s
)
if (oldOpts) {
  dv = dv.replace(oldOpts[0], `const MOOD_OPTIONS = [
    { value: 'MOTIVIERT',     Icon: SmilePlus,     label: 'MOTIVIERT'   },
    { value: 'GUT',           Icon: Smile,         label: 'GUT'         },
    { value: 'NEUTRAL',       Icon: Meh,           label: 'NEUTRAL'     },
    { value: 'MÜDE',          Icon: Frown,         label: 'MÜDE'        },
    { value: 'GESTRESST',     Icon: AlertCircle,   label: 'GESTRESST'   },
  ]
  const SLEEP_OPTIONS = [
    { value: 'SEHR SCHLECHT', Icon: BatteryWarning, label: 'S.SCHLECHT'  },
    { value: 'SCHLECHT',      Icon: BatteryLow,     label: 'SCHLECHT'    },
    { value: 'OKAY',          Icon: BatteryMedium,  label: 'OKAY'        },
    { value: 'GUT',           Icon: Battery,        label: 'GUT'         },
    { value: 'SEHR GUT',      Icon: BatteryFull,    label: 'S.GUT'       },
  ]`)
  console.log('MOOD/SLEEP options replaced')
} else {
  console.warn('WARN: MOOD/SLEEP not found via regex')
}

// 3. Replace mood quick-select map (match by structure)
dv = dv.replace(
  /{MOOD_OPTIONS\.map\(o => \([\s\S]*?<button[\s\S]*?onClick=\{.*?update\(\{ mood: o \}\)\}[\s\S]*?\{o\.split\(' '\)\[0\]\}<\/button>[\s\S]*?\)\)}/,
  `{MOOD_OPTIONS.map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={\`quick-btn \${entry.mood === value ? 'active' : ''}\`}
                      onClick={() => update({ mood: value })}
                      title={label}
                    ><Icon size={18} /></button>
                  ))}`
)

// 4. Replace sleep quality quick-select map
dv = dv.replace(
  /{SLEEP_OPTIONS\.map\(o => \([\s\S]*?<button[\s\S]*?onClick=\{.*?update\(\{ sleepQuality: o \}\)\}[\s\S]*?\{o\.split\(' '\)\[0\]\}<\/button>[\s\S]*?\)\)}/,
  `{SLEEP_OPTIONS.map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={\`quick-btn \${entry.sleepQuality === value ? 'active' : ''}\`}
                      onClick={() => update({ sleepQuality: value })}
                      title={label}
                    ><Icon size={18} /></button>
                  ))}`
)

// 5. Replace chip strings (use Buffer.from to avoid source-file emoji encoding issues)
const chipMap = [
  ['\u{1F305} AUFWACHEN',           '<Sunrise size={12} /> AUFWACHEN'],
  ['\u26A1 DAILY HABITS',           '<Zap size={12} /> DAILY HABITS'],
  ['\u{1F9E0} MINDSET',             '<Brain size={12} /> MINDSET'],
  ['\u{1F957} ERN\u00C4HRUNG & K\u00D6RPER', '<Apple size={12} /> ERN\u00C4HRUNG'],
  ['\u{1F4BC} WORK & FOKUS',        '<Briefcase size={12} /> WORK & FOKUS'],
  ['\u{1F319} ABEND RITUAL',        '<Moon size={12} /> ABEND RITUAL'],
  ['\u{1F4CA} SCORE BREAKDOWN',     '<BarChart2 size={12} /> SCORE BREAKDOWN'],
]
for (const [old, next] of chipMap) {
  const before = dv
  dv = dv.replace(`<span className="chip">${old}</span>`, `<span className="chip">${next}</span>`)
  console.log(`chip "${old.slice(0,8)}" → ${before === dv ? 'NOT FOUND' : 'OK'}`)
}

// 6. Tab buttons
dv = dv.replace(
  />\u{1F305} MORGENS<\/button>/u,
  `><Sunrise size={14} style={{flexShrink:0}} /> MORGENS</button>`
)
dv = dv.replace(
  />\u{1F319} ABENDS<\/button>/u,
  `><Moon size={14} style={{flexShrink:0}} /> ABENDS</button>`
)

// fallback for tab buttons (plain → icon)
if (dv.includes('>🌅 MORGENS</button>')) {
  dv = dv.replaceAll('>🌅 MORGENS</button>', '><Sunrise size={14} style={{flexShrink:0}} /> MORGENS</button>')
  console.log('Tab MORGENS via fallback')
}
if (dv.includes('>🌙 ABENDS</button>')) {
  dv = dv.replaceAll('>🌙 ABENDS</button>', '><Moon size={14} style={{flexShrink:0}} /> ABENDS</button>')
  console.log('Tab ABENDS via fallback')
}

// 7. habit-emoji spans → icon component
const before = dv
dv = dv.replaceAll(
  '<span className="habit-emoji">{h.emoji}</span>',
  '<h.icon size={18} style={{ color: h.color, flexShrink: 0 }} />'
)
console.log(`habit-emoji spans: ${before === dv ? 'NOT FOUND' : 'OK'}`)

writeFileSync('src/views/DashboardView.tsx', dv)
console.log('\n✅ DashboardView.tsx written')

// ═══════════════════════════════════════════════════════
// StatsView.tsx
// ═══════════════════════════════════════════════════════
let sv = readFileSync('src/views/StatsView.tsx', 'utf8')

// 1. Add imports
sv = sv.replace(
  `import { exportJSON, importJSON, upsertEntry } from '../lib/storage'`,
  `import { exportJSON, importJSON, upsertEntry } from '../lib/storage'
import { TrendingUp, Flame, Calendar, HardDrive, Download, Upload, RefreshCw } from 'lucide-react'`
)

// 2. Section chips
const statsChipMap = [
  ['\u{1F4C8} 30-TAGE VERLAUF', '<TrendingUp size={12} /> 30-TAGE VERLAUF'],
  ['\u{1F525} HABIT STREAKS',   '<Flame size={12} /> HABIT STREAKS'],
  ['\u{1F4C5} VERLAUF',         '<Calendar size={12} /> VERLAUF'],
  ['\u{1F4BE} DATEN',           '<HardDrive size={12} /> DATEN'],
]
for (const [old, next] of statsChipMap) {
  const before = sv
  sv = sv.replace(`<span className="chip">${old}</span>`, `<span className="chip">${next}</span>`)
  console.log(`chip "${old.slice(0,6)}" → ${before === sv ? 'NOT FOUND (try fallback)' : 'OK'}`)
}

// fallback
;[
  ['📈 30-TAGE VERLAUF', '<TrendingUp size={12} /> 30-TAGE VERLAUF'],
  ['🔥 HABIT STREAKS',   '<Flame size={12} /> HABIT STREAKS'],
  ['📅 VERLAUF',         '<Calendar size={12} /> VERLAUF'],
  ['💾 DATEN',           '<HardDrive size={12} /> DATEN'],
].forEach(([old, next]) => {
  if (sv.includes(`<span className="chip">${old}</span>`)) {
    sv = sv.replace(`<span className="chip">${old}</span>`, `<span className="chip">${next}</span>`)
    console.log(`chip fallback OK: ${old.slice(0,6)}`)
  }
})

// 3. streak-emoji spans
sv = sv.replaceAll(
  '<span className="streak-emoji">{h.emoji}</span>',
  '<span className="streak-emoji"><h.icon size={18} style={{ color: h.color }} /></span>'
)

// 4. fire streak
sv = sv.replace(
  `{streak > 0 ? \`🔥\${streak}\` : '—'}`,
  `{streak > 0 ? <><Flame size={12} style={{ color: '#ff9500', verticalAlign: 'middle' }} />{streak}</> : '—'}`
)

// 5. Data action buttons
sv = sv.replace('↓ EXPORTIEREN', '<Download size={14} /> EXPORTIEREN')
sv = sv.replace('↑ IMPORTIEREN', '<Upload size={14} /> IMPORTIEREN')
sv = sv.replace('↻ SYNC', '<RefreshCw size={14} /> SYNC')

writeFileSync('src/views/StatsView.tsx', sv)
console.log('\n✅ StatsView.tsx written')
