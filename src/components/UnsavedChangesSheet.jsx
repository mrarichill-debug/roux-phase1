/**
 * UnsavedChangesSheet — warm confirmation bottom sheet for unsaved changes.
 *
 * Props:
 *   open — boolean, whether to show the sheet
 *   onStay — called when user taps "Keep cooking" / stay
 *   onLeave — called when user taps "Leave anyway"
 *   title — e.g. "Step away from the stove?"
 *   message — e.g. "You found a recipe — want to save it first?"
 *   stayLabel — e.g. "Keep cooking"
 *   leaveLabel — e.g. "Leave anyway"
 */
import BottomSheet from './BottomSheet'
import { color, alpha, elevation } from '../styles/tokens'

export default function UnsavedChangesSheet({
  open,
  onStay,
  onLeave,
  title = 'Unsaved changes',
  message = "You have unsaved work on this page.",
  stayLabel = 'Keep cooking',
  leaveLabel = 'Leave anyway',
}) {
  return (
    <BottomSheet isOpen={open} onClose={onStay} title={title}>
      <div style={{ padding: '0 22px 24px' }}>
        <div style={{
          fontSize: '14px', color: color.inkSoft, fontWeight: 300,
          lineHeight: 1.6, marginBottom: '24px',
          fontFamily: "'Jost', sans-serif",
        }}>
          {message}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Stay — primary */}
          <button
            onClick={onStay}
            style={{
              width: '100%', padding: '15px', borderRadius: '14px',
              background: color.forest, color: 'white', border: 'none',
              cursor: 'pointer', fontFamily: "'Jost', sans-serif",
              fontSize: '15px', fontWeight: 500,
              boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
            }}
          >
            {stayLabel}
          </button>

          {/* Leave — secondary */}
          <button
            onClick={onLeave}
            style={{
              width: '100%', padding: '15px', borderRadius: '14px',
              background: 'transparent', color: color.inkSoft, border: 'none',
              cursor: 'pointer', fontFamily: "'Jost', sans-serif",
              fontSize: '14px', fontWeight: 300,
            }}
          >
            {leaveLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
