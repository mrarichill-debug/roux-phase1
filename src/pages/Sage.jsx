/**
 * Sage.jsx — Placeholder screen for Sage AI assistant tab.
 */
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', sage: '#7A8C6E', cream: '#FAF7F2',
  ink: '#2C2417', driftwood: '#8C7B6B',
}

export default function Sage({ appUser }) {
  return (
    <div style={{
      background: C.cream, minHeight: '100vh', maxWidth: '430px',
      margin: '0 auto', fontFamily: "'Jost', sans-serif",
    }}>
      <TopBar />

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: '0 40px', minHeight: 'calc(100vh - 160px)',
      }}>
        {/* Roux wordmark */}
        <div style={{
          fontFamily: "'Slabo 27px', Georgia, serif", fontSize: '36px',
          fontWeight: 400, color: C.forest, letterSpacing: '-0.5px',
          marginBottom: '24px',
        }}>
          Roux.
        </div>

        {/* Sage sparkle icon */}
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(61,107,79,0.08)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        </div>

        {/* Coming soon text */}
        <div style={{
          fontSize: '15px', color: C.driftwood, fontWeight: 300,
          fontStyle: 'italic', lineHeight: 1.6, maxWidth: '240px',
        }}>
          Sage is coming soon — your kitchen intelligence.
        </div>
      </div>

      <BottomNav activeTab="sage" />
    </div>
  )
}
