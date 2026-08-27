import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'

function formatAddress(order: Order): string {
  if (order.delivery_type === 'pickup') return 'Recoger en local'
  if (order.calle) {
    const parts = [
      order.calle + (order.interior_depto ? `, ${order.interior_depto}` : ''),
      order.colonia ? `Col. ${order.colonia}` : '',
      order.municipio ?? '',
    ].filter(Boolean)
    return parts.join(', ')
  }
  if (order.direccion) return order.direccion
  return '—'
}

export default function PedidoConfirmado() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [tiempoEstimado, setTiempoEstimado] = useState<number>(25)
  const [restaurantSlug, setRestaurantSlug] = useState<string>('')
  const [restaurantNombre, setRestaurantNombre] = useState<string>('')
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!orderId) { setNotFound(true); setLoading(false); return }

    const load = async () => {
      const { data: orderRows, error } = await supabase.rpc('get_order_by_id', { p_order_id: orderId })

      if (error || !orderRows || orderRows.length === 0) { setNotFound(true); setLoading(false); return }

      const orderData = orderRows[0]

      const parsed: Order = {
        ...orderData,
        items: Array.isArray(orderData.items)
          ? orderData.items
          : JSON.parse(orderData.items as unknown as string),
      }
      setOrder(parsed)

      const { data: rest } = await supabase
        .from('Restaurants')
        .select('tiempo_estimado, slug, nombre, google_place_id')
        .eq('id', orderData.restaurant_id)
        .maybeSingle()

      setTiempoEstimado(rest?.tiempo_estimado ?? 25)
      setRestaurantSlug(rest?.slug ?? '')
      setRestaurantNombre(rest?.nombre ?? '')
      if (rest?.google_place_id) setGooglePlaceId(rest.google_place_id)
      setLoading(false)
    }

    load()
  }, [orderId])

  const menuPath = restaurantSlug ? `/menu/${restaurantSlug}` : '/'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--yalo-primary)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        <p className="text-gray-500 mb-4">Pedido no encontrado.</p>
        <button onClick={() => navigate(menuPath)} className="font-semibold underline" style={{ color: 'var(--yalo-primary)' }}>
          Volver al menú
        </button>
      </div>
    )
  }

  const address = formatAddress(order)
  const isPickup = order.delivery_type === 'pickup'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-4 py-5 text-center border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{restaurantNombre}</p>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 pt-8 pb-10 max-w-md mx-auto w-full">

        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'rgba(30,158,99,0.10)' }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M8 20L16 28L32 12"
              stroke="var(--success)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-bold text-gray-900 text-center mb-1">
          ¡Pedido confirmado!
        </h1>
        <p className="text-gray-400 text-sm text-center mb-5">
          Tu pedido fue recibido con éxito.
        </p>

        <div
          className="w-full rounded-2xl px-5 py-4 mb-4 text-center"
          style={{ background: 'rgba(30,91,79,0.04)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--yalo-primary)' }}>Número de orden</p>
          <p className="text-3xl font-black text-gray-900 tracking-tight font-mono">{order.numero_orden}</p>
        </div>

        <div
          className="w-full rounded-2xl px-5 py-3 mb-5 flex items-center gap-3"
          style={{ backgroundColor: '#FFFBEB', border: '1px solid rgba(252,211,77,0.4)' }}
        >
          <span className="text-2xl">⏱</span>
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Tiempo estimado de entrega</p>
            <p className="text-lg font-black text-amber-900">{tiempoEstimado} minutos</p>
          </div>
        </div>

        <div className="w-full rounded-2xl border overflow-hidden mb-6" style={{ borderColor: 'var(--border)' }}>
          <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Resumen del pedido</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            <Row label="Cliente" value={order.customer_nombre} />
            <Row label={isPickup ? 'Entrega' : 'Dirección'} value={address} />
            <Row label="Total" value={`$${order.total.toFixed(2)}`} bold />
            <Row
              label="Pagas con"
              value={`$${order.monto_pago.toFixed(2)} · Cambio: $${order.cambio.toFixed(2)}`}
            />
          </div>
        </div>

        {googlePlaceId && (
          <a
            href={`https://search.google.com/local/writereview?placeid=${googlePlaceId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white rounded-xl border p-4 text-center hover:opacity-90 transition-opacity mb-3"
            style={{ borderColor: 'var(--yalo-primary)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--yalo-primary)' }}>
              ¿Todo bien con tu pedido? Déjanos tu reseña en Google
            </p>
          </a>
        )}

        <button
          onClick={() => navigate('/cliente/pedidos')}
          className="w-full text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform mb-3 hover:opacity-90"
          style={{ background: 'var(--ink)' }}
        >
          Ver seguimiento de mi pedido
        </button>

        <button
          onClick={() => navigate(menuPath)}
          className="w-full font-semibold text-base py-3 rounded-xl active:scale-95 transition-transform hover:bg-gray-50"
          style={{ color: 'var(--yalo-primary)' }}
        >
          Volver al menú
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="px-4 py-3 flex justify-between items-start gap-3" style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm text-right text-gray-900 ${bold ? 'font-bold' : 'font-medium'}`}>{value}</span>
    </div>
  )
}
