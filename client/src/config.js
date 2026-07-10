function getBackendURL() {
  const stored = localStorage.getItem('wa:backend')
  if (stored) return stored

  const origin = window.location.origin
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return 'http://localhost:3001'
  }

  return null
}

// Set URL setelah deploy ke Render
const RENDER_BACKEND = null

async function discoverBackend() {
  if (RENDER_BACKEND) {
    try {
      const res = await fetch(`${RENDER_BACKEND}/api/wa/status`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        localStorage.setItem('wa:backend', RENDER_BACKEND)
        return RENDER_BACKEND
      }
    } catch {}
  }

  const preferred = getBackendURL()
  if (preferred) {
    try {
      const res = await fetch(`${preferred}/api/wa/status`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        return preferred
      }
    } catch {}
  }

  try {
    const res = await fetch(`${window.location.origin}/api/wa/status`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      localStorage.setItem('wa:backend', window.location.origin)
      return window.location.origin
    }
  } catch {}

  return window.location.origin
}

const config = {
  backendURL: getBackendURL(),
  discover: discoverBackend,
}

export default config
