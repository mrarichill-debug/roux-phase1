/**
 * WatermarkLayer.jsx — Fixed-position decorative SVG watermarks.
 * Seasonal configs from decorSets.js, SVG objects from decorObjects.js.
 * Accepts optional `season` prop to override auto-detection.
 */

import { useEffect, useRef } from 'react'
import { OBJ } from '../data/decorObjects'
import { SEASONS, SLOT_POS, RATE, getCurrentSeason } from '../data/decorSets'

export default function WatermarkLayer({ season: seasonProp }) {
  const layerRef = useRef(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    const s = seasonProp || getCurrentSeason()
    const objects = SEASONS[s]
    if (!objects) return

    const placed = []

    objects.forEach(({ slot, key, scale, opacity, delay }) => {
      const fn = OBJ[key]
      if (!fn) return
      const pos = SLOT_POS[slot]
      if (!pos) return

      const el = document.createElement('div')
      el.style.position = 'absolute'
      el.style.pointerEvents = 'none'
      el.style.opacity = '0'
      el.style.color = 'rgba(60,42,22,1)'
      el.style.willChange = 'transform, opacity'
      Object.assign(el.style, pos)
      el.innerHTML = fn(scale)
      layer.appendChild(el)
      placed.push({ el, slot })

      setTimeout(() => {
        el.style.transition = 'opacity 1.4s ease'
        el.style.opacity = String(opacity)
      }, delay)
    })

    let tick = false
    function onScroll() {
      if (!tick) {
        requestAnimationFrame(() => {
          const sy = window.scrollY
          placed.forEach(({ el, slot }) => {
            const rate = RATE[slot] || 0.15
            el.style.transform = `translateY(${-(sy * rate).toFixed(2)}px)`
          })
          tick = false
        })
        tick = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      placed.forEach(({ el }) => el.remove())
    }
  }, [seasonProp])

  return (
    <div
      ref={layerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    />
  )
}
