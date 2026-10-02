import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles/main.css'
import { AuthProvider } from './auth/AuthContext'
import { LanguageProvider } from './i18n/LanguageContext'
import { ToastProvider } from './context/ToastContext'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  </StrictMode>,
)
