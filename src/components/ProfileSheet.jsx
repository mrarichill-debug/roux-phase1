/**
 * ProfileSheet.jsx — Minimal profile bottom sheet.
 * Opens when the avatar button is tapped in the topbar.
 * Provides Sign Out + a greyed-out Settings placeholder.
 */

import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  forest:    '#3D6B4F',
  forestDk:  '#2E5038',
  ink:       '#2C2417',
  driftwood: '#8C7B6B',
  linen:     '#E8E0D0',
  cream:     '#FAF7F2',
}

export default function ProfileSheet({ appUser, open, onClose }) {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    // App.jsx onAuthStateChange will set session to null → routes to welcome
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(20,20,20,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: '50%',
          transform: open
            ? 'translateX(-50%) translateY(0)'
            : 'translateX(-50%) translateY(100%)',
          width: '100%', maxWidth: '430px',
          background: 'white',
          borderRadius: '20px 20px 0 0',
          zIndex: 201,
          transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: '36px', height: '4px', borderRadius: '2px',
          background: C.linen,
          margin: '12px auto 0',
        }} />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '16px', right: '18px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.driftwood, padding: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <line x1="4" y1="4" x2="14" y2="14" />
            <line x1="14" y1="4" x2="4"  y2="14" />
          </svg>
        </button>

        {/* User info */}
        <div style={{
          padding: '20px 24px 18px',
          borderBottom: `1px solid ${C.linen}`,
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '50%',
            background: C.forest,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
            fontFamily: "'Playfair Display', serif",
            fontSize: '18px', fontWeight: 600,
            marginBottom: '12px',
          }}>
            {appUser?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '18px', fontWeight: 600,
            color: C.ink, lineHeight: 1.2,
          }}>
            {appUser?.name ?? ''}
          </div>
          <div style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: '13px', color: C.driftwood,
            marginTop: '3px',
          }}>
            {appUser?.email ?? ''}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '10px 16px 24px' }}>

          {/* Settings — greyed out, not yet built */}
          <button
            disabled
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 12px', borderRadius: '12px',
              background: 'none', border: 'none', cursor: 'not-allowed',
              textAlign: 'left',
            }}
          >
            <span style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#F0EDE8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B0A898" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </span>
            <div>
              <div style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: '15px', fontWeight: 500, color: '#B0A898',
              }}>
                Settings
              </div>
              <div style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: '11px', color: '#C8C0B4', marginTop: '1px',
              }}>
                Coming soon
              </div>
            </div>
          </button>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 12px', borderRadius: '12px',
              background: 'none', border: 'none',
              cursor: signingOut ? 'default' : 'pointer',
              textAlign: 'left',
              opacity: signingOut ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <span style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(61,107,79,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            <div style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: '15px', fontWeight: 500, color: C.forest,
            }}>
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
