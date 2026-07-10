import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { toDataURL } from 'qrcode'
import path from 'path'
import fs from 'fs'
import pino from 'pino'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const SESSIONS_DIR = path.join(__dirname, 'wa_sessions')

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

const clients = new Map()

export function getWAClient(userId) {
  return clients.get(userId) || null
}

export async function startWAClient(userId, io) {
  if (clients.has(userId)) {
    const existing = clients.get(userId)
    if (existing.sock?.user) return existing
  }

  const sessionDir = path.join(SESSIONS_DIR, userId)
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

  const sock = makeWASocket({
    version: (await fetchLatestBaileysVersion()).version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['WhatsApp Web Clone', 'Chrome', '1.0.0'],
  })

  const client = { sock, userId, qrCode: null, isConnected: false, contacts: [], chats: [] }
  clients.set(userId, client)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      client.qrCode = qr
      try {
        const qrDataUrl = await toDataURL(qr, { width: 300, margin: 2 })
        io.to(`user:${userId}`).emit('wa:qr', qrDataUrl)
      } catch {}
    }

    if (connection === 'open') {
      client.isConnected = true
      client.qrCode = null

      const contacts = await sock.onWhatsApp('0')
      const chats = sock.chats?.all() || []

      client.contacts = chats
        .filter(c => c.id.endsWith('@s.whatsapp.net') && !c.id.includes('status'))
        .map(c => ({
          jid: c.id,
          name: c.name || c.id.split('@')[0],
          pushName: c.name || '',
        }))

      io.to(`user:${userId}`).emit('wa:ready', {
        user: sock.user,
        contacts: client.contacts,
      })
    }

    if (connection === 'close') {
      client.isConnected = false
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        setTimeout(() => startWAClient(userId, io), 5000)
      } else {
        clients.delete(userId)
        io.to(`user:${userId}`).emit('wa:loggedOut')
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      const jid = msg.key.remoteJid
      if (!jid || jid.includes('@g.us')) continue

      const text = msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        ''

      const convId = `wa_${jid.replace(/[^a-zA-Z0-9]/g, '_')}`

      io.to(`user:${userId}`).emit('wa:message', {
        conversationId: convId,
        message: {
          id: msg.key.id,
          senderId: msg.key.fromMe ? userId : jid,
          text,
          type: msg.message?.imageMessage ? 'image' : 'text',
          fileUrl: msg.message?.imageMessage ? await getImageUrl(sock, msg) : undefined,
          timestamp: new Date((msg.messageTimestamp || 0) * 1000).toISOString(),
          status: msg.key.fromMe ? 'sent' : 'delivered',
          fromMe: msg.key.fromMe,
          edited: false,
          deleted: false,
        },
      })
    }
  })

  sock.ev.on('chats.upsert', async (chats) => {
    client.contacts = chats
      .filter(c => c.id.endsWith('@s.whatsapp.net'))
      .map(c => ({
        jid: c.id,
        name: c.name || c.id.split('@')[0],
        pushName: c.name || '',
      }))
  })

  return client
}

async function getImageUrl(sock, msg) {
  try {
    const buffer = await sock.downloadMediaMessage(msg)
    return `data:image/jpeg;base64,${buffer.toString('base64')}`
  } catch {
    return undefined
  }
}

export async function sendWAMessage(userId, jid, text) {
  const client = clients.get(userId)
  if (!client?.sock) throw new Error('WhatsApp not connected')
  await client.sock.sendMessage(jid, { text })
}

export async function getWAChats(userId) {
  const client = clients.get(userId)
  if (!client?.sock) return []
  const chats = await client.sock.chats?.all() || []
  return chats
    .filter(c => c.id.endsWith('@s.whatsapp.net'))
    .map(c => ({
      jid: c.id,
      name: c.name || c.id.split('@')[0],
      lastMessage: c.lastMessage?.conversation || '',
    }))
}

export async function logoutWA(userId) {
  const client = clients.get(userId)
  if (client?.sock) {
    try {
      await client.sock.logout()
    } catch {}
    clients.delete(userId)
  }
  const sessionDir = path.join(SESSIONS_DIR, userId)
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true })
  }
}

export function getWAStatus(userId) {
  const client = clients.get(userId)
  return {
    connected: client?.isConnected || false,
    hasQR: !!client?.qrCode,
    user: client?.sock?.user || null,
  }
}
