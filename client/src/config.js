function getBackendURL() {
  const stored = localStorage.getItem('wa:backend')
  if (stored) return stored

  const origin = window.location.origin
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return 'http://localhost:3001'
  }

  return null
}

const TUNNEL_URL = 'https://long-called-recognized-waiting.trycloudflare.com'

async function discoverBackend() {
  if (TUNNEL_URL) {
    try {
      const res = await fetch(`${TUNNEL_URL}/api/wa/status`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        localStorage.setItem('wa:backend', TUNNEL_URL)
        return TUNNEL_URL
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
