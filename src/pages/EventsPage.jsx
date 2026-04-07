/**
 * EventsPage.jsx — Traditions & events placeholder.
 */
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = { cream: '#FAF7F2', ink: '#2C2417', driftwood: '#8C7B6B' }

export default function EventsPage() {
  return (
    <div style={{
      background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      fontFamily: "'Jost', sans-serif", fontWeight: 300,
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar />

      <div style={{
        position: 'sticky', top: '66px', zIndex: 10,
        background: C.cream, boxShadow: '0 1px 0 #E4DDD2',
        padding: '12px 18px 10px',
      }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink }}>
          Our Traditions.
        </div>
      </div>

      <div style={{ padding: '60px 30px', textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: '16px', fontStyle: 'italic',
          color: C.driftwood, lineHeight: 1.7,
        }}>
          Traditions, seasonal events, and family occasions — coming soon.
        </div>
      </div>

      <BottomNav activeTab="events" />
    </div>
  )
}
