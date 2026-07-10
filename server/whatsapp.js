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
  contacts: [],
}
let _io = null
let resolveSockReady = null

export function getWAStatus() {
  return {
    connected: client.isConnected,
    hasQR: !!client.qrCode,
    user: client.user,
  }
}

function waitForSockReady(timeout = 15000) {
  if (client.sock && client.qrCode && client.sock.ws?.readyState === 1) return Promise.resolve()
  if (client.isConnected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    resolveSockReady = resolve
    setTimeout(() => {
      resolveSockReady = null
      reject(new Error('Timeout menunggu koneksi WhatsApp'))
    }, timeout)
  })
}

export async function initWA(io) {
  if (client.isInitialized) return client
  _io = io
  client.isInitialized = true

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true })
  }

  let { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

  if (state.creds && !state.creds.registered) {
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
    browser: ['Ubuntu', 'Chrome', '22.04.4'],
    syncFullHistory: false,
  })

  client.sock = sock

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      client.qrCode = await toDataURL(qr, { width: 300, margin: 2 })
      client.isConnected = false
      io.emit('wa:qr', client.qrCode)
      if (resolveSockReady) {
        resolveSockReady()
        resolveSockReady = null
      }
    }
    if (connection === 'open') {
      client.isConnected = true
      client.qrCode = null
      client.user = sock.user
      io.emit('wa:ready', { user: sock.user })
      if (resolveSockReady) {
        resolveSockReady()
        resolveSockReady = null
      }
    }
    if (connection === 'close') {
      client.isConnected = false
      client.qrCode = null
      client.sock = null
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

  sock.ev.on('contacts.upsert', (contacts) => {
    const list = contacts
      .filter((c) => c.id.endsWith('@s.whatsapp.net'))
      .map((c) => ({ jid: c.id, name: c.name || c.notify || c.id.split('@')[0] }))
    client.contacts = list
    io.emit('wa:contacts', list)
  })

  return client
}

export async function requestPairingCode(phoneNumber) {
  if (!client.sock || !client.isInitialized) {
    client.isInitialized = false
    await initWA(_io)
    await waitForSockReady()
  }
  if (client.isConnected) {
    throw new Error('Perangkat sudah tertaut. Silakan logout terlebih dahulu.')
  }
  await waitForSockReady()
  if (!client.sock) {
    throw new Error('Koneksi WhatsApp terputus, silakan coba lagi')
  }
  console.log(`[PAIR] Requesting code for ${phoneNumber}...`)
  console.log(`[PAIR] sock=${!!client.sock}, ws=${client.sock?.ws?.readyState}, qr=${!!client.qrCode}, conn=${client.isConnected}`)
  try {
    const code = await client.sock.requestPairingCode(phoneNumber)
    if (!code || code.length < 4) {
      throw new Error('Kode tidak valid dari server WhatsApp')
    }
    console.log(`[PAIR] Code received (${code.length} chars): ${code.substring(0, 4)}...`)
    return code
  } catch (e) {
    console.error(`[PAIR] Error for ${phoneNumber}: ${e.message}`)
    throw e
  }
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
  client.contacts = []
  const dir = SESSION_DIR
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}
