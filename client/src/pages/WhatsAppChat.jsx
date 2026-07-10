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

function getFlagEmoji(code) {
  if (!code) return ''
  const cps = code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...cps)
}

function getInitialTheme() {
  try { return localStorage.getItem('wa_theme') || 'light' } catch { return 'light' }
}

function getInitialLang() {
  try { const s = localStorage.getItem('wa_lang'); return s || 'id' } catch { return 'id' }
}

countries.sort((a, b) => (a.priority || 99) - (b.priority || 99))

const WA_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--green-icon)">
    <path d="M12.004 2c-5.517 0-9.996 4.479-9.996 9.995 0 1.764.459 3.419 1.258 4.861l-1.262 4.609 4.716-1.237c1.401.763 3.001 1.199 4.704 1.199 5.518 0 9.996-4.479 9.996-9.995S17.522 2 12.004 2zM6.836 16.929l-.273-.434c-.742-1.181-1.134-2.545-1.134-3.957 0-4.108 3.342-7.45 7.451-7.45 4.109 0 7.451 3.342 7.451 7.45s-3.342 7.451-7.451 7.451c-1.353 0-2.68-.363-3.839-1.05l-.454-.27-2.846.746.746-2.723z"/>
  </svg>
)

const WA_BADGE = (
  <span style={{ display: 'inline-flex', background: 'var(--green-icon)', color: '#fff', borderRadius: 4, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.454L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.019-5.111-2.875-6.968-1.857-1.857-4.335-2.875-6.972-2.875-5.437 0-9.862 4.42-9.866 9.86-.001 1.716.463 3.391 1.341 4.877l-.986 3.605 3.693-.969z"/></svg>
  </span>
)

const LOCK_ICON = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="var(--text-secondary)">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
  </svg>
)

const CHEVRON = (color = 'var(--green-dark)') => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5l7 7-7 7"/>
  </svg>
)

const CHEVRON_DOWN = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 9l-7 7-7-7"/>
  </svg>
)

function StepBadge({ num }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 20, maxWidth: 20, height: 20, borderRadius: '50%',
      border: '1px solid var(--text-tertiary)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500,
      marginRight: 12, marginTop: 2, flexShrink: 0,
    }}>
      {num}
    </span>
  )
}

function Header({ showLang = true, lang, onLang, onTheme, theme }) {
  return (
    <div style={{ width: '100%', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {WA_ICON}
        <span style={{ color: 'var(--green-icon)', fontWeight: 600, fontSize: 17, letterSpacing: '0.3px' }}>WhatsApp</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {showLang && (
          <button onClick={onLang} style={{
            background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)',
            color: 'var(--green-icon)', cursor: 'pointer', fontSize: 11, fontWeight: 700,
            padding: '3px 8px', borderRadius: 4,
          }}>
            {lang === 'id' ? 'EN' : 'ID'}
          </button>
        )}
        <button onClick={onTheme} style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
          padding: 6, borderRadius: '50%', display: 'flex',
        }}>
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', flexShrink: 0 }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        {t('footer.noaccount')}{' '}
        <a href="#" style={{ color: 'var(--green-dark)', fontWeight: 500, textDecoration: 'none' }}>{t('footer.start')} ↗</a>
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.85 }}>
        {LOCK_ICON}
        {t('encryption')}
      </p>
      <a href="#" style={{ color: 'var(--text-secondary)', fontSize: 11, textDecoration: 'none', opacity: 0.7 }}>{t('footer.terms')}</a>
    </div>
  )
}

