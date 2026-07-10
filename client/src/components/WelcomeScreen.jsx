import React from 'react'

export default function WelcomeScreen({ user }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-icon">
        <svg viewBox="0 0 303 172" width="240" height="140">
          <path fill="#00a884" d="M229.5 47.5c-2-6-5.5-11.5-10-16-9-9-21-14-34-14-14 0-26 5-35 14l-3 3c-2 2-3 4-5 7-3 4-5 9-7 14-1 3-2 6-2 9 0 5 1 10 3 15 2 5 4 9 7 13l5 7c2 3 5 5 7 7 13 13 31 20 50 20 18 0 35-6 48-17l6-5c4-4 8-9 11-14 4-8 6-17 5-26 0-4-1-8-2-12z"/>
          <circle fill="#fff" cx="206" cy="82" r="12"/>
          <path fill="#f0f0f0" d="M206 70c-4 0-8 1-11 4-1 1-1 2 0 3l10 10c1 1 2 1 3 0 4-4 6-9 6-14 0-2 0-3-1-4-2-2-4-3-7-3z"/>
          <path fill="#00a884" d="M68.5 124.5c-2-6-5.5-11.5-10-16-9-9-21-14-34-14-14 0-26 5-35 14l-3 3c-2 2-3 4-5 7-3 4-5 9-7 14-1 3-2 6-2 9 0 5 1 10 3 15 2 5 4 9 7 13l5 7c2 3 5 5 7 7 13 13 31 20 50 20 18 0 35-6 48-17l6-5c4-4 8-9 11-14 4-8 6-17 5-26 0-4-1-8-2-12z"/>
          <circle fill="#fff" cx="45" cy="159" r="12"/>
          <path fill="#f0f0f0" d="M45 147c-4 0-8 1-11 4-1 1-1 2 0 3l10 10c1 1 2 1 3 0 4-4 6-9 6-14 0-2 0-3-1-4-2-2-4-3-7-3z"/>
          <rect x="130" y="20" width="50" height="50" rx="10" fill="#00a884"/>
          <rect x="135" y="35" width="40" height="4" rx="2" fill="#fff"/>
          <rect x="135" y="45" width="30" height="4" rx="2" fill="#fff"/>
        </svg>
      </div>
      <h2>WhatsApp Web Clone</h2>
      <p>Selamat datang, {user.name}!</p>
      <p className="welcome-hint">Pilih percakapan atau mulai chat baru dari sidebar</p>
    </div>
  )
}
