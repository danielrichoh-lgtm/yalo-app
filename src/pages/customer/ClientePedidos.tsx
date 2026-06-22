import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Order, OrderItem, OrderStatus, MenuItem, CartItem } from '../../lib/types'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'

const STATUS_STEPS: OrderStatus[] = ['Nuevo', 'En proceso', 'Entregado']

function StatusProgress({ status }: { status: OrderStatus }) {
  const current = STATUS_STEPS.indexOf(status)
  return (
    <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
      {STATUS_STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-shrink-0">
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${i < current ? 'bg-[#34C776] text-white' : i === current ? 'bg-[#1A6B3C] text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className={`text-[9px] mt-0.5 ${i === current ? 'text-[#1A6B3C] font-bold' : 'text-gray-400'}`}>{s}</span>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`h-0.5 w-4 flex-shrink-0 ${i < current ? 'bg-[#34C776]' : 'bg-gray-100'} mb-3`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function ClientePedidos() {
  const { customer } = useAuth()
  const { clearCart, addItem } = useCart()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [reordering, setReordering] = useState<string | null>(null)
  const [reorderNotice, setReorderNotice] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    const localNums: string[] = JSON.parse(localStorage.getItem('yalo_mis_pedidos') || '[]')

    let emailNums: string[] = []
    if (customer) {
      const { data } = await supabase
        .from('orders')
        .select('numero_orden')
        .eq('customer_email', customer.email)
      if (data) emailNums = data.map((o: { numero_orden: string }) => o.numero_orden)
    }

    const allNums = [...new Set([...localNums, ...emailNums])]
    if (allNums.length === 0) {
      setOrders([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('orders')
      .select('*')
      .in('numero_orden', allNums)
      .order('created_at', { ascending: false })
    if (data) setOrders(data as Order[])
    setLoading(false)
  }, [customer])

  useEffect(() => {
    fetchOrders()

    if (!customer) return

    const channel = supabase
      .channel(`customer-orders:${customer.email}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `customer_email=eq.${customer.email}`,
      }, payload => {
        if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o))
        } else if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new as Order, ...prev])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [customer, fetchOrders])

  const activeOrders = orders.filter(o => !['Entregado', 'Cancelado'].includes(o.status))
  const historial = orders.filter(o => ['Entregado', 'Cancelado'].includes(o.status))

  const handleReorder = async (order: Order) => {
    setReordering(order.id)
    setReorderNotice(null)

    const orderItems: OrderItem[] = Array.isArray(order.items)
      ? order.items
      : JSON.parse(order.items as unknown as string)

    const dishIds = [...new Set(orderItems.map(i => i.dish_id).filter(Boolean))]

    const { data: menuData } = await supabase
      .from('menu_items')
      .select('*')
      .in('id', dishIds)
      .eq('disponible', true)

    const availableMap = new Map<string, MenuItem>(
      ((menuData ?? []) as MenuItem[]).map(m => [m.id, m])
    )

    const cartItems: CartItem[] = []
    let skipped = 0

    for (const oi of orderItems) {
      const dish = availableMap.get(oi.dish_id)
      if (!dish) { skipped++; continue }
      cartItems.push({
        dish,
        quantity: oi.quantity,
        toppings: oi.toppings ?? [],
        nota: oi.nota ?? '',
        variantes_seleccionadas: oi.variantes_seleccionadas,
        extras_seleccionados: oi.extras_seleccionados,
        variantes_precio: oi.variantes_precio,
      })
    }

    clearCart()
    for (const ci of cartItems) addItem(ci)

    setReordering(null)

    if (skipped > 0) {
      setReorderNotice(`${skipped} platillo${skipped > 1 ? 's' : ''} ya no ${skipped > 1 ? 'están disponibles' : 'está disponible'} y ${skipped > 1 ? 'fueron omitidos' : 'fue omitido'}.`)
      setTimeout(() => {
        navigate('/menu/mi-tierra?abrirCarrito=1')
      }, 2000)
    } else {
      navigate('/menu/mi-tierra?abrirCarrito=1')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A6B3C] text-white px-4 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/menu/mi-tierra" className="text-white/70 hover:text-white">←</Link>
          <h1 className="font-bold text-lg">Mis pedidos</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6">
        {reorderNotice && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
            {reorderNotice} Cargando el resto de tu pedido...
          </div>
        )}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando...</div>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <section>
                <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34C776] animate-pulse" />
                  En curso ({activeOrders.length})
                </h2>
                <div className="space-y-3">
                  {activeOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex justify-between">
                        <div>
                          <Link
                            to={`/pedido/${order.numero_orden}`}
                            className="font-bold text-[#1A6B3C] hover:underline text-base"
                          >
                            {order.numero_orden}
                          </Link>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {order.delivery_type === 'domicilio' ? '🛵 A domicilio' : '🏪 Recoger en local'}
                          </p>
                        </div>
                        <span className="font-bold text-gray-900 text-base">${order.total.toFixed(2)}</span>
                      </div>
                      <StatusProgress status={order.status} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {historial.length > 0 && (
              <section>
                <h2 className="font-bold text-gray-900 mb-3">Historial</h2>
                <div className="space-y-3">
                  {historial.map(order => {
                    const orderItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items as unknown as string)
                    return (
                      <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-gray-700 text-base">{order.numero_orden}</span>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {new Date(order.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${order.status === 'Entregado' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {order.status}
                            </span>
                            <p className="font-bold text-gray-900 text-base mt-1">${order.total.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="mt-2 space-y-0.5">
                          {orderItems.map((item: { nombre: string; quantity: number }, idx: number) => (
                            <p key={idx} className="text-sm text-gray-600">{item.quantity}× {item.nombre}</p>
                          ))}
                        </div>
                        {order.status === 'Entregado' && (
                          <button
                            onClick={() => handleReorder(order)}
                            disabled={reordering === order.id}
                            className="mt-3 w-full bg-[#1A6B3C] hover:bg-[#155a32] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                          >
                            {reordering === order.id ? 'Cargando pedido...' : 'Volver a pedir'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {orders.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">🛍</p>
                <p>Aún no has hecho pedidos desde este dispositivo</p>
                <Link to="/menu/mi-tierra" className="mt-3 inline-block text-[#1A6B3C] font-medium text-sm hover:underline">
                  Ver menú
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
