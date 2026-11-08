import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { SocketProvider } from './context/SocketContext.jsx'
import { TenantProvider } from './context/TenantContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <TenantProvider>
        <LanguageProvider>
          <AuthProvider>
            <SocketProvider>
              <App />
            </SocketProvider>
            <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '14px' } }} />
          </AuthProvider>
        </LanguageProvider>
      </TenantProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Installable app + offline shell (production builds only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
