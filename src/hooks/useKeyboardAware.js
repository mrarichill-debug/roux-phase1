/**
 * useKeyboardAware.js — Hook that tracks iOS virtual keyboard via visualViewport API.
 * window.innerHeight lies when the keyboard is open; visualViewport.height tells the truth.
 */
import { useState, useEffect } from 'react'

export default function useKeyboardAware() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    // Capture the full viewport height before any keyboard appears
    const fullHeight = window.innerHeight

    function onResize() {
      const currentHeight = vv.height
      const diff = fullHeight - currentHeight
      // Threshold of 100px to distinguish keyboard from minor viewport changes
      const open = diff > 100
      setKeyboardHeight(open ? diff : 0)
      setIsKeyboardOpen(open)
    }

    vv.addEventListener('resize', onResize)
    // Run once on mount in case keyboard is already open
    onResize()

    return () => vv.removeEventListener('resize', onResize)
  }, [])

  return { keyboardHeight, isKeyboardOpen }
}
