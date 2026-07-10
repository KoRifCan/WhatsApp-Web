import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import config from '../config'

const SOCKET_URL = config.backendURL || '/'
const COLORS = ['#00a884', '#5b61b9', '#cb5d5d', '#4a9c6f', '#d4a84b', '#a069c3', '#5badc3', '#d46b9c']

function getColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function formatTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export default function WhatsAppChat() {
  const [connected, setConnected] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [waUser, setWaUser] = useState(null)
  const [contacts, setContacts] = useState([])
  const [messages, setMessages] = useState({})
  const [activeJid, setActiveJid] = useState(null)
  const [inputText, setInputText] = useState('')
  const [search, setSearch] = useState('')
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('wa:status', (status) => {
      if (status.connected) setConnected(true)
    })

    socket.on('wa:qr', (qrDataUrl) => setQrCode(qrDataUrl))

    socket.on('wa:ready', ({ user }) => {
      setConnected(true)
      setQrCode(null)
      setWaUser(user)
    })

    socket.on('wa:contacts', (newContacts) => setContacts(newContacts))

    socket.on('wa:message', ({ from, message }) => {
      setMessages((prev) => ({
        ...prev,
        [from]: [...(prev[from] || []), message],
      }))
    })

    socket.on('wa:sent', ({ jid, text }) => {
      setMessages((prev) => ({
        ...prev,
        [jid]: [...(prev[jid] || []), {
          id: Date.now().toString(),
          fromMe: true,
          text,
          type: 'text',
          timestamp: new Date().toISOString(),
        }],
      }))
    })

    socket.on('wa:loggedOut', () => {
      setConnected(false)
      setQrCode(null)
      setWaUser(null)
      setContacts([])
      setMessages({})
      setActiveJid(null)
    })

    socket.emit('wa:start')
    return () => socket.close()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeJid])

  useEffect(() => {
    if (activeJid && inputRef.current) inputRef.current.focus()
  }, [activeJid])

  const sendMessage = (e) => {
    e.preventDefault()
    if (!inputText.trim() || !activeJid) return
    socketRef.current.emit('wa:send', { jid: activeJid, text: inputText.trim() })
    setInputText('')
  }

  const filteredContacts = contacts.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    const aMsg = messages[a.jid]
    const bMsg = messages[b.jid]
    const aTime = aMsg?.length ? new Date(aMsg[aMsg.length - 1].timestamp).getTime() : 0
    const bTime = bMsg?.length ? new Date(bMsg[bMsg.length - 1].timestamp).getTime() : 0
    return bTime - aTime
  })

  const activeMsgs = activeJid ? messages[activeJid] || [] : []
  const activeContact = contacts.find((c) => c.jid === activeJid)
  const activeColor = getColor(activeContact?.name)

  if (!connected && qrCode) {
    return (
      <div className="wa-landing">
        <div className="wa-landing-header">
          <svg viewBox="0 0 39 39" width="24" height="24" style={{ marginRight: 8 }}>
            <path fill="#fff" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.6 5.9 6-1.5z"/>
            <path fill="#fff" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9z"/>
          </svg>
          WhatsApp Web
        </div>
        <div className="wa-landing-body">
          <div className="wa-landing-left">
            <svg viewBox="0 0 300 200" width="250" height="170">
              <rect x="60" y="10" width="80" height="160" rx="12" fill="#1f2c33" stroke="#2a3942" strokeWidth="2"/>
              <rect x="85" y="15" width="30" height="4" rx="2" fill="#2a3942"/>
              <rect x="65" y="30" width="70" height="60" rx="6" fill="#2a3942"/>
              <path d="M75 40l15 15 20-20" stroke="#00a884" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="100" cy="110" r="18" fill="#2a3942"/>
              <rect x="80" y="140" width="40" height="3" rx="1.5" fill="#2a3942"/>
              <rect x="85" y="148" width="30" height="3" rx="1.5" fill="#2a3942"/>
              <rect x="160" y="30" width="90" height="8" rx="4" fill="#2a3942"/>
              <rect x="160" y="45" width="120" height="8" rx="4" fill="#2a3942"/>
              <rect x="160" y="60" width="100" height="8" rx="4" fill="#2a3942"/>
              <rect x="160" y="80" width="110" height="8" rx="4" fill="#2a3942"/>
              <rect x="160" y="95" width="80" height="8" rx="4" fill="#2a3942"/>
              <rect x="160" y="115" width="95" height="8" rx="4" fill="#2a3942"/>
              <rect x="160" y="130" width="70" height="8" rx="4" fill="#2a3942"/>
            </svg>
            <h2>Gunakan WhatsApp di komputer Anda</h2>
          </div>
          <div className="wa-landing-right">
            <div className="wa-qr-box">
              <img src={qrCode} alt="QR Code" />
            </div>
            <div className="wa-qr-steps">
              <div className="wa-step">
                <span className="wa-step-num">1</span>
                <span>Buka WhatsApp di ponsel Anda</span>
              </div>
              <div className="wa-step">
                <span className="wa-step-num">2</span>
                <span>Ketuk Menu atau Pengaturan, lalu pilih Perangkat Tertaut</span>
              </div>
              <div className="wa-step">
                <span className="wa-step-num">3</span>
                <span>Arahkan kamera ponsel Anda ke kode ini untuk memindai</span>
              </div>
            </div>
          </div>
        </div>
        <div className="wa-landing-footer">
          <svg viewBox="0 0 16 16" width="12" height="12" style={{ marginRight: 4 }}>
            <path fill="#8696a0" d="M8 1a4 4 0 014 4c0 1.5-.8 2.8-2 3.5V10h-4V8.5C4.8 7.8 4 6.5 4 5a4 4 0 014-4zM6 11h4v2H6v-2z"/>
          </svg>
          Dijaga dengan enkripsi end-to-end
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="wa-landing">
        <div className="wa-landing-header">
          <svg viewBox="0 0 39 39" width="24" height="24" style={{ marginRight: 8 }}>
            <path fill="#fff" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.6 5.9 6-1.5z"/>
            <path fill="#fff" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9z"/>
          </svg>
          WhatsApp Web
        </div>
        <div className="wa-loading-body">
          <div className="spinner" />
          <p>Menghubungkan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="wa-app">
      <div className="wa-sidebar">
        <div className="wa-sidebar-header">
          <div className="wa-avatar" style={{ background: getColor(waUser?.name) }}>
            {(waUser?.name || '?')[0].toUpperCase()}
          </div>
          <div className="wa-sidebar-actions">
            <button onClick={() => {
              if (window.confirm('Putuskan sambungan WhatsApp?')) {
                fetch(SOCKET_URL + '/api/wa/logout', { method: 'POST' })
              }
            }} title="Putuskan sambungan">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 4-4 1.41 1.41L10.83 12H16v2h-5.17l2.58 2.59L11 17z"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="wa-search">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#8696a0" d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.207 5.184 5.184 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.006zm-4.808 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z"/>
          </svg>
          <input
            type="text"
            placeholder="Cari atau mulai chat baru"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="wa-chat-list">
          {filteredContacts.map((c) => {
            const cMsgs = messages[c.jid] || []
            const lastMsg = cMsgs.length > 0 ? cMsgs[cMsgs.length - 1] : null
            const color = getColor(c.name)
            return (
              <div
                key={c.jid}
                className={`wa-chat-item ${activeJid === c.jid ? 'active' : ''}`}
                onClick={() => setActiveJid(c.jid)}
              >
                <div className="wa-avatar" style={{ background: color, width: 49, height: 49, fontSize: 20 }}>
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div className="wa-chat-info">
                  <div className="wa-chat-name">{c.name || c.jid}</div>
                  {lastMsg && (
                    <div className="wa-chat-preview">
                      {lastMsg.fromMe && <span className="wa-preview-you">Anda: </span>}
                      {lastMsg.text}
                    </div>
                  )}
                </div>
                {lastMsg && <div className="wa-chat-time">{formatTime(lastMsg.timestamp)}</div>}
              </div>
            )
          })}
          {filteredContacts.length === 0 && (
            <div className="wa-empty">Tidak ada chat</div>
          )}
        </div>
      </div>

      <div className="wa-main">
        {activeJid ? (
          <>
            <div className="wa-main-header">
              <div className="wa-avatar" style={{ background: activeColor, width: 40, height: 40, fontSize: 16 }}>
                {(activeContact?.name || '?')[0].toUpperCase()}
              </div>
              <div className="wa-main-header-info">
                <div className="wa-main-header-name">{activeContact?.name || activeJid}</div>
                <div className="wa-main-header-status">WhatsApp</div>
              </div>
            </div>
            <div className="wa-messages">
              {activeMsgs.map((msg) => (
                <div key={msg.id} className={`wa-msg ${msg.fromMe ? 'sent' : 'received'}`}>
                  <div className="wa-msg-bubble">
                    <div className="wa-msg-text">{msg.text}</div>
                    <div className="wa-msg-meta">
                      <span>{formatTime(msg.timestamp)}</span>
                      {msg.fromMe && (
                        <svg viewBox="0 0 16 11" width="14" height="10" className="wa-check">
                          <path fill="currentColor" d="M11.07.65l-5.7 5.7-2.3-2.3L1.93 5.2l3.44 3.44L12.2 1.78z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="wa-input-area">
              <form onSubmit={sendMessage}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Ketik pesan"
                  autoFocus
                />
                <button type="submit" className="wa-send" disabled={!inputText.trim()}>
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="wa-nochat">
            <div className="wa-nochat-icon">
              <svg viewBox="0 0 303 172" width="240" height="136">
                <rect x="15" y="30" width="110" height="120" rx="8" fill="#1f2c33" stroke="#2a3942" strokeWidth="2"/>
                <circle cx="70" cy="60" r="18" fill="#2a3942"/>
                <rect x="35" y="90" width="70" height="6" rx="3" fill="#2a3942"/>
                <rect x="40" y="102" width="60" height="6" rx="3" fill="#2a3942"/>
                <rect x="35" y="115" width="50" height="6" rx="3" fill="#2a3942"/>
                <path d="M155 55h120M155 70h100M155 85h110" stroke="#2a3942" strokeWidth="6" strokeLinecap="round"/>
                <path d="M155 110h95M155 125h80" stroke="#2a3942" strokeWidth="6" strokeLinecap="round"/>
                <rect x="175" y="45" width="18" height="18" rx="4" fill="#00a884"/>
                <path d="M180 50l3 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="wa-nochat-title">WhatsApp Web</h2>
            <p className="wa-nochat-subtitle">
              Kirim dan terima pesan tanpa perlu membuka ponsel.
            </p>
            <p className="wa-nochat-hint">Pilih chat dari sidebar untuk mulai berbicara</p>
          </div>
        )}
      </div>
    </div>
  )
}
