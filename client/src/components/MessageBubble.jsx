import React, { useState } from 'react'

export default function MessageBubble({ message, isOwn, showAvatar, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.text)
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (message.deleted) {
    return (
      <div className={`message-row ${isOwn ? 'own' : 'other'} deleted`}>
        <div className="message-bubble deleted">
          <div className="message-text">
            <em>Pesan ini telah dihapus</em>
          </div>
        </div>
      </div>
    )
  }

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.text) {
      onEdit(message.id, editText.trim())
    }
    setEditing(false)
  }

  const handleEditKey = (e) => {
    if (e.key === 'Enter') handleSaveEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  const statusIcon = () => {
    if (!isOwn) return null
    switch (message.status) {
      case 'read':
        return (
          <svg viewBox="0 0 16 11" width="16" height="11" className="msg-status read">
            <path fill="currentColor" d="M11.07.65l-5.7 5.7-2.3-2.3L1.93 5.2l3.44 3.44L12.2 1.78z" />
          </svg>
        )
      case 'delivered':
        return (
          <svg viewBox="0 0 16 11" width="16" height="11" className="msg-status delivered">
            <path fill="currentColor" d="M11.07.65l-5.7 5.7-2.3-2.3L1.93 5.2l3.44 3.44L12.2 1.78z" />
          </svg>
        )
      default:
        return (
          <svg viewBox="0 0 12 11" width="12" height="11" className="msg-status sent">
            <path fill="currentColor" d="M11.07.65l-5.7 5.7-2.3-2.3L1.93 5.2l3.44 3.44L12.2 1.78z" />
          </svg>
        )
    }
  }

  return (
    <div className={`message-row ${isOwn ? 'own' : 'other'}`}>
      {!isOwn && showAvatar && (
        <div className="msg-avatar">
          <div className="avatar small">{message.senderId?.charAt(0)?.toUpperCase() || '?'}</div>
        </div>
      )}
      <div
        className="message-bubble"
        onMouseEnter={(e) => {
          if (isOwn) e.currentTarget.querySelector('.msg-actions')?.classList.add('visible')
        }}
        onMouseLeave={(e) => {
          if (isOwn) e.currentTarget.querySelector('.msg-actions')?.classList.remove('visible')
        }}
      >
        {message.type === 'image' && message.fileUrl && (
          <div className="message-image">
            <img src={message.fileUrl} alt="Gambar" loading="lazy" />
          </div>
        )}

        {message.type === 'file' && message.fileUrl && (
          <div className="message-file">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
            </svg>
            <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="file-link">
              {message.fileName || 'File'}
            </a>
          </div>
        )}

        {editing ? (
          <div className="edit-input">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKey}
              autoFocus
            />
            <div className="edit-actions">
              <button onClick={() => setEditing(false)}>Batal</button>
              <button onClick={handleSaveEdit}>Simpan</button>
            </div>
          </div>
        ) : (
          <>
            <div className="message-text">{message.text}</div>
            {isOwn && (
              <div className="msg-actions">
                <button onClick={() => { setEditText(message.text); setEditing(true) }} title="Edit">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </button>
                <button onClick={() => onDelete(message.id)} title="Hapus">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            )}
          </>
        )}

        <div className="message-meta">
          {message.edited && <span className="edited-label">diedit</span>}
          <span className="message-time">{time}</span>
          {statusIcon()}
        </div>
      </div>
    </div>
  )
}
