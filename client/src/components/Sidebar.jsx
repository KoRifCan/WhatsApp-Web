import React, { useState } from 'react'

export default function Sidebar({
  user, contacts, conversations, activeConv,
  onSelectConversation, onStartConversation,
  getContactStatus, onLogout,
  waConnected, waConnecting, waQR, waContacts,
  waActiveJid, onStartWA, onSelectWAChat, onLogoutWA,
}) {
  const [search, setSearch] = useState('')
  const [showContacts, setShowContacts] = useState(false)
  const [showWA, setShowWA] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const filteredConvs = conversations.filter(c =>
    c.otherUser?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredWA = waContacts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.jid?.toLowerCase().includes(search.toLowerCase())
  )

  const handleWAClick = () => {
    if (!waConnected) {
      setShowQR(true)
      onStartWA()
    } else {
      setShowWA(!showWA)
    }
  }

  const hasWAorClone = filteredConvs.length > 0 || (waConnected && filteredWA.length > 0)

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="current-user">
          <div className="avatar">{user.avatar}</div>
          <span>{user.name}</span>
        </div>
        <div className="header-actions">
          <button
            onClick={handleWAClick}
            title={waConnected ? 'WhatsApp Terhubung' : 'Hubungkan WhatsApp'}
            className={waConnected ? 'wa-active' : ''}
          >
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </button>
          <button onClick={() => setShowContacts(!showContacts)} title="Kontak baru">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
          <button onClick={onLogout} title="Logout">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="search-bar">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.207 5.184 5.184 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.006zm-4.808 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z"/>
        </svg>
        <input
          type="text"
          placeholder="Cari percakapan"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {showContacts && (
        <div className="contacts-list">
          <div className="contacts-header">
            <h3>Kontak Tersedia</h3>
            <button onClick={() => setShowContacts(false)}>Tutup</button>
          </div>
          {filteredContacts.map(c => (
            <div
              key={c.id}
              className="contact-item"
              onClick={() => { onStartConversation(c); setShowContacts(false) }}
            >
              <div className="avatar">{c.avatar}</div>
              <div className="contact-info">
                <div className="contact-name">{c.name}</div>
                <div className="contact-phone">{c.phone}</div>
              </div>
              <span className={`status-dot ${getContactStatus(c.id) ? 'online' : ''}`} />
            </div>
          ))}
          {filteredContacts.length === 0 && (
            <div className="no-contacts">Tidak ada kontak lain</div>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="qr-modal-overlay" onClick={() => { setShowQR(false); setWaQR(null) }}>
          <div className="qr-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h3>Hubungkan WhatsApp</h3>
              <button onClick={() => { setShowQR(false); setWaQR(null) }}>Tutup</button>
            </div>
            <div className="qr-content">
              {waQR ? (
                <>
                  <img src={waQR} alt="QR Code WhatsApp" className="qr-image" />
                  <p className="qr-hint">Scan kode QR ini dengan WhatsApp di ponsel Anda</p>
                  <p className="qr-subhint">Buka WhatsApp > Titik tiga > Perangkat tertaut > Hubungkan perangkat</p>
                </>
              ) : waConnecting ? (
                <div className="qr-loading">
                  <div className="spinner" />
                  <p>Menghubungkan...</p>
                </div>
              ) : (
                <p>Gagal terhubung. Coba lagi.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="conversations-list">
        {/* WhatsApp Contacts Section */}
        {waConnected && filteredWA.length > 0 && (
          <>
            <div className="section-header">
              <span className="section-label">WhatsApp</span>
              <button className="wa-logout-btn" onClick={onLogoutWA} title="Putuskan WhatsApp">Logout WA</button>
            </div>
            {filteredWA.map(c => (
              <div
                key={c.jid}
                className={`conversation-item ${waActiveJid === c.jid ? 'active' : ''}`}
                onClick={() => onSelectWAChat(c.jid)}
              >
                <div className="avatar wa-avatar">WA</div>
                <div className="conv-info">
                  <div className="conv-name">{c.name || c.jid}</div>
                  <div className="conv-last-msg">WhatsApp</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* WA Connection Status */}
        {!waConnected && waConnecting && (
          <div className="wa-connecting">
            <div className="spinner small" />
            <span>Menghubungkan WhatsApp...</span>
          </div>
        )}

        {/* Clone Conversations Section */}
        {filteredConvs.length > 0 && (
          <>
            {waConnected && filteredWA.length > 0 && (
              <div className="section-header">
                <span className="section-label">Clone Chat</span>
              </div>
            )}
            {filteredConvs.map(conv => {
              const isOnline = conv.otherUser ? getContactStatus(conv.otherUser.id) : false
              return (
                <div
                  key={conv.id}
                  className={`conversation-item ${activeConv?.id === conv.id ? 'active' : ''}`}
                  onClick={() => onSelectConversation(conv)}
                >
                  <div className="avatar">{conv.otherUser?.avatar || '?'}</div>
                  <div className="conv-info">
                    <div className="conv-name">{conv.otherUser?.name || 'Unknown'}</div>
                    {conv.lastMessage && (
                      <div className="conv-last-msg">
                        {conv.lastMessage.senderId === user.id ? 'Anda: ' : ''}
                        {conv.lastMessage.text}
                      </div>
                    )}
                  </div>
                  <span className={`status-dot ${isOnline ? 'online' : ''}`} />
                </div>
              )
            })}
          </>
        )}

        {!hasWAorClone && (
          <div className="no-conversations">
            <p>Belum ada percakapan</p>
            <p className="hint">Klik + untuk chat dengan pengguna clone, atau icon WhatsApp untuk chat WA asli</p>
          </div>
        )}
      </div>
    </div>
  )
}
