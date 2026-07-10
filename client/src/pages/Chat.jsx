import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../App'
import { getSocket } from '../socket'
import Sidebar from '../components/Sidebar'
import ChatArea from '../components/ChatArea'
import WelcomeScreen from '../components/WelcomeScreen'

export default function Chat() {
  const { user, token, logout } = useAuth()
  const [contacts, setContacts] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [onlineUsers, setOnlineUsers] = useState({})
  const [typingUsers, setTypingUsers] = useState({})

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setContacts(await res.json())
    } catch {}
  }, [token])

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setConversations(await res.json())
    } catch {}
  }, [token])

  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return
    try {
      const res = await fetch(`/api/messages/${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setMessages(await res.json())
    } catch {}
  }, [token])

  useEffect(() => {
    fetchContacts()
    fetchConversations()
  }, [fetchContacts, fetchConversations])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    socket.on('user:status', ({ userId, online }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: online }))
    })

    socket.on('conversation:created', (conv) => {
      setConversations(prev => {
        if (prev.find(c => c.id === conv.id)) return prev
        return [conv, ...prev]
      })
    })

    socket.on('conversation:updated', (conv) => {
      setConversations(prev => {
        const filtered = prev.filter(c => c.id !== conv.id)
        return [conv, ...filtered]
      })
    })

    socket.on('message:new', ({ conversationId, message }) => {
      if (activeConv?.id === conversationId) {
        setMessages(prev => [...prev, message])
        socket.emit('message:read', { conversationId })
      }
    })

    socket.on('message:status', ({ conversationId, messageId, status }) => {
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, status } : m))
      )
    })

    socket.on('messages:read', ({ conversationId }) => {
      setMessages(prev =>
        prev.map(m =>
          m.senderId !== user.id && m.status !== 'read' ? { ...m, status: 'read' } : m
        )
      )
    })

    socket.on('message:edited', ({ conversationId, messageId, text }) => {
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, text, edited: true } : m))
      )
    })

    socket.on('message:deleted', ({ conversationId, messageId }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId
            ? { ...m, deleted: true, text: 'Pesan ini telah dihapus' }
            : m
        )
      )
    })

    socket.on('typing:status', ({ conversationId, typing }) => {
      setTypingUsers(prev => ({ ...prev, [conversationId]: typing }))
    })

    return () => {
      socket.off('user:status')
      socket.off('conversation:created')
      socket.off('conversation:updated')
      socket.off('message:new')
      socket.off('message:status')
      socket.off('messages:read')
      socket.off('message:edited')
      socket.off('message:deleted')
      socket.off('typing:status')
    }
  }, [activeConv, user.id])

  useEffect(() => {
    const socket = getSocket()
    if (socket && activeConv) {
      socket.emit('message:read', { conversationId: activeConv.id })
    }
  }, [activeConv])

  const startConversation = (targetUser) => {
    const existing = conversations.find(
      c => c.participants?.includes(targetUser.id) && c.participants?.includes(user.id)
    )
    if (existing) {
      setActiveConv(existing)
      fetchMessages(existing.id)
      return
    }
    const socket = getSocket()
    socket.emit('conversation:start', { targetUserId: targetUser.id })
    socket.once('conversation:created', (conv) => {
      const convWithUser = { ...conv, otherUser: targetUser }
      setActiveConv(convWithUser)
      fetchMessages(conv.id)
    })
  }

  const selectConversation = (conv) => {
    setActiveConv(conv)
    fetchMessages(conv.id)
  }

  const sendMessage = (text, type = 'text', extra = {}) => {
    if (!activeConv || (!text.trim() && type === 'text')) return
    const socket = getSocket()
    socket.emit('message:send', {
      conversationId: activeConv.id,
      text: type === 'text' ? text.trim() : extra.fileName || '',
      type,
      fileUrl: type !== 'text' ? text : undefined,
      fileName: extra.fileName,
      fileType: extra.fileType,
    })
  }

  const handleTyping = (conversationId, isTyping) => {
    const socket = getSocket()
    if (!socket) return
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId })
  }

  const editMessage = (conversationId, messageId, text) => {
    const socket = getSocket()
    socket.emit('message:edit', { conversationId, messageId, text })
  }

  const deleteMessage = (conversationId, messageId) => {
    const socket = getSocket()
    socket.emit('message:delete', { conversationId, messageId })
  }

  const getContactStatus = (contactId) => onlineUsers[contactId] ?? false

  return (
    <div className="chat-page">
      <div className="chat-container">
        <Sidebar
          user={user}
          contacts={contacts}
          conversations={conversations}
          activeConv={activeConv}
          onSelectConversation={selectConversation}
          onStartConversation={startConversation}
          getContactStatus={getContactStatus}
          onLogout={logout}
        />
        {activeConv ? (
          <ChatArea
            activeConv={activeConv}
            messages={messages}
            user={user}
            onSend={sendMessage}
            onTyping={handleTyping}
            getContactStatus={getContactStatus}
            typingUsers={typingUsers}
            onEditMessage={editMessage}
            onDeleteMessage={deleteMessage}
          />
        ) : (
          <WelcomeScreen user={user} />
        )}
      </div>
    </div>
  )
}
