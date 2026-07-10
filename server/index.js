import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { startWAClient, sendWAMessage, logoutWA, getWAStatus, getWAClient } from './whatsapp.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, 'data.json')
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-clone-secret-key-2024'
const PORT = process.env.PORT || 3001

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
})

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    }
  } catch (e) {
    console.error('Error loading data:', e)
  }
  return { users: {}, conversations: {}, messages: {} }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.userId = jwt.verify(token, JWT_SECRET).userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

const app = express()
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

app.post('/api/register', async (req, res) => {
  const { name, phone, password } = req.body
  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Semua field wajib diisi' })
  }
  const data = loadData()
  const existing = Object.values(data.users).find(u => u.phone === phone)
  if (existing) {
    return res.status(400).json({ error: 'Nomor telepon sudah terdaftar' })
  }
  const hashedPassword = await bcrypt.hash(password, 10)
  const user = {
    id: uuidv4(),
    name,
    phone,
    password: hashedPassword,
    avatar: name.charAt(0).toUpperCase(),
    online: false,
    createdAt: new Date().toISOString(),
  }
  data.users[user.id] = user
  saveData(data)
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
  const { password: _, ...userWithoutPassword } = user
  res.json({ user: userWithoutPassword, token })
})

app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone dan password wajib diisi' })
  }
  const data = loadData()
  const user = Object.values(data.users).find(u => u.phone === phone)
  if (!user) {
    return res.status(400).json({ error: 'Nomor tidak terdaftar' })
  }
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    return res.status(400).json({ error: 'Password salah' })
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
  const { password: _, ...userWithoutPassword } = user
  res.json({ user: userWithoutPassword, token })
})

app.get('/api/users', authMiddleware, (req, res) => {
  const data = loadData()
  const users = Object.values(data.users)
    .filter(u => u.id !== req.userId)
    .map(({ password, ...u }) => u)
  res.json(users)
})

app.get('/api/conversations', authMiddleware, (req, res) => {
  const data = loadData()
  const convs = Object.values(data.conversations)
    .filter(c => c.participants.includes(req.userId))
    .map(c => {
      const otherUserId = c.participants.find(p => p !== req.userId)
      const otherUser = data.users[otherUserId]
      return {
        ...c,
        otherUser: otherUser
          ? { id: otherUser.id, name: otherUser.name, phone: otherUser.phone, avatar: otherUser.avatar, online: otherUser.online }
          : null,
      }
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  res.json(convs)
})

app.get('/api/messages/:conversationId', authMiddleware, (req, res) => {
  const data = loadData()
  const messages = data.messages[req.params.conversationId] || []
  res.json(messages)
})

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const isImage = req.file.mimetype.startsWith('image/')
  res.json({
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
    isImage,
  })
})

