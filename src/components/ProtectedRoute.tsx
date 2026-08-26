import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../lib/types'

export function ProtectedRestaurantRoute({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const stored = sessionStorage.getItem('restaurant_session')
      if (!session || !stored) {
        setChecking(false)
        return
      }

      let restaurantData: Restaurant | null = null

      const assignmentId = (() => {
        try { return (JSON.parse(stored) as Restaurant).id } catch { return null }
      })()

      if (assignmentId) {
        const { data } = await supabase
          .from('Restaurants')
          .select('*')
          .eq('id', assignmentId)
          .maybeSingle()
        if (data) restaurantData = data as Restaurant
      }

      if (!restaurantData) {
        const { data: assignment } = await supabase
          .from('restaurant_users')
          .select('restaurant_id, rol')
          .maybeSingle()

        if (assignment?.restaurant_id) {
          const { data: rest } = await supabase
            .from('Restaurants')
            .select('*')
            .eq('id', assignment.restaurant_id)
            .maybeSingle()
          if (rest) {
            restaurantData = rest as Restaurant
            sessionStorage.setItem('restaurant_session', JSON.stringify(restaurantData))
            sessionStorage.setItem('restaurant_rol', assignment.rol ?? 'admin')
          }
        }
      }

      if (!restaurantData) {
        setChecking(false)
        return
      }

      setRestaurant(restaurantData)

      if (restaurantData.estado === 'draft' && !restaurantData.onboarding_completed) {
        setNeedsOnboarding(true)
      }

      setChecking(false)
    })()
  }, [])

  if (checking) return null
  if (!restaurant) return <Navigate to="/restaurant/login" replace />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export function ProtectedAdminRoute({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const stored = sessionStorage.getItem('admin_session')
      setAllowed(!!session && !!stored)
      setChecking(false)
    })
  }, [])

  if (checking) return null
  if (!allowed) return <Navigate to="/admin" replace />
  return <>{children}</>
}

export function ProtectedCustomerRoute({ children }: { children: ReactNode }) {
  const stored = sessionStorage.getItem('customer')
  if (!stored) return <Navigate to="/cliente/login" replace />
  return <>{children}</>
}
