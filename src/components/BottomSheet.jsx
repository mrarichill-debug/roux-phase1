/**
 * BottomSheet.jsx — Shared bottom sheet with keyboard-aware positioning,
 * body scroll lock, and touch passthrough prevention.
 *
 * Props:
 *   isOpen    — boolean
 *   onClose   — called when backdrop is tapped (pass null/undefined to disable backdrop dismiss)
 *   title     — optional string rendered as Playfair heading
 *   children  — sheet content
 *   zIndex    — optional, default 200 (backdrop) / 201 (sheet)
 *   maxHeight — optional, default '85vh'
 */
import { useEffect, useRef, useCallback } from 'react'
import useKeyboardAware from '../hooks/useKeyboardAware'

const C = {
  cream: '#FAF7F2',
  ink: '#2C2417',
  linen: '#E4DDD2',
  backdrop: 'rgba(44, 36, 23, 0.5)',
}

export default function BottomSheet({ isOpen, onClose, title, children, zIndex = 200, maxHeight = '85vh' }) {
  const { keyboardHeight, isKeyboardOpen } = useKeyboardAware()
  const scrollYRef = useRef(0)
  const backdropRef = useRef(null)
  const sheetRef = useRef(null)

  // ── Body + page scroll lock ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) return

    scrollYRef.current = window.scrollY

    // Lock body (standard approach)
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.top = `-${scrollYRef.current}px`

    // Lock <html> element — catches iOS Safari cases where body fixed alone doesn't hold
    document.documentElement.style.overflow = 'hidden'

    // Lock any inner page scroll containers (ThisWeek, PantryList, etc.)
    const pageContainers = document.querySelectorAll('.page-scroll-container')
    pageContainers.forEach(el => el.style.overflow = 'hidden')

    return () => {
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      document.documentElement.style.overflow = ''
      pageContainers.forEach(el => el.style.overflow = '')
      window.scrollTo(0, scrollYRef.current)
    }
  }, [isOpen])

  // ── Document-level touch scroll blocking ──────────────────────
  // Intercepts ALL touchmove events when sheet is open.
  // Only allows scrolling inside the sheet's own [data-sheet-scroll] area.
  useEffect(() => {
    if (!isOpen) return

    function blockTouchMove(e) {
      // Allow scrolling inside the sheet's scrollable content
      const sheetScroll = sheetRef.current?.querySelector('[data-sheet-scroll]')
      if (sheetScroll && sheetScroll.contains(e.target)) {
        // At scroll boundaries, prevent scroll-chaining to body
        const { scrollTop, scrollHeight, clientHeight } = sheetScroll
        const atTop = scrollTop <= 0
        const atBottom = scrollTop + clientHeight >= scrollHeight
        const isScrollable = scrollHeight > clientHeight

        if (!isScrollable || (atTop && atBottom)) {
          e.preventDefault()
        }
        return
      }
      // Block all other touch scrolling (backdrop, body, page containers)
      e.preventDefault()
    }

    document.addEventListener('touchmove', blockTouchMove, { passive: false })
    return () => document.removeEventListener('touchmove', blockTouchMove)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose || undefined}
        style={{
          position: 'fixed',
          inset: 0,
          background: C.backdrop,
          zIndex,
          WebkitTapHighlightColor: 'transparent',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: isKeyboardOpen ? keyboardHeight : 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '430px',
          background: C.cream,
          borderRadius: '20px 20px 0 0',
          zIndex: zIndex + 1,
          boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
          animation: 'rouxSheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isKeyboardOpen
            ? `calc(${window.visualViewport?.height || window.innerHeight}px - 20px)`
            : maxHeight,
          transition: 'bottom 0.15s ease-out, max-height 0.15s ease-out',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: '40px',
          height: '4px',
          borderRadius: '2px',
          background: C.linen,
          margin: '12px auto 0',
          flexShrink: 0,
        }} />

        {/* Title */}
        {title && (
          <div style={{
            padding: '16px 22px 0',
            fontFamily: "'Playfair Display', serif",
            fontSize: '20px',
            fontWeight: 500,
            color: C.ink,
            flexShrink: 0,
          }}>
            {title}
          </div>
        )}

        {/* Scrollable content area */}
        <div
          data-sheet-scroll
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes rouxSheetRise {
          from { transform: translateX(-50%) translateY(100%); opacity: 0.5; }
          to   { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
