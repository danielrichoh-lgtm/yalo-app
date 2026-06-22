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
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!orderId) { setNotFound(true); setLoading(false); return }

    const load = async () => {
      const { data: orderData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle()

      if (error || !orderData) { setNotFound(true); setLoading(false); return }

      const parsed: Order = {
        ...orderData,
        items: Array.isArray(orderData.items)
          ? orderData.items
          : JSON.parse(orderData.items as unknown as string),
      }
      setOrder(parsed)

      const { data: rest } = await supabase
        .from('Restaurants')
        .select('tiempo_estimado')
        .eq('id', orderData.restaurant_id)
        .maybeSingle()

      setTiempoEstimado(rest?.tiempo_estimado ?? 25)
      setLoading(false)
    }

    load()
  }, [orderId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-[#34C776] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        <p className="text-gray-500 mb-4">Pedido no encontrado.</p>
        <button onClick={() => navigate('/menu/mi-tierra')} className="text-[#0F4A2A] font-semibold underline">
          Volver al menú
        </button>
      </div>
    )
  }

  const address = formatAddress(order)
  const isPickup = order.delivery_type === 'pickup'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-[#0F4A2A] px-4 py-5 text-center">
        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Mi Tierra</p>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 pt-8 pb-10 max-w-md mx-auto w-full">

        {/* Success icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-lg"
          style={{ backgroundColor: '#34C776' }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M8 20L16 28L32 12"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-black text-gray-900 text-center mb-1">
          ¡Pedido confirmado!
        </h1>
        <p className="text-gray-400 text-sm text-center mb-5">
          Tu pedido fue recibido con éxito.
        </p>

        {/* Order number */}
        <div
          className="w-full rounded-2xl px-5 py-4 mb-4 text-center"
          style={{ backgroundColor: '#F0FBF4', border: '1.5px solid #34C776' }}
        >
          <p className="text-xs font-bold text-[#1A6B3C] uppercase tracking-widest mb-1">Número de orden</p>
          <p className="text-3xl font-black text-[#0F4A2A] tracking-tight">{order.numero_orden}</p>
        </div>

        {/* Estimated time */}
        <div
          className="w-full rounded-2xl px-5 py-3 mb-5 flex items-center gap-3"
          style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FCD34D' }}
        >
          <span className="text-2xl">⏱</span>
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Tiempo estimado de entrega</p>
            <p className="text-lg font-black text-amber-900">{tiempoEstimado} minutos</p>
          </div>
        </div>

        {/* Summary card */}
        <div className="w-full rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Resumen del pedido</p>
          </div>
          <div className="divide-y divide-gray-50">
            <Row label="Cliente" value={order.customer_nombre} />
            <Row label={isPickup ? 'Entrega' : 'Dirección'} value={address} />
            <Row label="Total" value={`$${order.total.toFixed(2)}`} bold />
            <Row
              label="Pagas con"
              value={`$${order.monto_pago.toFixed(2)} · Cambio: $${order.cambio.toFixed(2)}`}
            />
          </div>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => navigate('/cliente/pedidos')}
          className="w-full text-white font-bold text-base py-4 rounded-2xl active:scale-95 transition-transform shadow-md mb-3"
          style={{ backgroundColor: '#0F4A2A' }}
        >
          Ver seguimiento de mi pedido
        </button>

        {/* Secondary CTA */}
        <button
          onClick={() => navigate('/menu/mi-tierra')}
          className="w-full text-[#0F4A2A] font-semibold text-base py-3 rounded-2xl active:scale-95 transition-transform"
        >
          Volver al menú
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="px-4 py-3 flex justify-between items-start gap-3">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm text-right text-gray-900 ${bold ? 'font-bold' : 'font-medium'}`}>{value}</span>
    </div>
  )
}
