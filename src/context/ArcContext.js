import { createContext, useContext } from 'react'

export const ArcContext = createContext({ stage: 1, color: '#3D6B4F' })

export function useArc() {
  return useContext(ArcContext)
}
