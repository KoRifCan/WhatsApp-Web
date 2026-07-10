import React, { useState } from 'react'

export default function Sidebar({
  user, contacts, conversations, activeConv,
  onSelectConversation, onStartConversation,
  getContactStatus, onLogout
}) {
  const [search, setSearch] = useState('')
  const [showContacts, setShowContacts] = useState(false)

  const filteredConvs = conversations.filter(c =>
    c.otherUser?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="current-user">
          <div className="avatar">{user.avatar}</div>
          <span>{user.name}</span>
        </div>
        <div className="header-actions">
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
          placeholder="Cari percakapan atau kontak"
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
            <div className="no-contacts">Tidak ada kontak</div>
          )}
        </div>
      )}

      <div className="conversations-list">
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
        {filteredConvs.length === 0 && (
          <div className="no-conversations">
            <p>Belum ada percakapan</p>
            <p className="hint">Klik + untuk memulai chat baru</p>
          </div>
        )}
      </div>
    </div>
  )
}
