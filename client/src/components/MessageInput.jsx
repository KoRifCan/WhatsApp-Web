import React, { useState, useRef, useCallback } from 'react'

export default function MessageInput({ onSend, onTyping, conversationId }) {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const typingTimeout = useRef(null)
  const fileInputRef = useRef(null)

  const emitTyping = useCallback((isTyping) => {
    if (onTyping && conversationId) {
      onTyping(conversationId, isTyping)
    }
  }, [onTyping, conversationId])

  const handleChange = (e) => {
    setText(e.target.value)
    emitTyping(true)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => emitTyping(false), 1500)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    emitTyping(false)
    onSend(text.trim(), 'text')
    setText('')
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('wa_token')}` },
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        const type = data.isImage ? 'image' : 'file'
        onSend(data.url, type, { fileName: data.name, fileType: data.type })
      }
    } catch {}
    setUploading(false)
    e.target.value = ''
  }

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <button type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M1.816 11.258L10.327.986a3.597 3.597 0 0 1 5.356-.112 3.968 3.968 0 0 1 .112 5.456l-8.715 9.96a1.989 1.989 0 0 1-2.798.164 2.123 2.123 0 0 1-.163-2.986l7.913-9.045a.693.693 0 0 1 1.037-.062.737.737 0 0 1 .061 1.008l-7.154 8.174a.608.608 0 0 0 .086.902.562.562 0 0 0 .788-.087l8.716-9.96a2.343 2.343 0 0 0-.066-3.22 2.125 2.125 0 0 0-3.156.066L2.91 11.968a3.967 3.967 0 0 0 .656 5.614 3.542 3.542 0 0 0 4.876-.613l8.512-9.73a.661.661 0 0 1 .99-.07.706.706 0 0 1 .07 1.008l-8.512 9.73a4.862 4.862 0 0 1-6.688.841 5.445 5.445 0 0 1-.899-7.701z"/>
        </svg>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        accept="image/*,.pdf,.doc,.docx,.txt"
      />
      <input
        type="text"
        value={text}
        onChange={handleChange}
        placeholder={uploading ? 'Mengupload...' : 'Ketik pesan...'}
        autoFocus
        disabled={uploading}
      />
      <button type="submit" className="send-btn" disabled={!text.trim() || uploading}>
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </form>
  )
}
