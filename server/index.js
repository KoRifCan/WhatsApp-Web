import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { initWA, sendWAMessage, logoutWA, getWAStatus, requestPairingCode, resetWA, getChats } from './whatsapp.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const TUNNEL_FILE = '/tmp/tunnel_url.txt'

function getTunnelUrl() {
  try {
    if (fs.existsSync(TUNNEL_FILE)) {
      const url = fs.readFileSync(TUNNEL_FILE, 'utf-8').trim()
      if (url) return url
    }
    const logs = execSync('pm2 logs cloudflared --nostream --lines 100 2>/dev/null || true', { encoding: 'utf-8', timeout: 5000 })
    const match = logs.match(/https?:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com/)
    if (match) return match[0]
  } catch {}
  return null
}

let cachedTunnelUrl = getTunnelUrl()

// refresh tunnel URL periodically
setInterval(() => {
  const u = getTunnelUrl()
  if (u && u !== cachedTunnelUrl) {
    cachedTunnelUrl = u
    console.log('[Tunnel] URL refreshed:', u)
  }
}, 15000)

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

let waClient = null

async function startWA() {
  waClient = await initWA(io)
}
startWA()

app.get('/api/wa/start', (req, res) => {
  if (!waClient || !waClient.isInitialized) {
    startWA().then(() => res.json(getWAStatus()))
    return
  }
  res.json(getWAStatus())
})

app.get('/api/wa/status', (req, res) => {
  res.json(getWAStatus())
})

app.get('/api/wa/tunnel-url', (req, res) => {
  res.json({ url: cachedTunnelUrl || null })
})

app.post('/api/wa/logout', async (req, res) => {
  await logoutWA()
  waClient = null
  res.json({ success: true })
})

io.on('connection', (socket) => {
  socket.emit('wa:status', getWAStatus())
  if (cachedTunnelUrl) socket.emit('wa:tunnel-url', cachedTunnelUrl)
  if (waClient?.qrCode) {
    socket.emit('wa:qr', waClient.qrCode)
  }

  socket.on('wa:send', async ({ jid, text }) => {
    try {
      await sendWAMessage(jid, text)
      socket.emit('wa:sent', { jid, text })
    } catch (e) {
      socket.emit('wa:error', { error: e.message })
    }
  })

  socket.on('wa:pair', async ({ phoneNumber }) => {
    try {
      const code = await requestPairingCode(phoneNumber)
      socket.emit('wa:pair:code', { code })
    } catch (e) {
      socket.emit('wa:error', { error: e.message })
    }
  })

  socket.on('wa:start', async () => {
    if (!waClient || !waClient.isInitialized || !waClient.sock) {
      waClient = null
      resetWA()
      try { await startWA() } catch (e) {
        console.error('[wa:start] init error:', e.message)
        setTimeout(() => { resetWA(); startWA() }, 5000)
      }
    }
    if (waClient?.qrCode) {
      socket.emit('wa:qr', waClient.qrCode)
    }
    if (waClient?.isConnected) {
      socket.emit('wa:ready', { user: waClient.user })
      if (waClient.contacts?.length > 0) {
        socket.emit('wa:contacts', waClient.contacts)
      }
      if (waClient.chats?.length > 0) {
        socket.emit('wa:chats', waClient.chats)
      }
    }
  })

  socket.on('wa:getChats', () => {
    const chats = getChats()
    if (chats.length > 0) socket.emit('wa:chats', chats)
  })

  socket.on('wa:getContacts', () => {
    if (waClient?.contacts?.length > 0) socket.emit('wa:contacts', waClient.contacts)
  })
})

const clientDist = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
})
