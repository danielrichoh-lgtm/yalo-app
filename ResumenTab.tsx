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

  const ventasPorDia = (() => {
    const fmtLabel = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Monterrey',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    const fmtKey = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Monterrey',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const byDay: Record<string, { date: string; count: number; total: number }> = {}
    for (const o of entregadosTotal) {
      const parts = fmtKey.formatToParts(new Date(o.created_at))
      const y = parts.find(p => p.type === 'year')!.value
      const m = parts.find(p => p.type === 'month')!.value
      const d = parts.find(p => p.type === 'day')!.value
      const key = `${y}-${m}-${d}`
      if (!byDay[key]) {
        const label = fmtLabel.format(new Date(o.created_at))
        byDay[key] = { date: label.charAt(0).toUpperCase() + label.slice(1), count: 0, total: 0 }
      }
      byDay[key].count++
      byDay[key].total += o.total
    }
    return Object.entries(byDay)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30)
      .map(([, v]) => v)
  })()

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
        <button onClick={fetchOrders} disabled={loading} className="text-sm text-[#1E5B4F] font-medium flex items-center gap-1 disabled:opacity-50">
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
        <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Ventas por día</h3>
        {ventasPorDia.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-400 text-center">Aún no hay más historial</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left font-medium px-4 py-2.5">Fecha</th>
                  <th className="text-right font-medium px-4 py-2.5">Pedidos</th>
                  <th className="text-right font-medium px-4 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventasPorDia.map((d, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 text-gray-800">{d.date}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{d.count}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">${d.total.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ventasPorDia.length >= 30 && (
              <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-50">
                Mostrando los últimos 30 días
              </p>
            )}
          </div>
        )}
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
