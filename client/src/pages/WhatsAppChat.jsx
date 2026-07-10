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
  try { return localStorage.getItem('wa_theme') || 'dark' } catch { return 'dark' }
}

countries.sort((a, b) => (a.priority || 99) - (b.priority || 99))

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

  if (!connected && qrCode && loginMode === 'qr') {
    return (
      <div className="wa-landing">
        <div className="wa-landing-header">
          <svg viewBox="0 0 39 39" width="22" height="22" style={{ marginRight: 8 }}>
            <path fill="#fff" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.6 5.9 6-1.5z"/>
            <path fill="#fff" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9z"/>
          </svg>
          {t('app.name')}
          <button className="wa-lang-btn" onClick={switchLang}>{lang === 'id' ? 'EN' : 'ID'}</button>
        </div>
        <div className="wa-landing-body">
          <div className="wa-landing-left">
            <svg viewBox="0 0 303 172" width="250" height="142">
              <rect x="15" y="30" width="110" height="120" rx="8" fill={theme === 'dark' ? '#1f2c33' : '#e9edef'} stroke={theme === 'dark' ? '#2a3942' : '#d0d5db'} strokeWidth="2"/>
              <circle cx="70" cy="60" r="18" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
              <rect x="35" y="90" width="70" height="6" rx="3" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
              <rect x="40" y="102" width="60" height="6" rx="3" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
              <rect x="35" y="115" width="50" height="6" rx="3" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
              <path d="M155 55h120M155 70h100M155 85h110" stroke={theme === 'dark' ? '#2a3942' : '#d0d5db'} strokeWidth="6" strokeLinecap="round"/>
              <path d="M155 110h95M155 125h80" stroke={theme === 'dark' ? '#2a3942' : '#d0d5db'} strokeWidth="6" strokeLinecap="round"/>
              <rect x="175" y="45" width="18" height="18" rx="4" fill="#00a884"/>
              <path d="M180 50l3 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>{t('app.use.on.computer')}</h2>
            <p className="wa-landing-sub">{t('app.extension')}</p>
          </div>
          <div className="wa-landing-right">
            <div className="wa-qr-box">
              <img src={qrCode} alt="QR Code" />
            </div>
            <div className="wa-qr-steps">
              <div className="wa-step">
                <span className="wa-step-num">1</span>
                <div className="wa-step-text">
                  <strong>{t('qr.step1.title')}</strong>
                  <span className="wa-step-hint">{t('qr.step1.hint')}</span>
                </div>
              </div>
              <div className="wa-step">
                <span className="wa-step-num">2</span>
                <div className="wa-step-text">
                  <strong>{t('qr.step2.title')}</strong>
                  <span className="wa-step-hint">{t('qr.step2.hint')}</span>
                </div>
              </div>
              <div className="wa-step">
                <span className="wa-step-num">3</span>
                <div className="wa-step-text">
                  <strong>{t('qr.step3.title')}</strong>
                  <span className="wa-step-hint">{t('qr.step3.hint')}</span>
                </div>
              </div>
            </div>
            <div className="wa-landing-actions">
              <span>{t('qr.alt.text')}</span>
              <button className="wa-link-btn" onClick={() => setLoginMode('phone')}>{t('qr.alt.link')}</button>
            </div>
          </div>
        </div>
        <div className="wa-landing-footer">
          <svg viewBox="0 0 16 16" width="12" height="12" style={{ marginRight: 4, flexShrink: 0 }}>
            <path fill="currentColor" d="M8 1a4 4 0 014 4c0 1.5-.8 2.8-2 3.5V10h-4V8.5C4.8 7.8 4 6.5 4 5a4 4 0 014-4zM6 11h4v2H6v-2z"/>
          </svg>
          {t('encryption')}
        </div>
      </div>
    )
  }

  if (!connected && loginMode === 'phone') {
    return (
      <div className="wa-landing">
        <div className="wa-landing-header">
          <svg viewBox="0 0 39 39" width="22" height="22" style={{ marginRight: 8 }}>
            <path fill="#fff" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.6 5.9 6-1.5z"/>
            <path fill="#fff" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9z"/>
          </svg>
          {t('app.name')}
          <button className="wa-lang-btn" onClick={switchLang}>{lang === 'id' ? 'EN' : 'ID'}</button>
        </div>
        <div className="wa-landing-body">
          <div className="wa-landing-left">
            <svg viewBox="0 0 303 172" width="250" height="142">
              <rect x="15" y="30" width="110" height="120" rx="8" fill={theme === 'dark' ? '#1f2c33' : '#e9edef'} stroke={theme === 'dark' ? '#2a3942' : '#d0d5db'} strokeWidth="2"/>
              <circle cx="70" cy="60" r="18" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
              <rect x="35" y="90" width="70" height="6" rx="3" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
              <rect x="40" y="102" width="60" height="6" rx="3" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
              <rect x="35" y="115" width="50" height="6" rx="3" fill={theme === 'dark' ? '#2a3942' : '#d0d5db'}/>
              <path d="M155 55h120M155 70h100M155 85h110" stroke={theme === 'dark' ? '#2a3942' : '#d0d5db'} strokeWidth="6" strokeLinecap="round"/>
              <path d="M155 110h95M155 125h80" stroke={theme === 'dark' ? '#2a3942' : '#d0d5db'} strokeWidth="6" strokeLinecap="round"/>
              <rect x="175" y="45" width="18" height="18" rx="4" fill="#00a884"/>
              <path d="M180 50l3 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>{t('app.use.on.computer')}</h2>
            <p className="wa-landing-sub">{t('app.extension')}</p>
          </div>
          <div className="wa-landing-right">
            {!pairingCode ? (
              <div className="wa-phone-box">
                <h3>{t('phone.title')}</h3>
                <p className="wa-phone-desc">{t('phone.desc')}</p>
                <form onSubmit={handlePair} className="wa-phone-form">
                  <div className="wa-phone-input-group">
                    <label>{t('phone.label')}</label>
                    <div className="wa-phone-row">
                      <div className="wa-country-select" onClick={() => setShowCountryPicker(!showCountryPicker)}>
                        <span className="wa-country-flag">{selectedCountry.dial}</span>
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                      </div>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder={t('phone.placeholder')}
                        autoFocus
                        disabled={pairLoading}
                      />
                    </div>
                  </div>
                  {showCountryPicker && (
                    <div className="wa-country-dropdown">
                      <div className="wa-country-search">
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={e => setCountrySearch(e.target.value)}
                          placeholder={t('country.search')}
                          autoFocus
                        />
                      </div>
                      <div className="wa-country-list">
                        {filteredCountries.map((c) => (
                          <div
                            key={c.code}
                            className={`wa-country-item ${selectedCountry.code === c.code ? 'active' : ''}`}
                            onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); setCountrySearch('') }}
                          >
                            <span className="wa-country-name">{c.name}</span>
                            <span className="wa-country-dial">{c.dial}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pairError && <div className="wa-pair-error">{pairError}</div>}
                  <button type="submit" className="wa-pair-btn" disabled={pairLoading || !phoneNumber.trim()}>
                    {pairLoading ? t('phone.loading') : t('phone.submit')}
                  </button>
                </form>
                <div className="wa-phone-alt">
                  <button className="wa-link-btn" onClick={switchToQR}>{t('phone.alt')}</button>
                </div>
              </div>
            ) : (
              <div className="wa-phone-box wa-code-box">
                <h3>{t('code.title')}</h3>
                <div className="wa-pair-code">{formatPairCode(pairingCode)}</div>
                <p className="wa-code-desc" dangerouslySetInnerHTML={{ __html: t('code.desc') }} />
                <div className="wa-code-alt">
                  <button className="wa-link-btn" onClick={switchToQR}>{t('code.alt')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="wa-landing-footer">
          <svg viewBox="0 0 16 16" width="12" height="12" style={{ marginRight: 4, flexShrink: 0 }}>
            <path fill="currentColor" d="M8 1a4 4 0 014 4c0 1.5-.8 2.8-2 3.5V10h-4V8.5C4.8 7.8 4 6.5 4 5a4 4 0 014-4zM6 11h4v2H6v-2z"/>
          </svg>
          {t('encryption')}
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="wa-landing">
        <div className="wa-landing-header">
          <svg viewBox="0 0 39 39" width="22" height="22" style={{ marginRight: 8 }}>
            <path fill="#fff" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.6 5.9 6-1.5z"/>
            <path fill="#fff" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9z"/>
          </svg>
          {t('app.name')}
        </div>
        <div className="wa-loading-body">
          <div className="spinner" />
          <p>{t('loading')}</p>
        </div>
      </div>
    )
  }

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
            <button onClick={toggleTheme} title={theme === 'dark' ? t('theme.toggle.dark') : t('theme.toggle.light')}>
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5c.34 0 .68.02 1.01.07C10.9 2.6 8.7 4.07 7.2 6.14 5.7 8.23 5 10.74 5 13.5c0 5.52 4.48 10 10 10 2.76 0 5.27-.7 7.36-2.2 2.07-1.5 3.54-3.7 4.07-5.81-.05.33-.07.67-.07 1.01 0 4.14-3.36 7.5-7.5 7.5S12 21.14 12 17c0-4.14 3.36-7.5 7.5-7.5.34 0 .68.02 1.01.07C19.4 3.9 16.3 2 12 2z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
                </svg>
              )}
            </button>
            <button onClick={() => {
              if (window.confirm(t('logout.confirm'))) {
                fetch(SOCKET_URL + '/api/wa/logout', { method: 'POST' })
              }
            }} title={t('logout.title')}>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 4-4 1.41 1.41L10.83 12H16v2h-5.17l2.58 2.59L11 17z"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="wa-search">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.207 5.184 5.184 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.006zm-4.808 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z"/>
          </svg>
          <input
            type="text"
            placeholder={t('search.placeholder')}
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
                onClick={() => handleChatSelect(c.jid)}
              >
                <div className="wa-avatar" style={{ background: color, width: 49, height: 49, fontSize: 19 }}>
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div className="wa-chat-info">
                  <div className="wa-chat-name">{c.name || c.jid}</div>
                  {lastMsg && (
                    <div className="wa-chat-preview">
                      {lastMsg.fromMe && <span className="wa-preview-you">{t('msg.you')}: </span>}
                      {lastMsg.text}
                    </div>
                  )}
                </div>
                {lastMsg && <div className="wa-chat-time">{formatTime(lastMsg.timestamp)}</div>}
              </div>
            )
          })}
          {filteredContacts.length === 0 && (
            <div className="wa-empty">{t('no.chat')}</div>
          )}
        </div>
      </div>

      <div className={`wa-main ${!activeJid && window.innerWidth < 768 ? 'hide-mobile' : ''} ${showBack ? 'show-mobile' : ''}`}>
        {activeJid ? (
          <>
            <div className="wa-main-header">
              {showBack && (
                <button className="wa-back-btn" onClick={handleBack}>
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
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
                  placeholder={t('msg.input')}
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
