import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Order, OrderStatus, Restaurant } from '../../../lib/types'

const ACTIVE_STATUSES: OrderStatus[] = ['Preparando', 'Listo', 'En camino']
const ENTREGADO_STATUS: OrderStatus = 'Entregado'
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Preparando: 'Listo',
  Listo: 'En camino',
  'En camino': 'Entregado',
}
const HARDCODED_RESTAURANT_ID = '1b991239-7915-4106-b883-8b50897682f8'

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch (_) { /* ignore */ }
}

function elapsedLabel(createdAt: string, now: number): string {
  const mins = Math.floor((now - new Date(createdAt).getTime()) / 60_000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `Hace ${h} h` : `Hace ${h} h ${m} min`
}

interface Props { restaurant: Restaurant }

export default function PedidosTab({ restaurant }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [now, setNow] = useState(() => Date.now())
  const knownIds = useRef<Set<string>>(new Set())

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
    if (data) {
      setOrders(data as Order[])
      data.forEach((o: Order) => knownIds.current.add(o.id))
    }
  }, [restaurant.id])

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('orders-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${HARDCODED_RESTAURANT_ID}`,
      }, payload => {
        const order = payload.new as Order
        if (!knownIds.current.has(order.id)) {
          knownIds.current.add(order.id)
          playBeep()
          setOrders(prev => [order, ...prev])
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${HARDCODED_RESTAURANT_ID}`,
      }, payload => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o))
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${HARDCODED_RESTAURANT_ID}`,
      }, payload => {
        setOrders(prev => prev.filter(o => o.id !== payload.old.id))
      })
      .subscribe()

    const timer = setInterval(() => setNow(Date.now()), 60_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchOrders])

  const updateStatus = async (id: string, status: OrderStatus) => {
    await supabase.from('orders').update({ status }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  const deleteOrder = async (id: string) => {
    await supabase.from('orders').delete().eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  const nuevo = orders.filter(o => o.status === 'Nuevo')
  const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status))
  const entregados = orders.filter(o => o.status === ENTREGADO_STATUS)
  const cancelados = orders.filter(o => o.status === 'Cancelado')

  return (
    <div className="space-y-6">
      {nuevo.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Nuevos pedidos ({nuevo.length})
          </h2>
          <div className="space-y-3">
            {nuevo.map(order => (
              <OrderCard key={order.id} order={order} now={now} onAccept={() => updateStatus(order.id, 'Preparando')} onDecline={() => updateStatus(order.id, 'Cancelado')} />
            ))}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-900 mb-3">En progreso ({active.length})</h2>
          <div className="space-y-3">
            {active.map(order => (
              <OrderCard key={order.id} order={order} now={now}>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {NEXT_STATUS[order.status] && (
                    <button
                      onClick={() => updateStatus(order.id, NEXT_STATUS[order.status]!)}
                      className="bg-[#1A6B3C] text-white text-sm px-4 py-1.5 rounded-lg hover:bg-[#155a32]"
                    >
                      Marcar como {NEXT_STATUS[order.status]}
                    </button>
                  )}
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium self-center">
                    {order.status}
                  </span>
                </div>
              </OrderCard>
            ))}
          </div>
        </section>
      )}

      {entregados.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-500 mb-3">Entregados ({entregados.length})</h2>
          <div className="space-y-3">
            {entregados.map(order => (
              <OrderCard key={order.id} order={order} now={now}>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 font-medium">Entregado</span>
                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="text-xs text-gray-400 hover:text-red-400 ml-auto"
                  >
                    Eliminar
                  </button>
                </div>
              </OrderCard>
            ))}
          </div>
        </section>
      )}

      {cancelados.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-500 mb-3">Pedidos cancelados</h2>
          <div className="space-y-3">
            {cancelados.map(order => (
              <OrderCard key={order.id} order={order} now={now}>
                <button
                  onClick={() => deleteOrder(order.id)}
                  className="mt-3 text-xs text-red-500 hover:text-red-700"
                >
                  Eliminar
                </button>
              </OrderCard>
            ))}
          </div>
        </section>
      )}

      {orders.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🍽</p>
          <p>No hay pedidos aún</p>
        </div>
      )}
    </div>
  )
}

interface CardProps {
  order: Order
  now: number
  onAccept?: () => void
  onDecline?: () => void
  children?: React.ReactNode
}

function OrderCard({ order, now, onAccept, onDecline, children }: CardProps) {
  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items as unknown as string)
  const isLate = order.status === 'Nuevo' && (now - new Date(order.created_at).getTime()) > 10 * 60_000

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <span className="font-bold text-[#1A6B3C]">{order.numero_orden}</span>
          <p className="font-semibold text-gray-900 text-sm mt-0.5">{order.customer_nombre}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-500">{order.customer_telefono}</p>
            <a
              href={`tel:+52${order.customer_telefono}`}
              className="text-xs text-[#1A6B3C] font-medium hover:underline"
            >
              📞 Llamar
            </a>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xs font-medium ${isLate ? 'text-red-500' : 'text-gray-400'}`}>
            {elapsedLabel(order.created_at, now)}
          </p>
          <p className="text-sm font-bold text-gray-900 mt-1">${order.total.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.delivery_type === 'domicilio' ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
          {order.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recoger'}
        </span>
      </div>

      {order.delivery_type === 'domicilio' && order.direccion && (
        <p className="text-xs text-gray-500 mt-1">
          {[order.establecimiento, order.direccion, order.piso !== 'No aplica' ? order.piso : '', order.despacho].filter(Boolean).join(', ')}
        </p>
      )}

      <div className="mt-3 border-t border-gray-50 pt-3 space-y-1">
        {items.map((item: {
          nombre: string
          quantity: number
          toppings?: { nombre: string; quantity: number }[]
          extras_seleccionados?: { nombre: string; precio: number; cantidad: number }[]
          nota?: string
        }, idx: number) => (
          <div key={idx} className="text-xs text-gray-700">
            <span className="font-medium">{item.quantity}× {item.nombre}</span>
            {item.extras_seleccionados && item.extras_seleccionados.length > 0 && (
              <span className="text-gray-400">
                {' + '}{item.extras_seleccionados.map(e => e.cantidad > 1 ? `${e.cantidad} ${e.nombre}` : e.nombre).join(', ')}
              </span>
            )}
            {item.toppings && item.toppings.length > 0 && (
              <span className="text-gray-400"> + {item.toppings.map((t) => t.nombre).join(', ')}</span>
            )}
            {item.nota && <span className="text-gray-400 italic"> — {item.nota}</span>}
          </div>
        ))}
      </div>

      <div className="mt-2 text-xs text-gray-500 flex gap-4">
        <span>Subtotal: ${order.subtotal.toFixed(2)}</span>
        {order.costo_envio > 0 && <span>Envío: ${order.costo_envio.toFixed(2)}</span>}
        <span>Paga con: ${order.monto_pago.toFixed(2)}</span>
        {order.cambio > 0 && <span>Cambio: ${order.cambio.toFixed(2)}</span>}
      </div>

      {order.indicaciones && <p className="text-xs text-gray-400 mt-1 italic">Indicaciones: {order.indicaciones}</p>}

      {onAccept && onDecline && (
        <div className="mt-3 flex gap-2">
          <button onClick={onAccept} className="flex-1 bg-[#1A6B3C] text-white text-sm py-2 rounded-lg hover:bg-[#155a32]">Aceptar</button>
          <button onClick={onDecline} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-lg hover:bg-red-600">Declinar</button>
        </div>
      )}
      {children}
    </div>
  )
}
