import { useEffect, useRef } from 'react'
import {
  Chart,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js'
import type { DashboardEntry } from '../../types/DashboardEntry'
import { getScoreColor } from '../../lib/score'

Chart.register(
  BarController, LineController,
  BarElement, LineElement, PointElement,
  CategoryScale, LinearScale,
  Tooltip, Filler,
)

interface WeeklyChartProps {
  entries: DashboardEntry[]
  days?: number
}

export function WeeklyChart({ entries, days = 30 }: WeeklyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const sorted = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days)

    const labels = sorted.map(e => {
      const d = new Date(e.date + 'T00:00:00')
      return `${d.getDate()}.${d.getMonth() + 1}`
    })
    const scores = sorted.map(e => e.dailyScore)
    const bgColors  = scores.map(s => getScoreColor(s) + '55')
    const brdColors = scores.map(s => getScoreColor(s))

    chartRef.current?.destroy()

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Score',
            data: scores,
            backgroundColor: bgColors,
            borderColor: brdColors,
            borderWidth: 2,
            borderRadius: 8,
            order: 2,
          },
          {
            type: 'line',
            label: 'Trend',
            data: scores,
            borderColor: 'rgba(124,123,255,0.7)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0.4,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,20,31,0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} / 100 Punkte`,
            },
          },
        },
        scales: {
          x: {
            grid:  { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } },
          },
          y: {
            min:   0,
            max:   100,
            grid:  { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: 'rgba(255,255,255,0.4)',
              font: { size: 11 },
              stepSize: 25,
            },
          },
        },
      },
    })

    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [entries, days])

  return (
    <div style={{ position: 'relative', height: '220px', width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
