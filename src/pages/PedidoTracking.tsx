import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Order, OrderStatus } from '../lib/types'

const STEPS: { label: string; statuses: OrderStatus[] }[] = [
  { label: 'Recibido',    statuses: ['Nuevo'] },
  { label: 'Aceptado',    statuses: ['Preparando'] },
  { label: 'Preparando',  statuses: ['Preparando'] },
  { label: 'Listo',       statuses: ['Listo'] },
  { label: 'En camino',   statuses: ['En camino'] },
  { label: 'Entregado',   statuses: ['Entregado'] },
]

const STATUS_ORDER: OrderStatus[] = ['Nuevo', 'Preparando', 'Listo', 'En camino', 'Entregado']

function stepIndex(status: OrderStatus): number {
  const idx = STATUS_ORDER.indexOf(status)
  if (idx === -1) return 0
  // 'Preparando' covers steps 1 (Aceptado) and 2 (Preparando) in the visual
  if (idx === 0) return 0
  if (idx === 1) return 2 // Preparando → step index 2
  return idx + 1           // Listo→3, En camino→4, Entregado→5
}

export default function PedidoTracking() {
  const { numeroOrden } = useParams<{ numeroOrden: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!numeroOrden) return

    supabase
      .from('orders')
      .select('*')
      .eq('numero_orden', numeroOrden)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('[PedidoTracking] fetch error:', error.message)
        if (data) setOrder(data as Order)
        setLoading(false)
      })
  }, [numeroOrden])

  useEffect(() => {
    if (!order?.id) return

    const channel = supabase
      .channel(`pedido-${order.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${order.id}`,
      }, payload => {
        setOrder(payload.new as Order)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [order?.id])

  const confirmDelivery = async () => {
    if (!order) return
    setConfirming(true)
    await supabase.from('orders').update({ status: 'Entregado' }).eq('id', order.id)
    setConfirming(false)
    setDone(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Pedido no encontrado</p>
          <button onClick={() => navigate('/menu/mi-tierra')} className="text-[#1A6B3C] font-medium hover:underline">
            Ir al menú
          </button>
        </div>
      </div>
    )
  }

  if (done || order.status === 'Entregado') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Gracias!</h1>
          <p className="text-gray-600 mb-6">Tu pedido fue entregado.</p>
          <button
            onClick={() => navigate('/menu/mi-tierra')}
            className="w-full bg-[#1A6B3C] text-white py-3 rounded-xl font-semibold hover:bg-[#155a32] transition-colors"
          >
            Volver al menú
          </button>
        </div>
      </div>
    )
  }

  if (order.status === 'Cancelado') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Pedido cancelado</h1>
          <p className="text-gray-500 mb-6">El restaurante no pudo procesar tu pedido.</p>
          <button
            onClick={() => navigate('/menu/mi-tierra')}
            className="w-full bg-[#1A6B3C] text-white py-3 rounded-xl font-semibold hover:bg-[#155a32] transition-colors"
          >
            Volver al menú
          </button>
        </div>
      </div>
    )
  }

  const currentStep = stepIndex(order.status)

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-[#1A6B3C] text-white px-4 pt-10 pb-8 text-center">
        <p className="text-white/70 text-sm mb-1">Rastreando pedido</p>
        <div className="inline-block bg-white/20 rounded-2xl px-6 py-2">
          <span className="font-mono font-bold text-2xl tracking-widest">{order.numero_orden}</span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 -mt-4 space-y-4">
        {/* Status steps */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="relative">
            {/* Progress line */}
            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-100" />
            <div
              className="absolute left-4 top-4 w-0.5 bg-[#1A6B3C] transition-all duration-500"
              style={{ height: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />

            <div className="space-y-6 relative">
              {STEPS.map((step, idx) => {
                const completed = idx < currentStep
                const active = idx === currentStep
                return (
                  <div key={step.label} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-colors ${
                      completed ? 'bg-[#1A6B3C] border-[#1A6B3C]' :
                      active    ? 'bg-white border-[#1A6B3C]' :
                                  'bg-white border-gray-200'
                    }`}>
                      {completed ? (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : active ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1A6B3C] animate-pulse" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-200" />
                      )}
                    </div>
                    <p className={`text-sm font-medium transition-colors ${
                      completed ? 'text-[#1A6B3C]' :
                      active    ? 'text-gray-900' :
                                  'text-gray-400'
                    }`}>
                      {step.label}
                      {active && <span className="ml-2 text-xs text-[#1A6B3C] font-normal animate-pulse">En curso...</span>}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Confirm received button */}
        {order.status === 'En camino' && (
          <button
            onClick={confirmDelivery}
            disabled={confirming}
            className="w-full bg-[#1A6B3C] text-white py-4 rounded-xl font-bold text-base hover:bg-[#155a32] disabled:opacity-60 transition-colors"
          >
            {confirming ? 'Confirmando...' : '✅ Confirmar recibido'}
          </button>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">
            {order.delivery_type === 'pickup' ? '🏪 Recoger en local' : '🛵 Entrega a domicilio'}
            {order.delivery_type === 'domicilio' && order.establecimiento && ` · ${order.establecimiento}`}
          </p>
          <p className="font-bold text-gray-900">${order.total.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{order.customer_nombre} · {order.customer_telefono}</p>
        </div>
      </div>
    </div>
  )
}
