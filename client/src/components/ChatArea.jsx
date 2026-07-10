import React, { useRef, useEffect, useState } from 'react'
import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'

export default function ChatArea({ activeConv, messages, user, onSend, getContactStatus }) {
  const messagesEndRef = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const otherUser = activeConv?.otherUser
  const isOnline = otherUser ? getContactStatus(otherUser.id) : false

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="avatar">{otherUser?.avatar || '?'}</div>
        <div className="chat-header-info">
          <div className="chat-header-name">{otherUser?.name || 'Unknown'}</div>
          <div className="chat-header-status">
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === user.id}
            showAvatar={i === 0 || messages[i - 1]?.senderId !== msg.senderId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={onSend} />
    </div>
  )
}
