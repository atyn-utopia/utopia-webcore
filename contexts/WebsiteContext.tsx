'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface WebsiteContextType {
  selectedWebsite: string
  setSelectedWebsite: (w: string) => void
}

const WebsiteContext = createContext<WebsiteContextType>({
  selectedWebsite: '',
  setSelectedWebsite: () => {},
})

export function WebsiteProvider({ children }: { children: ReactNode }) {
  const [selectedWebsite, setSelectedWebsite] = useState('')
  return (
    <WebsiteContext.Provider value={{ selectedWebsite, setSelectedWebsite }}>
      {children}
    </WebsiteContext.Provider>
  )
}

export function useWebsite() {
  return useContext(WebsiteContext)
}
