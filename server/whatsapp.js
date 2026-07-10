import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, BufferJSON } from '@whiskeysockets/baileys'
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
  chats: [],
}
let _io = null
let resolveSockReady = null
let cachedVersion = null
let _restartingAfterPairing = false
let _pendingPairingRestart = false

const FALLBACK_VERSION = [2, 3000, 1035194821]

async function getVersion() {
  if (!cachedVersion) {
    try {
      const result = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
      ])
      cachedVersion = result.version
    } catch (e) {
      console.log('[WA] Version fetch failed, using fallback:', e.message)
      cachedVersion = FALLBACK_VERSION
    }
  }
  return cachedVersion
}

export function getWAStatus() {
  return {
    connected: client.isConnected,
    hasQR: !!client.qrCode,
    user: client.user,
  }
}

export function getChats() {
  return client.chats || []
}

function waitForSockReady(timeout = 8000) {
  if (client.sock && client.qrCode) return Promise.resolve()
  if (client.isConnected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    resolveSockReady = resolve
    setTimeout(() => {
      resolveSockReady = null
      reject(new Error('Koneksi WhatsApp terputus, silakan coba lagi'))
    }, timeout)
  })
}

export function resetWA() {
  client.isInitialized = false
}

export async function initWA(io) {
  if (client.isInitialized) return client
  _io = io
  client.isInitialized = true

  try {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true })
    }

    let { state } = await useMultiFileAuthState(SESSION_DIR)

    if (state.creds && state.creds.me && !state.creds.registered) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true })
      fs.mkdirSync(SESSION_DIR, { recursive: true })
      const fresh = await useMultiFileAuthState(SESSION_DIR)
      state = fresh.state
    }

    const version = await getVersion()
    console.log('[WA] Using Baileys version:', version.join('.'))

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Ubuntu', 'Chrome', '22.04.4'],
      syncFullHistory: true,
      connectTimeoutMs: 60000,
      qrTimeout: 120000,
    })

    client.sock = sock
    console.log('[WA] Socket created, waiting for QR/connection...')

  let initTimer = setTimeout(() => {
    console.log('[WA] No QR or connection after 25s, restarting...')
    client.isInitialized = false
    client.qrCode = null
    client.sock = null
    try { sock.end?.() } catch {}
    setTimeout(() => initWA(io), 1000)
  }, 25000)

  const clearInitTimer = () => { try { clearTimeout(initTimer) } catch {} }

  sock.ev.on('creds.update', (creds) => {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true })
    fs.writeFileSync(path.join(SESSION_DIR, 'creds.json'), JSON.stringify(creds, BufferJSON.replacer, 2))
    if (creds.registered && _pendingPairingRestart) {
      _pendingPairingRestart = false
      console.log('[WA] Phone pairing completed, restarting connection...')
      _restartingAfterPairing = true
      client.qrCode = null
      client.isInitialized = false
      try { sock.end?.() } catch {}
      setTimeout(() => { _restartingAfterPairing = false; initWA(_io) }, 2000)
    }
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      clearInitTimer()
      client.qrCode = await toDataURL(qr, { width: 300, margin: 2 })
      client.isConnected = false
      io.emit('wa:qr', client.qrCode)
      if (resolveSockReady) {
        resolveSockReady()
        resolveSockReady = null
      }
    }
    if (connection === 'open') {
      clearInitTimer()
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
      clearInitTimer()
      const statusCode = lastDisconnect?.error?.output?.statusCode
      console.log('[WA] Connection closed. statusCode:', statusCode, 'error:', lastDisconnect?.error?.message || 'none')
      client.isConnected = false
      client.qrCode = null
      client.sock = null
      if (_restartingAfterPairing) return
      if (statusCode !== DisconnectReason.loggedOut) {
        setTimeout(() => {
          client.isInitialized = false
          initWA(io)
        }, 5000)
      } else {
        client.user = null
        client.qrCode = null
        client.isInitialized = false
        if (fs.existsSync(SESSION_DIR)) fs.rmSync(SESSION_DIR, { recursive: true, force: true })
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

  sock.ev.on('chats.upsert', (chats) => {
    const list = chats
      .filter((c) => c.id.endsWith('@s.whatsapp.net'))
      .map((c) => ({
        jid: c.id,
        name: c.name || c.id.split('@')[0],
        timestamp: c.conversationTimestamp ? new Date((c.conversationTimestamp || 0) * 1000).toISOString() : null,
        unread: c.unreadCount || 0,
      }))
    client.chats = list
    io.emit('wa:chats', list)
  })

  return client
  } catch (e) {
    console.error('[WA] initWA error:', e.message)
    client.isInitialized = false
    client.sock = null
    setTimeout(() => initWA(io), 5000)
    return client
  }
}

export async function requestPairingCode(phoneNumber) {
  const t0 = Date.now()
  if (!client.sock || !client.isInitialized) {
    client.isInitialized = false
    await initWA(_io)
    console.log(`[PAIR] init took ${Date.now() - t0}ms`)
    await waitForSockReady()
    console.log(`[PAIR] waitSock took ${Date.now() - t0}ms`)
  } else {
    if (client.isConnected) {
      throw new Error('Perangkat sudah tertaut. Silakan logout terlebih dahulu.')
    }
    if (client.sock && client.qrCode) {
      // socket is ready, proceed
    } else {
      console.log(`[PAIR] waiting for socket... (t=${Date.now() - t0}ms)`)
      await waitForSockReady()
      console.log(`[PAIR] wait took ${Date.now() - t0}ms`)
    }
  }
  if (!client.sock) {
    throw new Error('Koneksi WhatsApp terputus, silakan coba lagi')
  }
  console.log(`[PAIR] Requesting code for ${phoneNumber}... (t=${Date.now() - t0}ms)`)
  try {
    const t1 = Date.now()
    const code = await client.sock.requestPairingCode(phoneNumber)
    console.log(`[PAIR] requestPairingCode() took ${Date.now() - t1}ms`)
    if (!code || code.length < 4) {
      throw new Error('Kode tidak valid dari server WhatsApp')
    }
    console.log(`[PAIR] Code received (${code.length} chars): ${code.substring(0, 4)}... total=${Date.now() - t0}ms`)
    _pendingPairingRestart = true
    setTimeout(() => { _pendingPairingRestart = false }, 60000)
    return code
  } catch (e) {
    console.error(`[PAIR] Error for ${phoneNumber} at ${Date.now() - t0}ms: ${e.message}`)
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
