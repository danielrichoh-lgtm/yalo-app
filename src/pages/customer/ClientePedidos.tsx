import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Order, OrderStatus } from '../../lib/types'
import { useAuth } from '../../context/AuthContext'

const STATUS_STEPS: OrderStatus[] = ['Nuevo', 'Preparando', 'Listo', 'En camino', 'Entregado']

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
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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

  const confirmReceived = async (id: string) => {
    await supabase.from('orders').update({ status: 'Entregado' }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'Entregado' } : o))
  }

  const activeOrders = orders.filter(o => !['Entregado', 'Cancelado'].includes(o.status))
  const historial = orders.filter(o => ['Entregado', 'Cancelado'].includes(o.status))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A6B3C] text-white px-4 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/menu/mi-tierra" className="text-white/70 hover:text-white">←</Link>
          <h1 className="font-bold text-lg">Mis pedidos</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6">
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
                            className="font-bold text-[#1A6B3C] hover:underline"
                          >
                            {order.numero_orden}
                          </Link>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {order.delivery_type === 'domicilio' ? '🛵 A domicilio' : '🏪 Recoger en local'}
                          </p>
                        </div>
                        <span className="font-bold text-gray-900">${order.total.toFixed(2)}</span>
                      </div>
                      <StatusProgress status={order.status} />
                      {order.status === 'En camino' && (
                        <button
                          onClick={() => confirmReceived(order.id)}
                          className="mt-3 w-full bg-[#1A6B3C] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#155a32]"
                        >
                          ✅ Confirmar recibido
                        </button>
                      )}
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
                            <span className="font-bold text-gray-700">{order.numero_orden}</span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(order.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.status === 'Entregado' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {order.status}
                            </span>
                            <p className="font-bold text-gray-900 mt-1">${order.total.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="mt-2 space-y-0.5">
                          {orderItems.map((item: { nombre: string; quantity: number }, idx: number) => (
                            <p key={idx} className="text-xs text-gray-600">{item.quantity}× {item.nombre}</p>
                          ))}
                        </div>
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
