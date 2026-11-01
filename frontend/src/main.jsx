import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { SocketProvider } from './context/SocketContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <App />
        </SocketProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '14px' } }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
