import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { API_BASE_URL, refreshSession } from '../services/api'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

// Same origin as the API (the Vite dev server proxies /socket.io to the backend).
const SOCKET_URL = API_BASE_URL.startsWith('http') ? API_BASE_URL.replace(/\/api\/?$/, '') : undefined

/** Opens one live connection while a user is signed in. */
export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    const s = io(SOCKET_URL, { path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] })
    let refreshed = false

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    // The access cookie may have expired: refresh it once, then reconnect.
    s.on('connect_error', async () => {
      if (refreshed) return
      refreshed = true
      try {
        await refreshSession()
        s.connect()
      } catch {
        /* the REST layer will sign the user out */
      }
    })
    // Publishing the new connection object is the point of this effect.
    // eslint-disable-next-line react/set-state-in-effect
    setSocket(s)
    return () => {
      s.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [userId])

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  return useContext(SocketContext) || { socket: null, connected: false }
}

/** Subscribes to a socket event for the lifetime of the component. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSocketEvent(event, handler) {
  const { socket } = useSocket()
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!socket) return
    const fn = (payload) => ref.current(payload)
    socket.on(event, fn)
    return () => socket.off(event, fn)
  }, [socket, event])
}
