/**
 * EventsPage.jsx — Traditions & events placeholder.
 */
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { color, alpha, elevation } from '../styles/tokens'

export default function EventsPage() {
  return (
    <div style={{
      background: color.paper, minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      fontFamily: "'Jost', sans-serif", fontWeight: 300,
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar />

      <div style={{ padding: '60px 30px', textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: '16px', fontStyle: 'italic',
          color: color.inkSoft, lineHeight: 1.7,
        }}>
          Traditions, seasonal events, and family occasions — coming soon.
        </div>
      </div>

      <BottomNav activeTab="events" />
    </div>
  )
}
