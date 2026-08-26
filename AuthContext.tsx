import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Customer } from '../lib/types'

interface AuthContextType {
  customer: Customer | null
  setCustomer: (c: Customer | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomerState] = useState<Customer | null>(() => {
    const stored = sessionStorage.getItem('customer')
    return stored ? JSON.parse(stored) : null
  })

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCustomerState(null)
        sessionStorage.removeItem('customer')
        sessionStorage.removeItem('restaurant_session')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const setCustomer = (c: Customer | null) => {
    setCustomerState(c)
    if (c) {
      sessionStorage.setItem('customer', JSON.stringify(c))
    } else {
      sessionStorage.removeItem('customer')
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    sessionStorage.clear()
    setCustomerState(null)
  }

  return (
    <AuthContext.Provider value={{ customer, setCustomer, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
