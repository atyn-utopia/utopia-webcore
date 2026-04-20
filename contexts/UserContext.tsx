'use client'

import { createContext, useContext } from 'react'

export type UserRole = 'admin' | 'designer' | 'external_designer' | 'writer' | 'indoor_sales' | 'manager'

interface UserContextType {
  email: string
  name: string
  role: UserRole
}

const UserContext = createContext<UserContextType>({ email: '', name: '', role: 'admin' })

export function UserProvider({ children, value }: { children: React.ReactNode; value: UserContextType }) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  return useContext(UserContext)
}
