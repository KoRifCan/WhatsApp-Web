import React, { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import config from '../config'
import { t, getLang, setLang } from '../langs'
import countries from '../countries'

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
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function formatPairCode(code) {
  const c = (code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const mid = Math.ceil(c.length / 2)
  return c.slice(0, mid) + '-' + c.slice(mid)
}

function getInitialTheme() {
  try { return localStorage.getItem('wa_theme') || 'light' } catch { return 'light' }
}

countries.sort((a, b) => (a.priority || 99) - (b.priority || 99))

const WA_ICON = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="#25D366">
    <path d="M12.004 2c-5.517 0-9.996 4.479-9.996 9.995 0 1.764.459 3.419 1.258 4.861l-1.262 4.609 4.716-1.237c1.401.763 3.001 1.199 4.704 1.199 5.518 0 9.996-4.479 9.996-9.995S17.522 2 12.004 2zM6.836 16.929l-.273-.434c-.742-1.181-1.134-2.545-1.134-3.957 0-4.108 3.342-7.45 7.451-7.45 4.109 0 7.451 3.342 7.451 7.45s-3.342 7.451-7.451 7.451c-1.353 0-2.68-.363-3.839-1.05l-.454-.27-2.846.746.746-2.723z"/>
  </svg>
)

const LOCK_ICON = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="#667781">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
  </svg>
)

function StepNum({ num }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 20, maxWidth: 20, height: 20, borderRadius: '50%',
      border: '1px solid #8696A0', color: '#667781', fontSize: 11, fontWeight: 500,
      marginRight: 12, marginTop: 2, flexShrink: 0,
    }}>
      {num}
    </span>
  )
}

