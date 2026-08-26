import { supabase } from './supabase'
import type { Restaurant } from './types'

let pendingPromise: Promise<Restaurant | null> | null = null

export async function ensureRestaurantForUser(userId: string): Promise<Restaurant | null> {
  if (pendingPromise) return pendingPromise

  pendingPromise = (async () => {
    const { data: existing } = await supabase
      .from('restaurant_users')
      .select('restaurant_id, rol')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing?.restaurant_id) {
      const { data: rest } = await supabase
        .from('Restaurants')
        .select('*')
        .eq('id', existing.restaurant_id)
        .maybeSingle()
      if (rest) {
        const restaurant = rest as Restaurant
        sessionStorage.setItem('restaurant_session', JSON.stringify(restaurant))
        sessionStorage.setItem('restaurant_rol', existing.rol ?? 'admin')
        return restaurant
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const nombre_restaurante = user.user_metadata?.nombre_restaurante
    const telefono = user.user_metadata?.telefono ?? ''
    if (!nombre_restaurante) return null

    const { data: rpcData, error: rpcError } = await supabase.rpc('create_restaurant_with_owner', {
      p_user_id: userId,
      p_nombre_restaurante: nombre_restaurante,
      p_email: user.email ?? '',
      p_telefono: telefono,
    })

    if (rpcError || !rpcData) return null

    const result = rpcData as { restaurant_id: string; slug: string }

    const { data: rest } = await supabase
      .from('Restaurants')
      .select('*')
      .eq('id', result.restaurant_id)
      .maybeSingle()

    if (rest) {
      const restaurant = rest as Restaurant
      sessionStorage.setItem('restaurant_session', JSON.stringify(restaurant))
      sessionStorage.setItem('restaurant_rol', 'admin')
      return restaurant
    }

    return null
  })()

  try {
    return await pendingPromise
  } finally {
    pendingPromise = null
  }
}

export async function getRestaurantForUser(userId: string): Promise<Restaurant | null> {
  const { data: existing } = await supabase
    .from('restaurant_users')
    .select('restaurant_id, rol')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing?.restaurant_id) return null

  const { data: rest } = await supabase
    .from('Restaurants')
    .select('*')
    .eq('id', existing.restaurant_id)
    .maybeSingle()

  if (!rest) return null

  const restaurant = rest as Restaurant
  sessionStorage.setItem('restaurant_session', JSON.stringify(restaurant))
  sessionStorage.setItem('restaurant_rol', existing.rol ?? 'admin')
  return restaurant
}