app.post('/api/whatsapp/start', authMiddleware, async (req, res) => {
  try {
    const client = await startWAClient(req.userId, io)
    const status = getWAStatus(req.userId)
    res.json({ status })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/whatsapp/status', authMiddleware, (req, res) => {
  const status = getWAStatus(req.userId)
  res.json(status)
})

app.post('/api/whatsapp/logout', authMiddleware, async (req, res) => {
  await logoutWA(req.userId)
  res.json({ success: true })
})

function authenticateSocket(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

io.use((socket, next) => {
  const token = socket.handshake.auth.token
  const decoded = authenticateSocket(token)
  if (!decoded) return next(new Error('Authentication error'))
  socket.userId = decoded.userId
  next()
})

io.on('connection', (socket) => {
  const data = loadData()
  const user = data.users[socket.userId]
  if (user) {
    user.online = true
    saveData(data)
    io.emit('user:status', { userId: socket.userId, online: true })
  }

  socket.join(`user:${socket.userId}`)

  socket.on('conversation:start', ({ targetUserId }) => {
    const data = loadData()
    const existing = Object.values(data.conversations).find(
      c => c.participants.includes(socket.userId) && c.participants.includes(targetUserId)
    )
    if (existing) {
      socket.emit('conversation:created', existing)
      return
    }
    const conv = {
      id: uuidv4(),
      participants: [socket.userId, targetUserId],
      lastMessage: null,
      updatedAt: new Date().toISOString(),
    }
    data.conversations[conv.id] = conv
    data.messages[conv.id] = []
    saveData(data)
    io.to(`user:${socket.userId}`)
      .to(`user:${targetUserId}`)
      .emit('conversation:created', conv)
  })

  socket.on('message:send', ({ conversationId, text, type = 'text', fileUrl, fileName, fileType }) => {
    const data = loadData()
    const conv = data.conversations[conversationId]
    if (!conv || !conv.participants.includes(socket.userId)) return

    const message = {
      id: uuidv4(),
      senderId: socket.userId,
      text,
      type,
      fileUrl,
      fileName,
      fileType,
      timestamp: new Date().toISOString(),
      status: 'sent',
      edited: false,
      deleted: false,
    }

    if (!data.messages[conversationId]) data.messages[conversationId] = []
    data.messages[conversationId].push(message)

    const preview = type === 'image' ? 'Gambar' : type === 'file' ? fileName || 'File' : text
    conv.lastMessage = {
      text: preview,
      senderId: socket.userId,
      timestamp: message.timestamp,
      type,
    }
    conv.updatedAt = message.timestamp
    saveData(data)

    conv.participants.forEach((pid) => {
      io.to(`user:${pid}`).emit('message:new', { conversationId, message })
      io.to(`user:${pid}`).emit('conversation:updated', {
        ...conv,
        otherUser: data.users[conv.participants.find((p) => p !== pid)],
      })
    })

    setTimeout(() => {
      const data2 = loadData()
      const msg = data2.messages[conversationId]?.find((m) => m.id === message.id)
      if (msg) {
        msg.status = 'delivered'
        saveData(data2)
        conv.participants.forEach((pid) => {
          io.to(`user:${pid}`).emit('message:status', {
            conversationId,
            messageId: message.id,
            status: 'delivered',
          })
        })
      }
    }, 500)
  })

  socket.on('message:read', ({ conversationId }) => {
    const data = loadData()
    const conv = data.conversations[conversationId]
    if (!conv) return
    const messages = data.messages[conversationId] || []
    messages.forEach((m) => {
      if (m.senderId !== socket.userId && m.status !== 'read') {
        m.status = 'read'
      }
    })
    saveData(data)
    conv.participants.forEach((pid) => {
      io.to(`user:${pid}`).emit('messages:read', { conversationId, userId: socket.userId })
    })
  })

  socket.on('message:edit', ({ conversationId, messageId, text }) => {
    const data = loadData()
    const conv = data.conversations[conversationId]
    if (!conv) return
    const msg = data.messages[conversationId]?.find((m) => m.id === messageId)
    if (!msg || msg.senderId !== socket.userId) return
    msg.text = text
    msg.edited = true
    conv.lastMessage = {
      text,
      senderId: socket.userId,
      timestamp: msg.timestamp,
      type: msg.type,
    }
    saveData(data)
    conv.participants.forEach((pid) => {
      io.to(`user:${pid}`).emit('message:edited', { conversationId, messageId, text })
      io.to(`user:${pid}`).emit('conversation:updated', {
        ...conv,
        otherUser: data.users[conv.participants.find((p) => p !== pid)],
      })
    })
  })

  socket.on('message:delete', ({ conversationId, messageId }) => {
    const data = loadData()
    const conv = data.conversations[conversationId]
    if (!conv) return
    const msg = data.messages[conversationId]?.find((m) => m.id === messageId)
    if (!msg || msg.senderId !== socket.userId) return
    msg.deleted = true
    msg.text = 'Pesan ini telah dihapus'
    conv.lastMessage = {
      text: 'Pesan dihapus',
      senderId: socket.userId,
      timestamp: msg.timestamp,
    }
    saveData(data)
    conv.participants.forEach((pid) => {
      io.to(`user:${pid}`).emit('message:deleted', { conversationId, messageId })
      io.to(`user:${pid}`).emit('conversation:updated', {
        ...conv,
        otherUser: data.users[conv.participants.find((p) => p !== pid)],
      })
    })
  })

  socket.on('typing:start', ({ conversationId }) => {
    const data = loadData()
    const conv = data.conversations[conversationId]
    if (!conv) return
    const targetId = conv.participants.find((p) => p !== socket.userId)
    if (targetId) {
      io.to(`user:${targetId}`).emit('typing:status', {
        conversationId,
        userId: socket.userId,
        typing: true,
      })
    }
  })

  socket.on('typing:stop', ({ conversationId }) => {
    const data = loadData()
    const conv = data.conversations[conversationId]
    if (!conv) return
    const targetId = conv.participants.find((p) => p !== socket.userId)
    if (targetId) {
      io.to(`user:${targetId}`).emit('typing:status', {
        conversationId,
        userId: socket.userId,
        typing: false,
      })
    }
  })

  socket.on('wa:send', async ({ jid, text }) => {
    try {
      await sendWAMessage(socket.userId, jid, text)
      socket.emit('wa:sent', { jid, text })
    } catch (e) {
      socket.emit('wa:error', { error: e.message })
    }
  })

  socket.on('wa:logout', async () => {
    await logoutWA(socket.userId)
    socket.emit('wa:loggedOut')
  })

  socket.on('disconnect', () => {
    const data = loadData()
    const user = data.users[socket.userId]
    if (user) {
      user.online = false
      saveData(data)
      io.emit('user:status', { userId: socket.userId, online: false })
    }
  })
})

const clientDist = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDist, 'index.html'))
    }
  })
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
})
