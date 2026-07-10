import React from 'react'

export default function MessageBubble({ message, isOwn, showAvatar }) {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  })

  const statusIcon = () => {
    if (!isOwn) return null
    switch (message.status) {
      case 'read':
        return (
          <svg viewBox="0 0 16 11" width="16" height="11" className="msg-status read">
            <path fill="currentColor" d="M11.07.65l-5.7 5.7-2.3-2.3L1.93 5.2l3.44 3.44L12.2 1.78z"/>
          </svg>
        )
      case 'delivered':
        return (
          <svg viewBox="0 0 16 11" width="16" height="11" className="msg-status delivered">
            <path fill="currentColor" d="M11.07.65l-5.7 5.7-2.3-2.3L1.93 5.2l3.44 3.44L12.2 1.78z"/>
          </svg>
        )
      default:
        return (
          <svg viewBox="0 0 12 11" width="12" height="11" className="msg-status sent">
            <path fill="currentColor" d="M11.07.65l-5.7 5.7-2.3-2.3L1.93 5.2l3.44 3.44L12.2 1.78z"/>
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
      <div className="message-bubble">
        <div className="message-text">{message.text}</div>
        <div className="message-meta">
          <span className="message-time">{time}</span>
          {statusIcon()}
        </div>
      </div>
    </div>
  )
}
