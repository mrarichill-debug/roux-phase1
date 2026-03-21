/**
 * useUnsavedChanges — tracks dirty state for forms with pending changes.
 * Uses beforeunload for browser navigation, local state for in-app navigation.
 * Works with any React Router version (no data router required).
 *
 * Usage:
 *   const dirty = useUnsavedChanges()
 *   // dirty.markDirty() when user starts entering data
 *   // dirty.markClean() before programmatic navigation after save
 *   // dirty.guardNavigation(navigateFn) — call instead of navigate() directly
 *   // dirty.showConfirm / dirty.setShowConfirm — controls the sheet
 *   // dirty.pendingNav — call dirty.pendingNav() to proceed after "Leave anyway"
 */
import { useState, useRef, useCallback, useEffect } from 'react'

export default function useUnsavedChanges() {
  const isDirtyRef = useRef(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const pendingNavRef = useRef(null)

  const markDirty = useCallback(() => {
    isDirtyRef.current = true
    setIsDirty(true)
  }, [])

  const markClean = useCallback(() => {
    isDirtyRef.current = false
    setIsDirty(false)
  }, [])

  // Guard a navigation action — shows sheet if dirty, otherwise navigates
  const guardNavigation = useCallback((navFn) => {
    if (isDirtyRef.current) {
      pendingNavRef.current = navFn
      setShowConfirm(true)
    } else {
      navFn()
    }
  }, [])

  // Called when user taps "Leave anyway"
  const confirmLeave = useCallback(() => {
    isDirtyRef.current = false
    setIsDirty(false)
    setShowConfirm(false)
    if (pendingNavRef.current) {
      pendingNavRef.current()
      pendingNavRef.current = null
    }
  }, [])

  // Called when user taps "Keep cooking" / stay
  const cancelLeave = useCallback(() => {
    setShowConfirm(false)
    pendingNavRef.current = null
  }, [])

  // Browser back/forward + tab close
  useEffect(() => {
    const handler = (e) => {
      if (isDirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  return { isDirty, markDirty, markClean, guardNavigation, showConfirm, confirmLeave, cancelLeave }
}
