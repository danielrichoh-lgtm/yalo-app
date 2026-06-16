import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ProtectedRestaurantRoute({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const stored = sessionStorage.getItem('restaurant_session')
      setAllowed(!!session && !!stored)
      setChecking(false)
    })
  }, [])

  if (checking) return null
  if (!allowed) return <Navigate to="/restaurant/login" replace />
  return <>{children}</>
}

export function ProtectedCustomerRoute({ children }: { children: ReactNode }) {
  const stored = sessionStorage.getItem('customer')
  if (!stored) return <Navigate to="/cliente/login" replace />
  return <>{children}</>
}
