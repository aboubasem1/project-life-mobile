import { readFileSync, writeFileSync } from 'fs'

// ── DashboardView.tsx ───────────────────────────────────────────────────────
let dv = readFileSync('src/views/DashboardView.tsx', 'utf8')

// 1. Add lucide imports after existing imports
dv = dv.replace(
  `import { calculateScore, getScoreBreakdown } from '../lib/score'`,
  `import { calculateScore, getScoreBreakdown } from '../lib/score'
import {
  Sunrise, Zap, Brain, Apple, Briefcase, Moon, BarChart2,
  SmilePlus, Smile, Meh, Frown, AlertCircle,
  BatteryFull, Battery, BatteryMedium, BatteryLow, BatteryWarning,
} from 'lucide-react'`
)

// 2. Replace MOOD/SLEEP options with typed objects
const oldMoodSleep = `  const MOOD_OPTIONS  = ['😊 MOTIVIERT', '🙂 GUT', '😐 NEUTRAL', '😔 MÜDE', '😤 GESTRESST']
  const SLEEP_OPTIONS = ['😴 SEHR SCHLECHT', '😞 SCHLECHT', '😐 OKAY', '😊 GUT', '🌟 SEHR GUT']
  const SLEEP_DURATION_OPTIONS = ['5h', '6h', '6.5h', '7h', '7.5h', '8h', '9h']
  const MEDITATION_OPTIONS = [0, 5, 10, 15, 20, 30]`

const newMoodSleep = `  const MOOD_OPTIONS = [
    { value: 'MOTIVIERT',  Icon: SmilePlus,     label: 'MOTIVIERT'  },
    { value: 'GUT',         Icon: Smile,        label: 'GUT'        },
    { value: 'NEUTRAL',    Icon: Meh,           label: 'NEUTRAL'    },
    { value: 'MÜDE',       Icon: Frown,         label: 'MÜDE'       },
    { value: 'GESTRESST',  Icon: AlertCircle,   label: 'GESTRESST'  },
  ]
  const SLEEP_OPTIONS = [
    { value: 'SEHR SCHLECHT', Icon: BatteryWarning, label: 'S.SCHLECHT' },
    { value: 'SCHLECHT',      Icon: BatteryLow,     label: 'SCHLECHT'   },
    { value: 'OKAY',          Icon: BatteryMedium,  label: 'OKAY'       },
    { value: 'GUT',           Icon: Battery,        label: 'GUT'        },
    { value: 'SEHR GUT',      Icon: BatteryFull,    label: 'S.GUT'      },
  ]
  const SLEEP_DURATION_OPTIONS = ['5h', '6h', '6.5h', '7h', '7.5h', '8h', '9h']
  const MEDITATION_OPTIONS = [0, 5, 10, 15, 20, 30]`

dv = dv.replace(oldMoodSleep, newMoodSleep)

// 3. Replace mood quick-select render
dv = dv.replace(
  `                <div className="quick-select-row">
                  {MOOD_OPTIONS.map(o => (
                    <button
                      key={o}
                      type="button"
                      className={\`quick-btn \${entry.mood === o ? 'active' : ''}\`}
                      onClick={() => update({ mood: o })}
                    >{o.split(' ')[0]}</button>
                  ))}
                </div>`,
  `                <div className="quick-select-row">
                  {MOOD_OPTIONS.map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={\`quick-btn \${entry.mood === value ? 'active' : ''}\`}
                      onClick={() => update({ mood: value })}
                      title={label}
                    ><Icon size={18} /></button>
                  ))}
                </div>`
)

// 4. Replace sleep quality quick-select render
dv = dv.replace(
  `                <div className="quick-select-row">
                  {SLEEP_OPTIONS.map(o => (
                    <button
                      key={o}
                      type="button"
                      className={\`quick-btn \${entry.sleepQuality === o ? 'active' : ''}\`}
                      onClick={() => update({ sleepQuality: o })}
                    >{o.split(' ')[0]}</button>
                  ))}
                </div>`,
  `                <div className="quick-select-row">
                  {SLEEP_OPTIONS.map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={\`quick-btn \${entry.sleepQuality === value ? 'active' : ''}\`}
                      onClick={() => update({ sleepQuality: value })}
                      title={label}
                    ><Icon size={18} /></button>
                  ))}
                </div>`
)

