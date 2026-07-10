import React, { useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'

export default function ChatArea({
  activeConv, messages, user, onSend, onTyping,
  getContactStatus, typingUsers, onEditMessage, onDeleteMessage
}) {
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const otherUser = activeConv?.otherUser
  const isOnline = otherUser ? getContactStatus(otherUser.id) : false
  const isTyping = typingUsers?.[activeConv?.id]

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="avatar">{otherUser?.avatar || '?'}</div>
        <div className="chat-header-info">
          <div className="chat-header-name">{otherUser?.name || 'Unknown'}</div>
          <div className="chat-header-status">
            {isTyping ? 'mengetik...' : isOnline ? 'Online' : 'Offline'}
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
            onEdit={(msgId, text) => onEditMessage(activeConv.id, msgId, text)}
            onDelete={(msgId) => onDeleteMessage(activeConv.id, msgId)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        onSend={(text, type, extra) => onSend(text, type, extra)}
        onTyping={onTyping}
        conversationId={activeConv?.id}
      />
    </div>
  )
}
