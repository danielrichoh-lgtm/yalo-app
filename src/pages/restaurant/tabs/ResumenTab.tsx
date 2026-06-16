import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Order, Restaurant } from '../../../lib/types'

interface Props { restaurant: Restaurant }

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function ResumenTab({ restaurant }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurant.id)
    setLoading(false)
    if (data) setOrders(data as Order[])
  }, [restaurant.id])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const today = todayStart()
  const todayOrders = orders.filter(o => o.created_at >= today)

  const entregadosHoy = todayOrders.filter(o => o.status === 'Entregado')
  const canceladosHoy = todayOrders.filter(o => o.status === 'Cancelado')
  const totalHoy = entregadosHoy.reduce((s, o) => s + o.total, 0)

  const entregadosTotal = orders.filter(o => o.status === 'Entregado')
  const canceladosTotal = orders.filter(o => o.status === 'Cancelado')
  const totalHistorico = entregadosTotal.reduce((s, o) => s + o.total, 0)

  const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">Resumen</h2>
        <button onClick={fetchOrders} disabled={loading} className="text-sm text-[#1A6B3C] font-medium flex items-center gap-1 disabled:opacity-50">
          <span className={loading ? 'animate-spin' : ''}>↻</span> Actualizar
        </button>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Hoy</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Entregados" value={entregadosHoy.length} />
          <StatCard label="Cancelados" value={canceladosHoy.length} />
          <StatCard label="Total vendido" value={`$${totalHoy.toFixed(0)}`} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Histórico</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Entregados" value={entregadosTotal.length} sub="todos los tiempos" />
          <StatCard label="Cancelados" value={canceladosTotal.length} sub="todos los tiempos" />
          <StatCard label="Total vendido" value={`$${totalHistorico.toFixed(0)}`} sub="todos los tiempos" />
        </div>
      </section>
    </div>
  )
}
