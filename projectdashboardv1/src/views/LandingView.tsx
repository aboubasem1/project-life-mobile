import { useEffect, useRef } from 'react'

interface Props { onEnter: () => void; onStats: () => void }

export function LandingView({ onEnter, onStats }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const canvas: HTMLCanvasElement = c
    const ctx = canvas.getContext('2d')!
    let raf: number
    type Star = { x: number; y: number; r: number; o: number; t: number }
    let S: Star[] = []
    function rsz() { canvas.width = innerWidth; canvas.height = innerHeight }
    function init() {
      S = []
      for (let i = 0; i < 200; i++)
        S.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.3 + 0.2, o: Math.random() * 0.6 + 0.1, t: Math.random() * 6.28 })
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      S.forEach(s => {
        s.t += 0.012
        const o = s.o * (0.6 + 0.4 * Math.sin(s.t))
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28)
        ctx.fillStyle = `rgba(255,255,255,${o})`; ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    rsz(); init(); draw()
    window.addEventListener('resize', () => { rsz(); init() })
    return () => { cancelAnimationFrame(raf) }
  }, [])

  const xpData = (() => {
    try {
      const d = JSON.parse(localStorage.getItem('lifeos-xp-v1') ?? '{}')
      const xp = Number(d.xp ?? 0)
      const XPT = [0, 500, 1100, 1900, 3000, 4400, 6200, 8600, 11600, 15600]
      const LVLS = ['ROOKIE','STARTER','FOCUSED','GRINDER','ACHIEVER','WARRIOR','ELITE','LEGEND','MASTER','GODMODE']
      let lv = 0
      while (lv < XPT.length - 1 && xp >= XPT[lv + 1]) lv++
      const cur = XPT[lv] ?? 0
      const next = XPT[lv + 1] ?? XPT[XPT.length - 1]
      const pct = next > cur ? Math.min(1, (xp - cur) / (next - cur)) : 1
      return { lv: lv + 1, name: LVLS[lv] ?? 'GODMODE', pct }
    } catch { return { lv: 1, name: 'ROOKIE', pct: 0 } }
  })()

  const R = 55
  const circ = 2 * Math.PI * R
  const offset = circ * (1 - xpData.pct)
  const ff = "-apple-system,'SF Pro Display',system-ui,sans-serif"

  return (
    <div style={{ position:'relative', width:'100%', maxWidth:430, minHeight:'100dvh', margin:'0 auto', overflow:'hidden', background:'#0a0a0f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px 32px' }}>
      <canvas ref={canvasRef} style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }} />
      <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', width:'100%' }}>

        <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(124,123,255,.12)', border:'1px solid rgba(124,123,255,.3)', borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, letterSpacing:'.1em', color:'#7c7bff', marginBottom:20, fontFamily:ff }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2l-.55-.55"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
          LIFE OPERATING SYSTEM
        </div>

        <div style={{ position:'relative', width:130, height:130, marginBottom:28 }}>
          <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform:'rotate(-90deg)' }}>
            <defs>
              <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c7bff"/><stop offset="100%" stopColor="#5ac8fa"/>
              </linearGradient>
            </defs>
            <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
            <circle cx="65" cy="65" r={R} fill="none" stroke="url(#rg)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              style={{ transition:'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}/>
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1 }}>
            <div style={{ fontSize:26, fontWeight:900, color:'#fff' }}>{xpData.lv}</div>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.12em', color:'rgba(255,255,255,.4)', fontFamily:ff }}>LEVEL</div>
            <div style={{ fontSize:10, fontWeight:700, color:'#7c7bff', fontFamily:ff }}>{xpData.name}</div>
          </div>
        </div>

        <div style={{ fontSize:'clamp(38px,10vw,52px)', fontWeight:900, letterSpacing:'-.03em', textAlign:'center', lineHeight:1.05, background:'linear-gradient(135deg,#fff 20%,#7c7bff 60%,#5ac8fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', marginBottom:8, fontFamily:ff }}>
          Life OS
        </div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', textAlign:'center', lineHeight:1.6, marginBottom:28, fontFamily:ff }}>
          Dein Leben. Dein Spiel. Dein Level.
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%' }}>
          <button onClick={onEnter} style={{ background:'linear-gradient(135deg,#7c7bff,#5ac8fa)', borderRadius:14, padding:'17px 20px', fontSize:15, fontWeight:700, color:'#fff', width:'100%', boxShadow:'0 4px 28px rgba(124,123,255,.4)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:12, position:'relative', overflow:'hidden', fontFamily:ff }}>
            <div style={{ position:'absolute', inset:-2, borderRadius:16, border:'2px solid rgba(124,123,255,.5)', animation:'pulse-ring 2.2s ease-in-out infinite', pointerEvents:'none' }}/>
            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.2)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div style={{ flex:1, textAlign:'left' }}>
              <div style={{ fontSize:15, fontWeight:800 }}>NEXT LEVEL</div>
              <div style={{ fontSize:11, opacity:.7 }}>Daily Tracking · Score · Achievements</div>
            </div>
            <span style={{ opacity:.5, fontSize:18 }}>›</span>
          </button>

          <button onClick={onStats} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'15px 20px', fontSize:14, fontWeight:600, color:'rgba(255,255,255,.4)', width:'100%', cursor:'pointer', display:'flex', alignItems:'center', gap:12, fontFamily:ff }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.08)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </div>
            <div style={{ flex:1, textAlign:'left' }}>
              <div style={{ fontSize:14, fontWeight:700 }}>STATS &amp; ANALYSE</div>
              <div style={{ fontSize:11, opacity:.6 }}>Heatmap · Achievements · Insights</div>
            </div>
            <span style={{ opacity:.5, fontSize:18 }}>›</span>
          </button>
        </div>

      </div>
      <style>{"@keyframes pulse-ring{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.9;transform:scale(1.025)}}"}</style>
    </div>
  )
}
