/**
 * SaveRecipe.jsx — Save / import a recipe placeholder.
 * Full build: Sage chat-style import (natural language input).
 * See docs/BUILD-FLAGS.md — "Build recipe import with Sage"
 */

import { useNavigate } from 'react-router-dom'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417', driftwood: '#8C7B6B', linen: '#E8E0D0',
}

export default function SaveRecipe() {
  const navigate = useNavigate()

  return (
    <div style={{
      background: C.cream, minHeight: '100vh', maxWidth: '430px',
      margin: '0 auto', fontFamily: "'Jost', sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Back bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '14px 20px', background: C.forest,
        boxShadow: '0 2px 0px rgba(20,40,25,0.55), 0 4px 8px rgba(20,40,25,0.40)',
      }}>
        <button
          onClick={() => navigate('/meals/recipes')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(250,247,242,0.85)', padding: '4px',
            display: 'flex', alignItems: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '20px', fontWeight: 500,
          color: 'rgba(250,247,242,0.95)',
        }}>
          Save a Recipe
        </span>
      </header>

      {/* Placeholder body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', color: C.ink, marginBottom: '12px' }}>
          Save a Recipe
        </div>
        <div style={{ fontSize: '13px', color: C.driftwood, lineHeight: 1.6 }}>
          Sage import coming soon.<br />
          Paste a URL, describe a dish, or type out a family recipe.
        </div>
      </div>
    </div>
  )
}