export default function WhatsAppChat() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [lang, setLangState] = useState(getInitialLang)
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
  const loginModeRef = useRef(loginMode)
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

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

  useEffect(() => { loginModeRef.current = loginMode }, [loginMode])

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket
    socket.on('wa:status', (s) => { if (s.connected) setConnected(true) })
    socket.on('wa:qr', (d) => { if (loginModeRef.current === 'qr') setQrCode(d) })
    socket.on('wa:ready', ({ user }) => { setConnected(true); setQrCode(null); setPairingCode(null); setWaUser(user) })
    socket.on('wa:contacts', setContacts)
    socket.on('wa:message', ({ from, message }) => {
      setMessages(p => ({ ...p, [from]: [...(p[from] || []), message] }))
    })
    socket.on('wa:sent', ({ jid, text }) => {
      setMessages(p => ({ ...p, [jid]: [...(p[jid] || []), { id: Date.now().toString(), fromMe: true, text, type: 'text', timestamp: new Date().toISOString() }] }))
    })
    socket.on('wa:pair:code', ({ code }) => { setPairingCode(code); setPairLoading(false) })
    socket.on('wa:error', ({ error }) => { setPairError(error); setPairLoading(false) })
    socket.on('wa:loggedOut', () => {
      setConnected(false); setQrCode(null); setWaUser(null); setContacts([])
      setMessages({}); setActiveJid(null); setPairingCode(null); setLoginMode('qr')
    })
    socket.emit('wa:start')
    return () => { socket.close() }
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, activeJid])
  useEffect(() => { if (activeJid && inputRef.current) inputRef.current.focus() }, [activeJid])

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
    setPairLoading(true); setPairError(''); setPairingCode(null)
    socketRef.current.emit('wa:pair', { phoneNumber: full })
  }

  const switchToQR = () => {
    setLoginMode('qr'); setPairingCode(null); setPairError('')
    setPhoneNumber('')
    socketRef.current?.emit('wa:start')
  }

  const handleChatSelect = (jid) => { setActiveJid(jid); if (window.innerWidth < 768) setMobileView('chat') }
  const handleBack = () => { setActiveJid(null); if (window.innerWidth < 768) setMobileView('list') }

  const filteredCountries = countries.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.dial.includes(countrySearch) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  )

  const filteredContacts = contacts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    const aMsg = messages[a.jid]; const bMsg = messages[b.jid]
    const aTime = aMsg?.length ? new Date(aMsg[aMsg.length - 1].timestamp).getTime() : 0
    const bTime = bMsg?.length ? new Date(bMsg[bMsg.length - 1].timestamp).getTime() : 0
    return bTime - aTime
  })

  const activeMsgs = activeJid ? messages[activeJid] || [] : []
  const activeContact = contacts.find(c => c.jid === activeJid)
  const activeColor = getColor(activeContact?.name)

  // ===== SCREEN 3: QR Code Login =====
  if (!connected && qrCode && loginMode === 'qr') {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--auth-bg)' }}>
        <Header showLang lang={lang} onLang={switchLang} onTheme={toggleTheme} theme={theme} />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{
            width: '100%', maxWidth: 640, background: 'var(--card-bg)', borderRadius: 24,
            border: '1px solid var(--card-border)', boxShadow: '0 2px 5px rgba(11,20,26,0.05)',
            padding: '32px 28px', display: 'flex', gap: 28,
            flexDirection: window.innerWidth < 768 ? 'column' : 'row',
            alignItems: window.innerWidth < 768 ? 'center' : 'flex-start',
          }}>
            {/* LEFT COLUMN */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
              <h2 style={{ fontSize: 20, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 20, letterSpacing: '-0.2px' }}>
                {t('qr.scan.title')}
              </h2>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
                  <StepBadge num={1} />
                  <span>{t('qr.step1.text')}</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
                  <StepBadge num={2} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {t('qr.step2.text')} <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>WhatsApp</strong> {WA_BADGE}
                  </span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
                  <StepBadge num={3} />
                  <span>{t('qr.step3.text')}</span>
                </li>
              </ol>
              <a href="https://faq.whatsapp.com/1317564962315842/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-dark)', fontSize: 12.5, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', marginBottom: 20 }}>
                {t('qr.help')} <span style={{ fontSize: 10, marginLeft: 3 }}>↗</span>
              </a>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12,
                borderTop: '1px solid var(--card-border)', marginTop: 'auto',
              }}>
                <span style={{
                  width: 16, height: 16, background: 'var(--green-accent)', borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{t('qr.keep')}</span>
                <span style={{
                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10,
                  border: '1px solid var(--text-tertiary)', borderRadius: '50%', width: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif',
                }}>i</span>
              </div>
            </div>
            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              <div style={{
                position: 'relative', padding: 12, background: 'var(--card-bg)',
                border: '1px solid var(--card-border)', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                width: 170, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img src={qrCode} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.9 }} />
                <div style={{
                  position: 'absolute', width: 36, height: 36, background: 'var(--card-bg)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)', border: '1px solid var(--card-border)',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-primary)">
                    <path d="M12.004 2c-5.517 0-9.996 4.479-9.996 9.995 0 1.764.459 3.419 1.258 4.861l-1.262 4.609 4.716-1.237c1.401.763 3.001 1.199 4.704 1.199 5.518 0 9.996-4.479 9.996-9.995S17.522 2 12.004 2zM6.836 16.929l-.273-.434c-.742-1.181-1.134-2.545-1.134-3.957 0-4.108 3.342-7.45 7.451-7.45 4.109 0 7.451 3.342 7.451 7.45s-3.342 7.451-7.451 7.451c-1.353 0-2.68-.363-3.839-1.05l-.454-.27-2.846.746.746-2.723z"/>
                  </svg>
                </div>
              </div>
              <button onClick={() => setLoginMode('phone')} style={{
                background: 'none', border: 'none', color: 'var(--green-dark)', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', padding: 0,
              }}>
                {t('qr.link.phone')} {CHEVRON()}
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ===== SCREEN 1: Phone Number Input =====
  if (!connected && loginMode === 'phone' && !pairingCode) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--auth-bg)' }}>
        <Header showLang lang={lang} onLang={switchLang} onTheme={toggleTheme} theme={theme} />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{
            width: '100%', maxWidth: 440, background: 'var(--card-bg)', borderRadius: 24,
            border: '1px solid var(--card-border)', boxShadow: '0 2px 5px rgba(11,20,26,0.05)',
            padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 400, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8, letterSpacing: '-0.3px' }}>
              {t('phone.title.short')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 1.5 }}>
              {t('phone.desc.short')}
            </p>

            {/* Country Selector */}
            <div onClick={() => setShowCountryPicker(!showCountryPicker)} style={{
              width: '100%', height: 50, background: 'transparent',
              border: '1px solid var(--card-border)', borderRadius: 9999,
              padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)', marginBottom: 16,
              transition: 'border-color 0.2s',
            }}>
              <span style={{ fontSize: 16 }}>{getFlagEmoji(selectedCountry.code)}</span>
              <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>{selectedCountry.name}</span>
              <div style={{ marginLeft: 'auto', display: 'flex' }}>{CHEVRON_DOWN}</div>
            </div>

            {showCountryPicker && (
              <div style={{ width: '100%', position: 'relative', zIndex: 100, marginBottom: 16 }}>
                <div style={{ padding: '8px 0' }}>
                  <input type="text" value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                    placeholder={t('country.search')}
                    style={{
                      width: '100%', padding: '8px 16px', border: '1px solid var(--card-border)',
                      borderRadius: 9999, background: 'var(--card-bg)', color: 'var(--text-primary)',
                      fontSize: 13, outline: 'none',
                    }}
                    autoFocus
                  />
                </div>
                <div style={{
                  maxHeight: 200, overflowY: 'auto', background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)', borderRadius: 12,
                  marginTop: 4, position: 'absolute', left: 0, right: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                  {filteredCountries.map(c => (
                    <div key={c.code} onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); setCountrySearch('') }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 16px', cursor: 'pointer', fontSize: 14,
                        background: selectedCountry.code === c.code ? 'var(--wa-active)' : 'transparent',
                        color: 'var(--text-primary)', transition: 'background 0.1s',
                      }}
                    >
                      <span>{c.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.dial}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phone Input */}
            <div style={{
              width: '100%', height: 50, background: 'transparent',
              border: '1px solid var(--card-border)', borderRadius: 9999,
              padding: '0 20px', display: 'flex', alignItems: 'center',
              marginBottom: pairError ? 12 : 32, transition: 'border-color 0.2s',
            }}
              className="phone-input-focus"
            >
              <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 400, paddingRight: 12, borderRight: '1px solid var(--card-border)', marginRight: 12 }}>
                {selectedCountry.dial}
              </span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={t('phone.label')}
                autoFocus
                disabled={pairLoading}
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  color: 'var(--text-primary)', fontSize: 14,
                }}
              />
            </div>

            {pairError && <div style={{
              background: 'rgba(239, 83, 80, 0.12)', color: '#ef5350',
              padding: '10px 16px', borderRadius: 12, fontSize: 13,
              marginBottom: 16, width: '100%', textAlign: 'center',
            }}>{pairError}</div>}

            <button onClick={handlePair} disabled={pairLoading || !phoneNumber.trim()} style={{
              width: '100%', height: 40, background: pairLoading || !phoneNumber.trim() ? 'rgba(0,168,132,0.6)' : 'var(--green-accent)',
              color: '#fff', border: 'none', borderRadius: 9999,
              fontSize: 14, fontWeight: 500, cursor: pairLoading || !phoneNumber.trim() ? 'not-allowed' : 'pointer',
            }}>
              {pairLoading ? t('phone.loading') : t('phone.submit.label')}
            </button>

            <button onClick={switchToQR} style={{
              background: 'none', border: 'none', color: 'var(--green-dark)', cursor: 'pointer',
              fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center',
              marginTop: 24, padding: 0,
            }}>
              {t('phone.link.qr')} {CHEVRON()}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ===== SCREEN 2: Verification Code =====
  if (!connected && loginMode === 'phone' && pairingCode) {
    const formatted = formatPairCode(pairingCode)
    const parts = formatted.split('-')
    const left = parts[0]?.split('') || []
    const right = parts[1]?.split('') || []

    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--auth-bg)' }}>
        <Header showLang lang={lang} onLang={switchLang} onTheme={toggleTheme} theme={theme} />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{
            width: '100%', maxWidth: 440, background: 'var(--card-bg)', borderRadius: 24,
            border: '1px solid var(--card-border)', boxShadow: '0 2px 5px rgba(11,20,26,0.05)',
            padding: '28px 32px', display: 'flex', flexDirection: 'column',
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.3px' }}>
              {t('code.title.short')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              {t('code.linking')} <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedCountry.dial} {phoneNumber}</strong> (<button onClick={switchToQR} style={{ background: 'none', border: 'none', color: 'var(--green-dark)', cursor: 'pointer', fontSize: 14, padding: 0 }}>{t('code.edit')}</button>)
            </p>

            {/* Code boxes */}
            <div style={{
              width: '100%', background: 'var(--wa-secondary)', borderRadius: 12,
              padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 24,
            }}>
              {left.map((ch, i) => (
                <span key={`l${i}`} style={{
                  width: 36, height: 44, background: 'var(--card-bg)', borderRadius: 6,
                  border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}>{ch}</span>
              ))}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 16, padding: '0 2px' }}>-</span>
              {right.map((ch, i) => (
                <span key={`r${i}`} style={{
                  width: 36, height: 44, background: 'var(--card-bg)', borderRadius: 6,
                  border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}>{ch}</span>
              ))}
            </div>

            {/* Steps */}
            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 32px' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                <StepBadge num={1} />
                <span>{t('code.step1')} <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>WhatsApp</strong>{' '}
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--green-icon)', verticalAlign: 'middle', margin: '0 2px' }}></span>
                  {' '}{t('code.step1.end')}
                </span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                <StepBadge num={2} />
                <span>{t('code.step2')} <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('menu')}</strong> <strong style={{ color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '-0.5px' }}>⋮</strong> {t('code.step2.sep')} <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('settings')}</strong> ⚙️</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                <StepBadge num={3} />
                <span>{t('code.step3')} <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('code.step3.link')}</strong>, {t('code.step3.sep')} <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('code.step3.link2')}</strong></span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <StepBadge num={4} />
                <span>{t('code.step4')} <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('code.step4.link')}</strong>, {t('code.step4.sep')}</span>
              </li>
            </ol>

            <div style={{ textAlign: 'center', borderTop: '1px solid var(--card-border)', paddingTop: 20 }}>
              <button onClick={switchToQR} style={{
                background: 'none', border: 'none', color: 'var(--green-dark)', cursor: 'pointer',
                fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', padding: 0,
              }}>
                {t('code.link.qr')} {CHEVRON()}
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ===== LOADING =====
  if (!connected) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--auth-bg)' }}>
        <Header showLang={false} lang={lang} onLang={switchLang} onTheme={toggleTheme} theme={theme} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, color: 'var(--text-secondary)', fontSize: 14 }}>
          <div className="spinner" />
          <p>{t('loading')}</p>
        </main>
        <Footer />
      </div>
    )
  }

  // ===== CHAT INTERFACE =====
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
            <button onClick={toggleTheme} title={theme === 'dark' ? t('theme.toggle.light') : t('theme.toggle.dark')}>
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            <button onClick={() => { if (window.confirm(t('logout.confirm'))) fetch(SOCKET_URL + '/api/wa/logout', { method: 'POST' }) }} title={t('logout.title')}>
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
          <input type="text" placeholder={t('search.placeholder')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="wa-chat-list">
          {filteredContacts.map(c => {
            const cMsgs = messages[c.jid] || []
            const lastMsg = cMsgs.length > 0 ? cMsgs[cMsgs.length - 1] : null
            return (
              <div key={c.jid} className={`wa-chat-item ${activeJid === c.jid ? 'active' : ''}`} onClick={() => handleChatSelect(c.jid)}>
                <div className="wa-avatar" style={{ background: getColor(c.name), width: 49, height: 49, fontSize: 19 }}>
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div className="wa-chat-info">
                  <div className="wa-chat-name">{c.name || c.jid}</div>
                  {lastMsg && <div className="wa-chat-preview">{lastMsg.fromMe && t('msg.you') + ': '}{lastMsg.text}</div>}
                </div>
                {lastMsg && <div className="wa-chat-time">{formatTime(lastMsg.timestamp)}</div>}
              </div>
            )
          })}
          {filteredContacts.length === 0 && <div className="wa-empty">{t('no.chat')}</div>}
        </div>
      </div>

      <div className={`wa-main ${!activeJid && window.innerWidth < 768 ? 'hide-mobile' : ''} ${showBack ? 'show-mobile' : ''}`}>
        {activeJid ? (
          <>
            <div className="wa-main-header">
              {showBack && (
                <button className="wa-back-btn" onClick={handleBack}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                </button>
              )}
              <div className="wa-avatar" style={{ background: activeColor, width: 40, height: 40, fontSize: 16 }}>
                {(activeContact?.name || '?')[0].toUpperCase()}
              </div>
              <div className="wa-main-header-info">
                <div className="wa-main-header-name">{activeContact?.name || activeJid}</div>
                <div className="wa-main-header-status">{t('chat.status')}</div>
              </div>
            </div>
            <div className="wa-messages">
              {activeMsgs.map(msg => (
                <div key={msg.id} className={`wa-msg ${msg.fromMe ? 'sent' : 'received'}`}>
                  <div className="wa-msg-bubble">
                    <div className="wa-msg-text">{msg.text}</div>
                    <div className="wa-msg-meta">
                      <span>{formatTime(msg.timestamp)}</span>
                      {msg.fromMe && <svg viewBox="0 0 16 11" width="14" height="10" className="wa-check"><path fill="currentColor" d="M11.07.65l-5.7 5.7-2.3-2.3L1.93 5.2l3.44 3.44L12.2 1.78z"/></svg>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="wa-input-area">
              <form onSubmit={sendMessage}>
                <input ref={inputRef} type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder={t('msg.input')} autoFocus />
                <button type="submit" className="wa-send" disabled={!inputText.trim()}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
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
            <h2 className="wa-nochat-title">{t('nochat.title')}</h2>
            <p className="wa-nochat-subtitle">{t('nochat.subtitle')}</p>
            <p className="wa-nochat-hint">{t('nochat.hint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
