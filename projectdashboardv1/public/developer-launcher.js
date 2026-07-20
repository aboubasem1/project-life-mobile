(() => {
  const params = new URLSearchParams(window.location.search)
  const enable = params.get('developer') === '1'
  const disable = params.get('developer') === '0'
  const storageKey = 'project-life-developer-launcher'

  if (enable) localStorage.setItem(storageKey, '1')
  if (disable) localStorage.removeItem(storageKey)
  if (disable || localStorage.getItem(storageKey) !== '1') return

  const button = document.createElement('a')
  button.href = `/developer/?from=${encodeURIComponent(window.location.pathname + window.location.search)}`
  button.setAttribute('aria-label', 'Developer-Konsole öffnen')
  button.title = 'Developer-Konsole'
  button.textContent = '</>'

  Object.assign(button.style, {
    position: 'fixed',
    right: '16px',
    bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
    zIndex: '9999',
    display: 'grid',
    placeItems: 'center',
    width: '46px',
    height: '46px',
    border: '1px solid rgba(127, 127, 127, 0.22)',
    borderRadius: '16px',
    background: 'rgba(20, 24, 22, 0.88)',
    color: '#f4f5f0',
    boxShadow: '0 14px 36px rgba(0, 0, 0, 0.24)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    font: '700 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
    textDecoration: 'none',
  })

  document.body.appendChild(button)
})()
