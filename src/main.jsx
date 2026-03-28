import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#333', padding: 20, fontFamily: 'Georgia, serif' }}>
          <div style={{ maxWidth: 540, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>😵‍💫</div>
            <div style={{ fontSize: 20, marginBottom: 12 }}>Ocurrió un error al cargar la app</div>
            <div style={{ fontSize: 14, color: '#666' }}>{this.state.error.message || 'Error desconocido'}</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const rootEl = document.getElementById('root')
if (rootEl) rootEl.textContent = 'Iniciando app...'

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
