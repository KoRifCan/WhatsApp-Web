const DEFAULT_BACKEND = 'https://long-called-recognized-waiting.trycloudflare.com'

function getBackendURL() {
  const stored = localStorage.getItem('wa:backend')
  if (stored) return stored

  const origin = window.location.origin
  if (origin.includes('trycloudflare.com') || origin.includes('ngrok') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
    localStorage.setItem('wa:backend', origin)
    return origin
  }

  return DEFAULT_BACKEND
}

async function discoverBackend() {
  const candidates = [
    getBackendURL(),
    ...(window.location.origin !== DEFAULT_BACKEND ? [window.location.origin] : []),
    DEFAULT_BACKEND,
  ]
  for (const url of [...new Set(candidates)]) {
    try {
      const res = await fetch(`${url}/api/wa/tunnel-url`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const data = await res.json()
      if (data.url) {
        localStorage.setItem('wa:backend', data.url)
        return data.url
      }
    } catch {}
    try {
      const res = await fetch(`${url}/api/wa/status`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        localStorage.setItem('wa:backend', url)
        return url
      }
    } catch {}
  }
  return DEFAULT_BACKEND
}

const config = {
  backendURL: getBackendURL(),
  discover: discoverBackend,
}

export default config
