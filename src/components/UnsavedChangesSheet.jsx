/**
 * UnsavedChangesSheet — warm confirmation bottom sheet for unsaved changes.
 * Rendered alongside useUnsavedChanges hook.
 *
 * Props:
 *   blocker — from useUnsavedChanges().blocker
 *   title — e.g. "Step away from the stove?"
 *   message — e.g. "You found a recipe — want to save it first?"
 *   stayLabel — e.g. "Keep cooking" (default)
 *   leaveLabel — e.g. "Leave anyway" (default)
 */

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0',
}

export default function UnsavedChangesSheet({
  blocker,
  title = 'Unsaved changes',
  message = "You have unsaved work on this page.",
  stayLabel = 'Keep cooking',
  leaveLabel = 'Leave anyway',
}) {
  if (!blocker || blocker.state !== 'blocked') return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => blocker.reset()}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(44,36,23,0.45)', zIndex: 200,
        }}
      />

      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '430px',
          background: 'white', borderRadius: '20px 20px 0 0',
          padding: '0 0 env(safe-area-inset-bottom, 24px)',
          zIndex: 201,
          boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
          animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Handle */}
        <div style={{
          width: '36px', height: '4px', borderRadius: '2px',
          background: 'rgba(200,185,160,0.6)', margin: '12px auto 0',
        }} />

        <div style={{ padding: '20px 22px 24px' }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '20px', fontWeight: 500, color: C.ink,
            marginBottom: '8px',
          }}>
            {title}
          </div>

          <div style={{
            fontSize: '14px', color: C.driftwood, fontWeight: 300,
            lineHeight: 1.6, marginBottom: '24px',
            fontFamily: "'Jost', sans-serif",
          }}>
            {message}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Stay — primary */}
            <button
              onClick={() => blocker.reset()}
              style={{
                width: '100%', padding: '15px', borderRadius: '14px',
                background: C.forest, color: 'white', border: 'none',
                cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                fontSize: '15px', fontWeight: 500,
                boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
              }}
            >
              {stayLabel}
            </button>

            {/* Leave — secondary */}
            <button
              onClick={() => blocker.proceed()}
              style={{
                width: '100%', padding: '15px', borderRadius: '14px',
                background: 'transparent', color: C.driftwood, border: 'none',
                cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                fontSize: '14px', fontWeight: 300,
              }}
            >
              {leaveLabel}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sheetRise {
          from { transform: translateX(-50%) translateY(100%); }
          to   { transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  )
}
