import React, { createContext, useContext, useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Chat from './pages/Chat'
import { connectSocket, disconnectSocket, getSocket } from './socket'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('wa_user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('wa_token') || null)
  const navigate = useNavigate()

  useEffect(() => {
    if (token) {
      const socket = connectSocket(token)
      socket.on('connect_error', () => {
        logout()
      })
      return () => {
        socket.off('connect_error')
      }
    }
  }, [token])

  const login = (userData, authToken) => {
    setUser(userData)
    setToken(authToken)
    localStorage.setItem('wa_user', JSON.stringify(userData))
    localStorage.setItem('wa_token', authToken)
    connectSocket(authToken)
  }

  const logout = () => {
    disconnectSocket()
    setUser(null)
    setToken(null)
    localStorage.removeItem('wa_user')
    localStorage.removeItem('wa_token')
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/chat" />} />
      </Routes>
    </AuthProvider>
  )
}

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}