export default function WhatsAppChat() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [lang, setLangState] = useState(getLang)
  const [connected, setConnected] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [waUser, setWaUser] = useState(null)
  const [contacts, setContacts] = useState([])
  const [messages, setMessages] = useState({})
  const [activeJid, setActiveJid] = useState(null)
  const [inputText, setInputText] = useState('')
  const [search, setSearch] = useState('')
  const [loginMode, setLoginMode] = useState('qr')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pairingCode, setPairingCode] = useState(null)
  const [pairLoading, setPairLoading] = useState(false)
  const [pairError, setPairError] = useState('')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [selectedCountry, setSelectedCountry] = useState(countries[0])
  const [mobileView, setMobileView] = useState('list')
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('wa_theme', next) } catch {}
      return next
    })
  }, [])

  const switchLang = useCallback(() => {
    const next = lang === 'id' ? 'en' : 'id'
    setLang(next)
    setLangState(next)
  }, [lang])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('wa:status', (status) => {
      if (status.connected) setConnected(true)
    })

    socket.on('wa:qr', (qrDataUrl) => {
      if (loginMode === 'qr') setQrCode(qrDataUrl)
    })

    socket.on('wa:ready', ({ user }) => {
      setConnected(true)
      setQrCode(null)
      setPairingCode(null)
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

    socket.on('wa:pair:code', ({ code }) => {
      setPairingCode(code)
      setPairLoading(false)
    })

    socket.on('wa:error', ({ error }) => {
      setPairError(error)
      setPairLoading(false)
    })

    socket.on('wa:loggedOut', () => {
      setConnected(false)
      setQrCode(null)
      setWaUser(null)
      setContacts([])
      setMessages({})
      setActiveJid(null)
      setPairingCode(null)
      setLoginMode('qr')
    })

    socket.emit('wa:start')
    return () => socket.close()
  }, [loginMode])

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

  const handlePair = (e) => {
    e.preventDefault()
    const dial = selectedCountry.dial.replace('+', '')
    const full = dial + phoneNumber.replace(/[^0-9]/g, '')
    if (!full) return
    setPairLoading(true)
    setPairError('')
    setPairingCode(null)
    socketRef.current.emit('wa:pair', { phoneNumber: full })
  }

  const switchToQR = () => {
    setLoginMode('qr')
    setPairingCode(null)
    setPairError('')
    setPhoneNumber('')
    setQrCode(null)
    socketRef.current.emit('wa:start')
  }

  const handleChatSelect = (jid) => {
    setActiveJid(jid)
    if (window.innerWidth < 768) setMobileView('chat')
  }

  const handleBack = () => {
    setActiveJid(null)
    if (window.innerWidth < 768) setMobileView('list')
  }

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.dial.includes(countrySearch) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  )

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

  // ================== SHARED FOOTER ==================
  const Footer = () => (
    <footer style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
      <p style={{ color: '#667781', fontSize: 13 }}>
        Tidak punya akun WhatsApp? <a href="#" style={{ color: '#008069', fontWeight: 500, textDecoration: 'none' }}>Mulai ↗</a>
      </p>
      <p style={{ color: '#667781', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: 0.85 }}>
        {LOCK_ICON}
        Pesan pribadi Anda terenkripsi secara end-to-end
      </p>
      <a href="#" style={{ color: '#667781', fontSize: 11, textDecoration: 'none', opacity: 0.7 }}>Ketentuan & Kebijakan Privasi</a>
    </footer>
  )

  // ================== SHARED HEADER ==================
  const AppHeader = ({ showLang = true }) => (
    <header style={{ width: '100%', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {WA_ICON}
        <span style={{ color: '#25D366', fontWeight: 600, fontSize: 18, letterSpacing: '0.5px' }}>WhatsApp</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {showLang && (
          <button onClick={switchLang} style={{
            background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)',
            color: '#25D366', cursor: 'pointer', fontSize: 11, fontWeight: 700,
            padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px',
          }}>
            {lang === 'id' ? 'EN' : 'ID'}
          </button>
        )}
        <button onClick={toggleTheme} style={{
          background: 'none', border: 'none', color: '#667781', cursor: 'pointer',
          padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5c.34 0 .68.02 1.01.07C10.9 2.6 8.7 4.07 7.2 6.14 5.7 8.23 5 10.74 5 13.5c0 5.52 4.48 10 10 10 2.76 0 5.27-.7 7.36-2.2 2.07-1.5 3.54-3.7 4.07-5.81-.05.33-.07.67-.07 1.01 0 4.14-3.36 7.5-7.5 7.5S12 21.14 12 17c0-4.14 3.36-7.5 7.5-7.5.34 0 .68.02 1.01.07C19.4 3.9 16.3 2 12 2z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
            </svg>
          )}
        </button>
      </div>
    </header>
  )

  // ================== SCREEN: QR CODE (Screen 3) ==================
  if (!connected && qrCode && loginMode === 'qr') {
    return (
      <div className="wa-auth" style={{ background: 'var(--auth-bg)' }}>
        <AppHeader />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="wa-auth-card wa-auth-card-row">
            <div className="wa-auth-left">
              <h2 className="wa-auth-title">Pindai untuk login</h2>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li className="wa-step-item">
                  <StepNum num={1} />
                  <span>Pindai kode QR dengan kamera telepon Anda</span>
                </li>
                <li className="wa-step-item">
                  <StepNum num={2} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    Ketuk tautan untuk membuka <strong>WhatsApp</strong>
                    <span style={{ background: '#25D366', color: '#fff', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.454L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.019-5.111-2.875-6.968-1.857-1.857-4.335-2.875-6.972-2.875-5.437 0-9.862 4.42-9.866 9.86-.001 1.716.463 3.391 1.341 4.877l-.986 3.605 3.693-.969z"/></svg>
                    </span>
                  </span>
                </li>
                <li className="wa-step-item">
                  <StepNum num={3} />
                  <span>Pindai kode QR lagi untuk menautkan ke akun Anda</span>
                </li>
              </ol>
              <a href="#" style={{ color: '#008069', fontSize: 12.5, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', marginTop: 16 }}>
                Perlu bantuan? <span style={{ fontSize: 10, marginLeft: 4 }}>↗</span>
              </a>
              <div className="wa-keep-login">
                <span className="wa-check-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </span>
                <span style={{ color: '#3B4A54', fontSize: 12.5 }}>Tetap masuk di browser ini</span>
                <span className="wa-info-icon">i</span>
              </div>
            </div>
            <div className="wa-auth-right">
              <div className="wa-qr-wrap">
                <img src={qrCode} alt="QR Code" />
                <div className="wa-qr-center-icon">{WA_ICON}</div>
              </div>
              <button className="wa-link-btn" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center' }} onClick={() => setLoginMode('phone')}>
                Login dengan nomor telepon
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ================== SCREEN: PHONE INPUT (Screen 1) ==================
  if (!connected && loginMode === 'phone' && !pairingCode) {
    return (
      <div className="wa-auth" style={{ background: 'var(--auth-bg)' }}>
        <AppHeader />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="wa-auth-card">
            <h2 className="wa-auth-title">Masukkan nomor telepon</h2>
            <p className="wa-auth-desc">Pilih negara lalu masukkan nomor telepon Anda.</p>

            <div className="wa-phone-field-group">
              <div className="wa-country-trigger" onClick={() => setShowCountryPicker(!showCountryPicker)}>
                <span style={{ fontSize: 16 }}>🇮🇩</span>
                <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>{selectedCountry.name}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#667781', marginLeft: 'auto' }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </div>

              {showCountryPicker && (
                <div className="wa-country-dropdown">
                  <div className="wa-country-search">
                    <input type="text" value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Cari negara..." autoFocus />
                  </div>
                  <div className="wa-country-list">
                    {filteredCountries.map((c) => (
                      <div key={c.code} className={`wa-country-item ${selectedCountry.code === c.code ? 'active' : ''}`} onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); setCountrySearch('') }}>
                        <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.dial}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="wa-phone-input-wrap">
                <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 400, paddingRight: 12, borderRight: '1px solid #e9edef', marginRight: 12 }}>{selectedCountry.dial}</span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Nomor telepon"
                  autoFocus
                  disabled={pairLoading}
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 14 }}
                />
              </div>
            </div>

            {pairError && <div className="wa-pair-error">{pairError}</div>}

            <button className="wa-auth-btn" onClick={handlePair} disabled={pairLoading || !phoneNumber.trim()}>
              {pairLoading ? 'Memproses...' : 'Berikutnya'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button className="wa-link-btn" onClick={switchToQR} style={{ display: 'inline-flex', alignItems: 'center' }}>
                Login dengan kode QR
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ================== SCREEN: AUTH CODE (Screen 2) ==================
  if (!connected && loginMode === 'phone' && pairingCode) {
    const formatted = formatPairCode(pairingCode)
    const parts = formatted.split('-')
    const left = parts[0]?.split('') || []
    const right = parts[1]?.split('') || []

    return (
      <div className="wa-auth" style={{ background: 'var(--auth-bg)' }}>
        <AppHeader />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="wa-auth-card">
            <h2 className="wa-auth-title">Masukkan kode di telepon</h2>
            <p style={{ color: '#667781', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Menautkan akun WhatsApp <strong style={{ color: 'var(--text-primary)' }}>{selectedCountry.dial} {phoneNumber}</strong> (<button className="wa-link-btn" onClick={switchToQR} style={{ fontSize: 14 }}>edit</button>)
            </p>

            <div className="wa-code-grid">
              {left.map((ch, i) => (
                <span key={`l${i}`} className="wa-code-box">{ch}</span>
              ))}
              <span style={{ color: '#667781', fontWeight: 700, fontSize: 16, padding: '0 2px' }}>-</span>
              {right.map((ch, i) => (
                <span key={`r${i}`} className="wa-code-box">{ch}</span>
              ))}
            </div>

            <ol style={{ listStyle: 'none', padding: 0, margin: '24px 0 32px' }}>
              <li className="wa-step-item" style={{ marginBottom: 12 }}>
                <StepNum num={1} />
                <div>Buka <strong>WhatsApp</strong> <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#25D366', verticalAlign: 'middle', margin: '0 2px' }}></span> di telepon</div>
              </li>
              <li className="wa-step-item" style={{ marginBottom: 12 }}>
                <StepNum num={2} />
                <div>Di Android ketuk <strong>Menu</strong> <strong>⋮</strong> · Di iPhone ketuk <strong>Pengaturan</strong> ⚙️</div>
              </li>
              <li className="wa-step-item" style={{ marginBottom: 12 }}>
                <StepNum num={3} />
                <div>Ketuk <strong>Perangkat tertaut</strong>, lalu <strong>Tautkan perangkat</strong></div>
              </li>
              <li className="wa-step-item">
                <StepNum num={4} />
                <div>Ketuk <strong>Tautkan dengan nomor telepon saja</strong>, lalu masukkan kode ini di telepon Anda</div>
              </li>
            </ol>

            <div style={{ textAlign: 'center', borderTop: '1px solid #f0f2f5', paddingTop: 20 }}>
              <button className="wa-link-btn" onClick={switchToQR} style={{ display: 'inline-flex', alignItems: 'center' }}>
                Login dengan kode QR
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ================== LOADING ==================
  if (!connected) {
    return (
      <div className="wa-auth" style={{ background: 'var(--auth-bg)' }}>
        <AppHeader showLang={false} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, color: '#667781', fontSize: 14 }}>
          <div className="spinner" />
          <p>Menghubungkan...</p>
        </div>
      </div>
    )
  }

  // ================== CHAT INTERFACE ==================
  const showBack = window.innerWidth < 768 && mobileView === 'chat'

  return (
    <div className="wa-app">
      <div className={`wa-sidebar ${mobileView === 'chat' ? 'hide-mobile' : ''}`}>
        <div className="wa-sidebar-header">
          <div className="wa-avatar" style={{ background: getColor(waUser?.name) }}>
            {(waUser?.name || '?')[0].toUpperCase()}
          </div>
          <div className="wa-sidebar-actions">
            <button onClick={switchLang} title={lang === 'id' ? 'English' : 'Indonesian'}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{lang === 'id' ? 'EN' : 'ID'}</span>
            </button>
            <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5c.34 0 .68.02 1.01.07C10.9 2.6 8.7 4.07 7.2 6.14 5.7 8.23 5 10.74 5 13.5c0 5.52 4.48 10 10 10 2.76 0 5.27-.7 7.36-2.2 2.07-1.5 3.54-3.7 4.07-5.81-.05.33-.07.67-.07 1.01 0 4.14-3.36 7.5-7.5 7.5S12 21.14 12 17c0-4.14 3.36-7.5 7.5-7.5.34 0 .68.02 1.01.07C19.4 3.9 16.3 2 12 2z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
                </svg>
              )}
            </button>
            <button onClick={() => {
              if (window.confirm('Putuskan sambungan WhatsApp?')) {
                fetch(SOCKET_URL + '/api/wa/logout', { method: 'POST' })
              }
            }} title="Putuskan sambungan">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 4-4 1.41 1.41L10.83 12H16v2h-5.17l2.58 2.59L11 17z"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="wa-search">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.207 5.184 5.184 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.006zm-4.808 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z"/>
          </svg>
          <input type="text" placeholder="Cari atau mulai chat baru" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="wa-chat-list">
          {filteredContacts.map((c) => {
            const cMsgs = messages[c.jid] || []
            const lastMsg = cMsgs.length > 0 ? cMsgs[cMsgs.length - 1] : null
            const color = getColor(c.name)
            return (
              <div key={c.jid} className={`wa-chat-item ${activeJid === c.jid ? 'active' : ''}`} onClick={() => handleChatSelect(c.jid)}>
                <div className="wa-avatar" style={{ background: color, width: 49, height: 49, fontSize: 19 }}>
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div className="wa-chat-info">
                  <div className="wa-chat-name">{c.name || c.jid}</div>
                  {lastMsg && (
                    <div className="wa-chat-preview">
                      {lastMsg.fromMe && <span style={{ color: 'var(--text-secondary)' }}>Anda: </span>}
                      {lastMsg.text}
                    </div>
                  )}
                </div>
                {lastMsg && <div className="wa-chat-time">{formatTime(lastMsg.timestamp)}</div>}
              </div>
            )
          })}
          {filteredContacts.length === 0 && <div className="wa-empty">Tidak ada chat</div>}
        </div>
      </div>

      <div className={`wa-main ${!activeJid && window.innerWidth < 768 ? 'hide-mobile' : ''} ${showBack ? 'show-mobile' : ''}`}>
        {activeJid ? (
          <>
            <div className="wa-main-header">
              {showBack && (
                <button className="wa-back-btn" onClick={handleBack}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
                </button>
              )}
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
                <input ref={inputRef} type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Ketik pesan" autoFocus />
                <button type="submit" className="wa-send" disabled={!inputText.trim()}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="wa-nochat">
            <div className="wa-nochat-icon">
              <svg viewBox="0 0 303 172" width="240" height="136">
                <rect x="15" y="30" width="110" height="120" rx="8" fill={theme === 'dark' ? '#1f2c33' : '#e9edef'} stroke={theme === 'dark' ? '#2a3942' : '#d0d5db'} strokeWidth="2"/>
                <circle cx="70" cy="60" r="18" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
                <rect x="35" y="90" width="70" height="6" rx="3" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
                <rect x="40" y="102" width="60" height="6" rx="3" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
                <rect x="35" y="115" width="50" height="6" rx="3" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
                <path d="M155 55h120M155 70h100M155 85h110" stroke={theme === 'dark' ? '#2a3942' : '#d0d5db'} strokeWidth="6" strokeLinecap="round"/>
                <path d="M155 110h95M155 125h80" stroke={theme === 'dark' ? '#2a3942' : '#d0d5db'} strokeWidth="6" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="wa-nochat-title">WhatsApp Web</h2>
            <p className="wa-nochat-subtitle">Kirim dan terima pesan tanpa perlu membuka ponsel.</p>
            <p className="wa-nochat-hint">Pilih chat dari sidebar untuk mulai berbicara</p>
          </div>
        )}
      </div>
    </div>
  )
}
