import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[Roux] Root error:', error, info) }
  render() {
    if (this.state.error) return (
      <div style={{ padding: '40px', fontFamily: 'monospace', color: '#A03030' }}>
        <h2>App crashed</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{this.state.error.message}</pre>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '10px', color: '#888', marginTop: '12px' }}>{this.state.error.stack}</pre>
      </div>
    )
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
