import { supabase } from './supabase'

export async function seedRestaurant() {
  const { data } = await supabase
    .from('Restaurants')
    .select('id')
    .eq('slug', 'mi-tierra')
    .maybeSingle()

  if (data) return

  await supabase.from('Restaurants').insert({
    nombre: 'Restaurante Mi Tierra',
    slug: 'mi-tierra',
    email: 'demo@holayalo.mx',
    password: 'yalo2026',
    servicio_activo: true,
    hora_apertura: '08:00',
    hora_cierre: '22:00',
    costo_envio: 50,
    pickup_activo: true,
    repartidor_propio: true,
    repartidor_externo: false,
  })
}
