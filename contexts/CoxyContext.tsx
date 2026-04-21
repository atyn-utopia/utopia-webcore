'use client'

import { createContext, useContext, useState } from 'react'

interface CoxyContextValue {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

const CoxyContext = createContext<CoxyContextValue>({ open: false, setOpen: () => {}, toggle: () => {} })

export function CoxyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <CoxyContext.Provider value={{ open, setOpen, toggle: () => setOpen(o => !o) }}>
      {children}
    </CoxyContext.Provider>
  )
}

export function useCoxy() {
  return useContext(CoxyContext)
}
