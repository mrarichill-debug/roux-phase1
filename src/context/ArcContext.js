import { createContext, useContext } from 'react'
import { color } from '../styles/tokens'

export const ArcContext = createContext({ stage: 1, color: color.forest })

export function useArc() {
  return useContext(ArcContext)
}
