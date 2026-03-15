import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getScheme } from '../lib/colorSchemes'

/**
 * Reads the household's color_scheme field and returns the full token object.
 * Applies CSS custom properties to :root on mount and when scheme changes.
 * Defaults to 'garden' if no scheme is set.
 *
 * @param {object} appUser — must have household_id
 * @returns {{ scheme: object, schemeName: string, setScheme: (name: string) => Promise<void> }}
 */
export function useColorScheme(appUser) {
  const [schemeName, setSchemeName] = useState('garden')

  // Load the household's color_scheme on mount
  useEffect(() => {
    if (!appUser?.household_id) return
    supabase
      .from('households')
      .select('color_scheme')
      .eq('id', appUser.household_id)
      .single()
      .then(({ data }) => {
        if (data?.color_scheme) setSchemeName(data.color_scheme)
      })
  }, [appUser?.household_id])

  const scheme = getScheme(schemeName)

  // Apply CSS custom properties to :root whenever scheme changes
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--scheme-primary', scheme.primary)
    root.setProperty('--scheme-primary-dark', scheme.primaryDark)
    root.setProperty('--scheme-secondary', scheme.secondary)
    root.setProperty('--scheme-accent', scheme.accent)
    root.setProperty('--scheme-background', scheme.background)
    root.setProperty('--scheme-surface', scheme.surface)
    root.setProperty('--scheme-ink', scheme.ink)
    root.setProperty('--scheme-driftwood', scheme.driftwood)
    root.setProperty('--scheme-linen', scheme.linen)
    root.setProperty('--scheme-topbar-logo', scheme.topbarLogo)
    root.setProperty('--scheme-topbar-logo-accent', scheme.topbarLogoAccent)
  }, [schemeName])

  async function setScheme(name) {
    setSchemeName(name)
    if (appUser?.household_id) {
      await supabase
        .from('households')
        .update({ color_scheme: name })
        .eq('id', appUser.household_id)
    }
  }

  return { scheme, schemeName, setScheme }
}
