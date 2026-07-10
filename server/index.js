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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, 'data.json')
const JWT_SECRET = 'whatsapp-clone-secret-key-2024'
const PORT = process.env.PORT || 3001

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

const app = express()
app.use(cors())
app.use(express.json())

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

app.get('/api/users', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const data = loadData()
    const users = Object.values(data.users)
      .filter(u => u.id !== decoded.userId)
      .map(({ password, ...u }) => u)
    res.json(users)
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' })
  }
})

app.get('/api/conversations', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const data = loadData()
    const convs = Object.values(data.conversations)
      .filter(c => c.participants.includes(decoded.userId))
      .map(c => {
        const otherUserId = c.participants.find(p => p !== decoded.userId)
        const otherUser = data.users[otherUserId]
        return {
          ...c,
          otherUser: otherUser ? { id: otherUser.id, name: otherUser.name, phone: otherUser.phone, avatar: otherUser.avatar, online: otherUser.online } : null,
        }
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    res.json(convs)
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' })
  }
})

app.get('/api/messages/:conversationId', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    jwt.verify(token, JWT_SECRET)
    const data = loadData()
    const messages = data.messages[req.params.conversationId] || []
    res.json(messages)
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' })
  }
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
    const existing = Object.values(data.conversations).find(c =>
      c.participants.includes(socket.userId) && c.participants.includes(targetUserId)
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
    io.to(`user:${socket.userId}`).to(`user:${targetUserId}`).emit('conversation:created', conv)
  })

  socket.on('message:send', ({ conversationId, text, type = 'text' }) => {
    const data = loadData()
    const conv = data.conversations[conversationId]
    if (!conv || !conv.participants.includes(socket.userId)) return

    const message = {
      id: uuidv4(),
      senderId: socket.userId,
      text,
      type,
      timestamp: new Date().toISOString(),
      status: 'sent',
    }

    if (!data.messages[conversationId]) data.messages[conversationId] = []
    data.messages[conversationId].push(message)

    conv.lastMessage = { text, senderId: socket.userId, timestamp: message.timestamp }
    conv.updatedAt = message.timestamp
    saveData(data)

    conv.participants.forEach(pid => {
      io.to(`user:${pid}`).emit('message:new', { conversationId, message })
      io.to(`user:${pid}`).emit('conversation:updated', {
        ...conv,
        otherUser: data.users[conv.participants.find(p => p !== pid)],
      })
    })

    setTimeout(() => {
      const data2 = loadData()
      const msg = data2.messages[conversationId]?.find(m => m.id === message.id)
      if (msg) {
        msg.status = 'delivered'
        saveData(data2)
        conv.participants.forEach(pid => {
          io.to(`user:${pid}`).emit('message:status', { conversationId, messageId: message.id, status: 'delivered' })
        })
      }
    }, 500)
  })

  socket.on('message:read', ({ conversationId }) => {
    const data = loadData()
    const conv = data.conversations[conversationId]
    if (!conv) return
    const messages = data.messages[conversationId] || []
    messages.forEach(m => {
      if (m.senderId !== socket.userId && m.status !== 'read') {
        m.status = 'read'
      }
    })
    saveData(data)
    conv.participants.forEach(pid => {
      io.to(`user:${pid}`).emit('messages:read', { conversationId, userId: socket.userId })
    })
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
