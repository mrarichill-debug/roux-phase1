/**
 * useUnsavedChanges — intercepts navigation when a form has pending changes.
 * Uses React Router's useBlocker to catch route transitions.
 *
 * Usage:
 *   const { isDirty, markDirty, markClean, blocker } = useUnsavedChanges()
 *   // Call markDirty() when user starts entering data
 *   // Call markClean() before programmatic navigation after save
 *   // Render <UnsavedChangesSheet blocker={blocker} ... /> in JSX
 */
import { useState, useCallback } from 'react'
import { useBlocker } from 'react-router-dom'

export default function useUnsavedChanges() {
  const [isDirty, setIsDirty] = useState(false)

  const markDirty = useCallback(() => setIsDirty(true), [])
  const markClean = useCallback(() => setIsDirty(false), [])

  const blocker = useBlocker(isDirty)

  return { isDirty, markDirty, markClean, blocker }
}
