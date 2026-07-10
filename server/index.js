import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { initWA, sendWAMessage, logoutWA, getWAStatus } from './whatsapp.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

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

app.post('/api/wa/logout', async (req, res) => {
  await logoutWA()
  waClient = null
  res.json({ success: true })
})

io.on('connection', (socket) => {
  socket.emit('wa:status', getWAStatus())
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

  socket.on('wa:start', async () => {
    if (!waClient || !waClient.isConnected) {
      await startWA()
    }
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
