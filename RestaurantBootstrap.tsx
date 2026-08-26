import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ensureRestaurantForUser } from '../lib/restaurant'

export default function RestaurantBootstrap() {
  const navigate = useNavigate()
  const location = useLocation()
  const bootstrappingRef = useRef(false)
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname

  useEffect(() => {
    let cancelled = false

    const tryBootstrap = async (userId: string) => {
      if (bootstrappingRef.current) return
      bootstrappingRef.current = true

      try {
        const restaurant = await ensureRestaurantForUser(userId)
        if (cancelled || !restaurant) return

        if (restaurant.estado === 'draft' && !restaurant.onboarding_completed) {
          if (pathRef.current !== '/onboarding') {
            navigate('/onboarding', { replace: true })
          }
        } else {
          if (pathRef.current !== '/restaurant/dashboard') {
            navigate('/restaurant/dashboard', { replace: true })
          }
        }
      } catch (err) {
        console.error('[RestaurantBootstrap] Error en ensureRestaurantForUser:', err)
      }
    }

    const attemptBootstrap = (session: Session | null) => {
      if (cancelled || !session?.user) return

      const stored = sessionStorage.getItem('restaurant_session')
      if (stored) return

      const hasMetadata = session.user.user_metadata?.nombre_restaurante
      if (!hasMetadata) return

      tryBootstrap(session.user.id)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      attemptBootstrap(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (!session?.user) return

      attemptBootstrap(session)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [navigate])

  return null
}
