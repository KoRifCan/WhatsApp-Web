import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { toDataURL } from 'qrcode'
import path from 'path'
import fs from 'fs'
import pino from 'pino'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const SESSION_DIR = path.join(__dirname, 'wa_session')

let client = {
  sock: null,
  qrCode: null,
  isConnected: false,
  isInitialized: false,
  user: null,
}

export function getWAStatus() {
  return {
    connected: client.isConnected,
    hasQR: !!client.qrCode,
    user: client.user,
  }
}

export async function initWA(io) {
  if (client.isInitialized) return client
  client.isInitialized = true

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true })
  }

  let { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

  if (state.creds && !state.creds.registered && state.creds.pairingCode) {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true })
    fs.mkdirSync(SESSION_DIR, { recursive: true })
    const fresh = await useMultiFileAuthState(SESSION_DIR)
    state = fresh.state
    saveCreds = fresh.saveCreds
  }
  const sock = makeWASocket({
    version: (await fetchLatestBaileysVersion()).version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['WhatsApp Web Clone', 'Chrome', '1.0.0'],
  })

  client.sock = sock

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      client.qrCode = await toDataURL(qr, { width: 300, margin: 2 })
      client.isConnected = false
      io.emit('wa:qr', client.qrCode)
    }
    if (connection === 'open') {
      client.isConnected = true
      client.qrCode = null
      client.user = sock.user
      io.emit('wa:ready', { user: sock.user })
    }
    if (connection === 'close') {
      client.isConnected = false
      const statusCode = lastDisconnect?.error?.output?.statusCode
      if (statusCode !== DisconnectReason.loggedOut) {
        setTimeout(() => {
          client.isInitialized = false
          initWA(io)
        }, 5000)
      } else {
        client.user = null
        client.qrCode = null
        io.emit('wa:loggedOut')
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      const jid = msg.key.remoteJid
      if (!jid || jid.includes('@g.us') || jid.includes('@broadcast')) continue
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        ''
      io.emit('wa:message', {
        from: jid,
        message: {
          id: msg.key.id,
          fromMe: msg.key.fromMe,
          text,
          type: msg.message?.imageMessage ? 'image' : 'text',
          timestamp: new Date((msg.messageTimestamp || 0) * 1000).toISOString(),
        },
      })
    }
  })

  sock.ev.on('contacts.upsert', () => {
    const chats = sock.chats?.all() || []
    const contacts = chats
      .filter((c) => c.id.endsWith('@s.whatsapp.net'))
      .map((c) => ({ jid: c.id, name: c.name || c.id.split('@')[0] }))
    io.emit('wa:contacts', contacts)
  })

  return client
}

export async function requestPairingCode(phoneNumber) {
  if (!client.sock) throw new Error('WhatsApp not initialized')
  const code = await client.sock.requestPairingCode(phoneNumber)
  return code
}

export async function sendWAMessage(jid, text) {
  if (!client.sock) throw new Error('WhatsApp not connected')
  await client.sock.sendMessage(jid, { text })
}

export async function logoutWA() {
  try {
    await client.sock?.logout()
  } catch {}
  client.sock = null
  client.qrCode = null
  client.isConnected = false
  client.isInitialized = false
  client.user = null
  const dir = SESSION_DIR
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}
