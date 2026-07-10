import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import config from '../config'

const SOCKET_URL = config.backendURL || '/'

export default function WhatsAppChat() {
  const [connected, setConnected] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [waUser, setWaUser] = useState(null)
  const [contacts, setContacts] = useState([])
  const [messages, setMessages] = useState({})
  const [activeJid, setActiveJid] = useState(null)
  const [inputText, setInputText] = useState('')
  const [search, setSearch] = useState('')
  const [showQR, setShowQR] = useState(false)
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('wa:status', (status) => {
      if (status.connected) setConnected(true)
      if (status.hasQR) setShowQR(true)
    })

    socket.on('wa:qr', (qrDataUrl) => {
      setQrCode(qrDataUrl)
      setShowQR(true)
    })

    socket.on('wa:ready', ({ user }) => {
      setConnected(true)
      setQrCode(null)
      setShowQR(false)
      setWaUser(user)
    })

    socket.on('wa:contacts', (newContacts) => {
      setContacts(newContacts)
    })

    socket.on('wa:message', ({ from, message }) => {
      setMessages((prev) => ({
        ...prev,
        [from]: [...(prev[from] || []), message],
      }))
    })

    socket.on('wa:sent', ({ jid, text }) => {
      setMessages((prev) => ({
        ...prev,
        [jid]: [
          ...(prev[jid] || []),
          {
            id: Date.now().toString(),
            fromMe: true,
            text,
            type: 'text',
            timestamp: new Date().toISOString(),
          },
        ],
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

  const sendMessage = (e) => {
    e.preventDefault()
    if (!inputText.trim() || !activeJid) return
    socketRef.current.emit('wa:send', { jid: activeJid, text: inputText.trim() })
    setInputText('')
  }

  const filteredContacts = contacts.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  )

  const activeMsgs = activeJid ? messages[activeJid] || [] : []
  const activeContact = contacts.find((c) => c.jid === activeJid)

  if (!connected && qrCode) {
    return (
      <div className="login-page">
        <div className="login-container qr-full">
          <div className="login-header">
            <div className="whatsapp-logo">
              <svg viewBox="0 0 39 39" width="48" height="48">
                <path fill="#00E676" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.6 5.9 6-1.5z"/>
                <path fill="#fff" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9zM19.5 34.6c-2.7 0-5.4-.7-7.7-2.1l-.6-.3-5.8 1.5L6.9 28l-.4-.6c-4.4-7.1-2.3-16.5 4.9-20.9s16.5-2.3 20.9 4.9 2.3 16.5-4.9 20.9c-2.3 1.5-5.1 2.3-7.9 2.3zm8.8-11.1l-1.1-.5s-1.6-.7-2.6-1.2c-.1 0-.2-.1-.3-.1-.3 0-.5.1-.7.2 0 0-.1.1-1.5 1.7-.1.2-.3.3-.5.3h-.1c-.1 0-.3-.1-.4-.2l-.5-.2c-1.1-.5-2.1-1.1-2.9-1.9-.2-.2-.5-.4-.7-.6-.7-.7-1.4-1.5-1.9-2.4l-.1-.2c-.1-.1-.1-.2-.2-.4 0-.2 0-.4.1-.5 0 0 .4-.5.7-.8.2-.2.3-.5.5-.7.2-.3.3-.7.2-1-.1-.5-1.3-3.2-1.6-3.8-.2-.3-.4-.4-.7-.5h-1.1c-.2 0-.4.1-.6.1l-.1.1c-.2.1-.4.3-.6.4-.2.2-.3.4-.5.6-.7.9-1.1 2-1.1 3.1 0 .8.2 1.6.5 2.3l.1.3c.9 1.9 2.1 3.6 3.7 5.1l.4.4c.3.3.6.5.8.8 2.1 1.8 4.5 3.1 7.2 3.8.3.1.7.1 1 .2h1c.5 0 1.1-.2 1.5-.4.3-.2.5-.2.7-.4l.2-.2c.2-.2.4-.3.6-.5s.3-.4.5-.6c.2-.4.3-.9.4-1.4v-.7s-.1-.1-.3-.2z"/>
              </svg>
            </div>
            <h1>WhatsApp Web</h1>
            <p>Hubungkan dengan WhatsApp Anda</p>
          </div>
          <div className="qr-display">
            <img src={qrCode} alt="QR Code" />
          </div>
          <p className="qr-hint">Scan dengan WhatsApp di ponsel Anda</p>
            <p className="qr-subhint">{'Buka WhatsApp > Titik tiga > Perangkat tertaut > Hubungkan perangkat'}</p>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-header">
            <div className="whatsapp-logo">
              <svg viewBox="0 0 39 39" width="48" height="48">
                <path fill="#00E676" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.6 5.9 6-1.5z"/>
                <path fill="#fff" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9zM19.5 34.6c-2.7 0-5.4-.7-7.7-2.1l-.6-.3-5.8 1.5L6.9 28l-.4-.6c-4.4-7.1-2.3-16.5 4.9-20.9s16.5-2.3 20.9 4.9 2.3 16.5-4.9 20.9c-2.3 1.5-5.1 2.3-7.9 2.3zm8.8-11.1l-1.1-.5s-1.6-.7-2.6-1.2c-.1 0-.2-.1-.3-.1-.3 0-.5.1-.7.2 0 0-.1.1-1.5 1.7-.1.2-.3.3-.5.3h-.1c-.1 0-.3-.1-.4-.2l-.5-.2c-1.1-.5-2.1-1.1-2.9-1.9-.2-.2-.5-.4-.7-.6-.7-.7-1.4-1.5-1.9-2.4l-.1-.2c-.1-.1-.1-.2-.2-.4 0-.2 0-.4.1-.5 0 0 .4-.5.7-.8.2-.2.3-.5.5-.7.2-.3.3-.7.2-1-.1-.5-1.3-3.2-1.6-3.8-.2-.3-.4-.4-.7-.5h-1.1c-.2 0-.4.1-.6.1l-.1.1c-.2.1-.4.3-.6.4-.2.2-.3.4-.5.6-.7.9-1.1 2-1.1 3.1 0 .8.2 1.6.5 2.3l.1.3c.9 1.9 2.1 3.6 3.7 5.1l.4.4c.3.3.6.5.8.8 2.1 1.8 4.5 3.1 7.2 3.8.3.1.7.1 1 .2h1c.5 0 1.1-.2 1.5-.4.3-.2.5-.2.7-.4l.2-.2c.2-.2.4-.3.6-.5s.3-.4.5-.6c.2-.4.3-.9.4-1.4v-.7s-.1-.1-.3-.2z"/>
              </svg>
            </div>
            <h1>WhatsApp Web</h1>
            <p className="qr-subhint">Menghubungkan...</p>
            <div className="spinner" style={{ margin: '20px auto' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="current-user">
              <div className="avatar wa-avatar">WA</div>
              <span>{waUser?.name || 'WhatsApp'}</span>
            </div>
            <div className="header-actions">
              <button onClick={() => {
                if (confirm('Putuskan sambungan WhatsApp?')) {
                  fetch('/api/wa/logout', { method: 'POST' })
                }
              }} title="Putuskan">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="search-bar">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.207 5.184 5.184 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.006z"/>
            </svg>
            <input type="text" placeholder="Cari chat" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="conversations-list">
            {filteredContacts.map(c => (
              <div
                key={c.jid}
                className={`conversation-item ${activeJid === c.jid ? 'active' : ''}`}
                onClick={() => setActiveJid(c.jid)}
              >
                <div className="avatar wa-avatar">WA</div>
                <div className="conv-info">
                  <div className="conv-name">{c.name || c.jid}</div>
                </div>
              </div>
            ))}
            {filteredContacts.length === 0 && (
              <div className="no-conversations">
                <p>Tidak ada chat</p>
              </div>
            )}
          </div>
        </div>

        {activeJid ? (
          <div className="chat-area">
            <div className="chat-header">
              <div className="avatar wa-avatar">WA</div>
              <div className="chat-header-info">
                <div className="chat-header-name">{activeContact?.name || activeJid}</div>
                <div className="chat-header-status">WhatsApp</div>
              </div>
            </div>
            <div className="messages-container">
              {activeMsgs.map((msg) => (
                <div key={msg.id} className={`message-row ${msg.fromMe ? 'own' : 'other'}`}>
                  <div className="message-bubble" style={{ background: msg.fromMe ? '#005c4b' : '#202c33' }}>
                    <div className="message-text">{msg.text}</div>
                    <div className="message-meta">
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.fromMe && (
                        <svg viewBox="0 0 12 11" width="12" height="11" className="msg-status sent">
                          <path fill="currentColor" d="M11.07.65l-5.7 5.7-2.3-2.3L1.93 5.2l3.44 3.44L12.2 1.78z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="message-input" onSubmit={sendMessage}>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Ketik pesan WhatsApp..."
                autoFocus
              />
              <button type="submit" className="send-btn" disabled={!inputText.trim()}>
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </form>
          </div>
        ) : (
          <div className="welcome-screen">
            <div className="welcome-icon" style={{ opacity: 0.6 }}>
              <svg viewBox="0 0 39 39" width="80" height="80">
                <path fill="#00E676" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.6 5.9 6-1.5z"/>
                <path fill="#fff" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9z"/>
              </svg>
            </div>
            <h2>WhatsApp Web</h2>
            <p>Terhubung sebagai {waUser?.name || 'WhatsApp User'}</p>
            <p className="welcome-hint">Pilih chat dari sidebar untuk mulai berbicara</p>
          </div>
        )}
      </div>
    </div>
  )
}