// 5. Replace chip content (emojis → icon components)
const chipReplacements = [
  ['🌅 AUFWACHEN',         '<Sunrise size={12} /> AUFWACHEN'],
  ['⚡ DAILY HABITS',      '<Zap size={12} /> DAILY HABITS'],
  ['🧠 MINDSET',           '<Brain size={12} /> MINDSET'],
  ['🥗 ERNÄHRUNG & KÖRPER','<Apple size={12} /> ERNÄHRUNG'],
  ['💼 WORK & FOKUS',      '<Briefcase size={12} /> WORK & FOKUS'],
  ['🌙 ABEND RITUAL',      '<Moon size={12} /> ABEND RITUAL'],
  ['📊 SCORE BREAKDOWN',   '<BarChart2 size={12} /> SCORE BREAKDOWN'],
]
for (const [old, next] of chipReplacements) {
  dv = dv.replaceAll(`{\"${old}\"}`, `<>{${JSON.stringify(next.replace('<','<').replace(/>/, '>'))}</>`) // won't work cleanly
}

// Simpler chip approach — just replace the string inside chip spans:
for (const [old, next] of chipReplacements) {
  dv = dv.replace(`<span className="chip">${old}</span>`, `<span className="chip">${next}</span>`)
}

// 6. Replace tab buttons (emoji text)
dv = dv.replace(`>🌅 MORGENS</button>`, `><Sunrise size={14} style={{flexShrink:0}} /> MORGENS</button>`)
dv = dv.replace(`>🌙 ABENDS</button>`, `><Moon size={14} style={{flexShrink:0}} /> ABENDS</button>`)

// 7. Replace habit-emoji span with icon component
dv = dv.replaceAll(
  `<span className="habit-emoji">{h.emoji}</span>`,
  `<h.icon size={18} style={{ color: h.color, flexShrink: 0 }} />`
)

writeFileSync('src/views/DashboardView.tsx', dv)
console.log('DashboardView done')

// ── StatsView.tsx ───────────────────────────────────────────────────────────
let sv = readFileSync('src/views/StatsView.tsx', 'utf8')

// 1. Add imports
sv = sv.replace(
  `import { exportJSON, importJSON, upsertEntry } from '../lib/storage'`,
  `import { exportJSON, importJSON, upsertEntry } from '../lib/storage'
import { TrendingUp, Flame, Calendar, HardDrive, Download, Upload, RefreshCw } from 'lucide-react'`
)

// 2. Replace chip emoji content
const statsChips = [
  ['📈 30-TAGE VERLAUF',  '<TrendingUp size={12} /> 30-TAGE VERLAUF'],
  ['🔥 HABIT STREAKS',    '<Flame size={12} /> HABIT STREAKS'],
  ['📅 VERLAUF',          '<Calendar size={12} /> VERLAUF'],
  ['💾 DATEN',            '<HardDrive size={12} /> DATEN'],
]
for (const [old, next] of statsChips) {
  sv = sv.replace(`<span className="chip">${old}</span>`, `<span className="chip">${next}</span>`)
}

// 3. Replace habit emoji in streak rows
sv = sv.replaceAll(
  `<span className="streak-emoji">{h.emoji}</span>`,
  `<span className="streak-emoji"><h.icon size={18} style={{ color: h.color }} /></span>`
)

// 4. Replace fire emoji in streak stats
sv = sv.replace(
  `{streak > 0 ? \`🔥\${streak}\` : '—'}`,
  `{streak > 0 ? <><Flame size={12} style={{ color: '#ff9500', verticalAlign: 'middle' }} />{streak}</> : '—'}`
)

// 5. Replace action button text arrows with icons
sv = sv.replace(`↓ EXPORTIEREN`, `<Download size={14} /> EXPORTIEREN`)
sv = sv.replace(`↑ IMPORTIEREN`, `<Upload size={14} /> IMPORTIEREN`)
sv = sv.replace(`↻ SYNC`, `<RefreshCw size={14} /> SYNC`)

writeFileSync('src/views/StatsView.tsx', sv)
console.log('StatsView done')
