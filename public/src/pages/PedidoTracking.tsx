import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Order, OrderItem } from '../lib/types'

// Steps shown to the customer
const STEPS: { label: string; sublabel?: string }[] = [
  { label: 'Recibido',   sublabel: 'Tu pedido llegó al restaurante' },
  { label: 'En proceso', sublabel: 'El equipo está cocinando' },
  { label: 'Entregado',  sublabel: '¡Pedido completado!' },
]

const STATUS_TO_STEP: Record<string, number> = {
  Nuevo:       0,
  'En proceso': 1,
  Entregado:   2,
  Cancelado:   -1,
}

function formatAddress(order: Order): string | null {
  if (order.calle) {
    return [
      order.calle,
      order.interior_depto,
      order.colonia ? `Col. ${order.colonia}` : '',
      order.municipio,
    ].filter(Boolean).join(', ')
  }
  if (order.direccion) {
    return [order.establecimiento, order.direccion, order.piso !== 'No aplica' ? order.piso : '', order.despacho]
      .filter(Boolean).join(', ')
  }
  return null
}

export default function PedidoTracking() {
  const { numeroOrden } = useParams<{ numeroOrden: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isNew = (location.state as { isNew?: boolean } | null)?.isNew === true

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [restaurantSlug, setRestaurantSlug] = useState<string>('')

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
    if (!order?.restaurant_id) return
    supabase
      .from('Restaurants')
      .select('slug')
      .eq('id', order.restaurant_id)
      .maybeSingle()
      .then(({ data }) => { if (data?.slug) setRestaurantSlug(data.slug) })
  }, [order?.restaurant_id])

  const menuPath = restaurantSlug ? `/menu/${restaurantSlug}` : '/'

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1A6B3C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Cargando tu pedido...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Pedido no encontrado</p>
          <button onClick={() => navigate(menuPath)} className="text-[#1A6B3C] font-semibold hover:underline">
            Ir al menú
          </button>
        </div>
      </div>
    )
  }

  // ── CANCELLED ──────────────────────────────────────────────────────────────
  if (order.status === 'Cancelado') {
    return (
      <div className="min-h-screen bg-gray-50 pb-10">
        <div className="bg-red-600 text-white px-4 pt-12 pb-10 text-center">
          <div className="text-5xl mb-3">❌</div>
          <h1 className="text-2xl font-bold">Pedido cancelado</h1>
          <p className="text-white/80 text-base mt-1">El restaurante no pudo procesar tu pedido</p>
          <div className="inline-block bg-white/20 rounded-2xl px-6 py-2 mt-4">
            <span className="font-mono font-bold text-xl tracking-widest">{order.numero_orden}</span>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 -mt-4 space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-base text-gray-600">Si tienes dudas llámanos:</p>
            <a href="tel:+528183405611" className="text-[#1A6B3C] font-semibold text-lg hover:underline">81 8340-5611</a>
          </div>
          <OrderItemsCard order={order} />
          <button
            onClick={() => navigate(menuPath)}
            className="w-full bg-[#1A6B3C] text-white py-4 rounded-xl font-bold text-base hover:bg-[#155a32] transition-colors"
          >
            Volver al menú
          </button>
        </div>
      </div>
    )
  }

  // ── DELIVERED ──────────────────────────────────────────────────────────────
  if (order.status === 'Entregado') {
    return (
      <div className="min-h-screen bg-gray-50 pb-10">
        <div className="bg-[#1A6B3C] text-white px-4 pt-12 pb-10 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold">¡Pedido entregado!</h1>
          <p className="text-white/80 text-base mt-1">Gracias por tu pedido</p>
          <div className="inline-block bg-white/20 rounded-2xl px-6 py-2 mt-4">
            <span className="font-mono font-bold text-xl tracking-widest">{order.numero_orden}</span>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 -mt-4 space-y-3">
          <OrderItemsCard order={order} />
          <div className="flex gap-3">
            <Link to="/cliente/pedidos" className="flex-1 border border-[#1A6B3C] text-[#1A6B3C] py-3.5 rounded-xl font-semibold text-center text-base hover:bg-green-50">
              Mis pedidos
            </Link>
            <Link to={menuPath} className="flex-1 bg-[#1A6B3C] text-white py-3.5 rounded-xl font-semibold text-center text-base hover:bg-[#155a32]">
              Volver al menú
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── ACTIVE ORDER ───────────────────────────────────────────────────────────
  const currentStep = STATUS_TO_STEP[order.status] ?? 0
  const address = formatAddress(order)
  const statusMessages: Partial<Record<string, string>> = {
    Nuevo:        'Esperando que el restaurante acepte tu pedido...',
    'En proceso': 'El restaurante está preparando tu pedido',
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-[#1A6B3C] text-white px-4 pt-10 pb-12 text-center">
        {isNew && (
          <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-sm font-semibold px-3 py-1 rounded-full mb-3">
            ✅ ¡Pedido enviado!
          </div>
        )}
        <p className="text-white/70 text-sm mb-1">Rastreando pedido</p>
        <div className="inline-block bg-white/20 rounded-2xl px-6 py-2">
          <span className="font-mono font-bold text-2xl tracking-widest">{order.numero_orden}</span>
        </div>
        {statusMessages[order.status] && (
          <p className="text-white/90 text-base mt-3 max-w-xs mx-auto leading-snug">{statusMessages[order.status]}</p>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 space-y-4">

        {/* Live stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="relative pl-5">
            {/* Background track */}
            <div className="absolute left-[9px] top-3 bottom-3 w-0.5 bg-gray-100 rounded-full" />
            {/* Filled progress */}
            <div
              className="absolute left-[9px] top-3 w-0.5 bg-[#1A6B3C] rounded-full transition-all duration-700"
              style={{ height: `${currentStep === 0 ? 0 : (currentStep / (STEPS.length - 1)) * 100}%` }}
            />
            <div className="space-y-5 relative">
              {STEPS.map((step, idx) => {
                const completed = idx < currentStep
                const active = idx === currentStep
                return (
                  <div key={step.label} className="flex items-start gap-3.5">
                    {/* Circle */}
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 z-10 transition-all duration-500 ${
                      completed
                        ? 'bg-[#1A6B3C] border-2 border-[#1A6B3C]'
                        : active
                          ? 'bg-white border-2 border-[#1A6B3C] shadow-[0_0_0_3px_rgba(26,107,60,0.15)]'
                          : 'bg-white border-2 border-gray-200'
                    }`}>
                      {completed ? (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : active ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1A6B3C] animate-pulse" />
                      ) : null}
                    </div>
                    {/* Label */}
                    <div className={`transition-opacity duration-300 ${!completed && !active ? 'opacity-40' : ''}`}>
                      <p className={`text-base font-semibold leading-tight ${completed ? 'text-[#1A6B3C]' : active ? 'text-gray-900' : 'text-gray-500'}`}>
                        {step.label}
                        {active && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-[#1A6B3C] font-normal">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1A6B3C] animate-pulse inline-block" />
                            En curso
                          </span>
                        )}
                      </p>
                      {active && step.sublabel && (
                        <p className="text-sm text-gray-500 mt-0.5">{step.sublabel}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Delivery info */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">{order.delivery_type === 'pickup' ? '🏪' : '🛵'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-base">
                {order.delivery_type === 'pickup' ? 'Recoger en local' : 'Entrega a domicilio'}
              </p>
              {address && (
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{address}</p>
              )}
              {order.identificador_lugar && (
                <p className="text-sm text-gray-700 font-medium mt-0.5">🏠 {order.identificador_lugar}</p>
              )}
              {order.referencias && (
                <p className="text-sm text-gray-400 mt-0.5">🗺 {order.referencias}</p>
              )}
              {order.indicaciones && (
                <p className="text-sm text-gray-400 mt-0.5 italic">📝 {order.indicaciones}</p>
              )}
              <p className="text-sm text-[#1A6B3C] font-medium mt-1">
                {order.delivery_type === 'pickup' ? '🏪 Recoge en local' : '🛵 Entrega a domicilio'}
              </p>
            </div>
          </div>

          {/* Payment summary */}
          <div className="border-t border-gray-50 pt-2 space-y-1">
            <div className="flex justify-between text-base">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-gray-900">${order.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Pagas con</span>
              <span className="text-gray-600">${order.monto_pago.toFixed(2)}</span>
            </div>
            {order.cambio > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tu cambio</span>
                <span className="text-[#1A6B3C] font-semibold">${order.cambio.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Order items — collapsible */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowDetails(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left"
          >
            <span className="font-semibold text-gray-900 text-base">Ver mi pedido</span>
            <span className="text-gray-400 text-lg">{showDetails ? '∧' : '∨'}</span>
          </button>
          {showDetails && <OrderItemsCard order={order} noBorder />}
        </div>

        {/* Navigation links */}
        <div className="flex gap-3">
          <Link to="/cliente/pedidos" className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold text-center text-base hover:bg-gray-50">
            Mis pedidos
          </Link>
          <Link to={menuPath} className="flex-1 border border-[#1A6B3C] text-[#1A6B3C] py-3 rounded-xl font-semibold text-center text-base hover:bg-green-50">
            Ver menú
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Shared item list component ─────────────────────────────────────────────

function OrderItemsCard({ order, noBorder }: { order: Order; noBorder?: boolean }) {
  const items = Array.isArray(order.items)
    ? order.items
    : JSON.parse(order.items as unknown as string) as OrderItem[]

  return (
    <div className={noBorder ? 'px-4 pb-4' : 'bg-white rounded-xl border border-gray-100 p-4 shadow-sm'}>
      {!noBorder && <h2 className="font-bold text-gray-900 text-base mb-3">Tu pedido</h2>}
      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-base text-gray-800 leading-snug">
                <span className="font-semibold">{item.quantity}×</span> {item.nombre}
              </p>
              {item.toppings && item.toppings.length > 0 && (
                <p className="text-sm text-gray-400 mt-0.5">{item.toppings.map(t => `+ ${t.nombre}`).join(', ')}</p>
              )}
              {item.nota && <p className="text-sm text-gray-400 italic mt-0.5">"{item.nota}"</p>}
            </div>
            <span className="font-semibold text-gray-900 shrink-0 text-base">
              ${((item.precio + item.toppings.reduce((s, t) => s + t.precio * t.quantity, 0)) * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 mt-3 pt-3 space-y-1.5">
        <div className="flex justify-between text-base text-gray-600"><span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
        {order.costo_envio > 0 && (
          <div className="flex justify-between text-base text-gray-600"><span>Envío</span><span>${order.costo_envio.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between font-bold text-gray-900 text-lg pt-1"><span>Total</span><span>${order.total.toFixed(2)}</span></div>
      </div>
    </div>
  )
}
