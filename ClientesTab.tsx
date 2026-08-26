import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Order, OrderItem, Restaurant } from '../../../lib/types'

interface Props { restaurant: Restaurant }

interface ClienteAgrupado {
  telefono: string
  nombre: string
  pedidos: Order[]
  totalGastado: number
  ultimaCompra: string
}

type SortKey = 'nombre' | 'pedidos' | 'ultima' | 'gasto'
type SortDir = 'asc' | 'desc'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const dias = Math.floor(diff / 86_400_000)
  if (dias < 1) return 'hoy'
  if (dias === 1) return 'hace 1 día'
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  if (meses === 1) return 'hace 1 mes'
  return `hace ${meses} meses`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ClientesTab({ restaurant }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('ultima')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedTel, setExpandedTel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'Entregado')
        .order('created_at', { ascending: false })
      if (!cancelled) {
        setOrders((data as Order[]) ?? [])
        setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [restaurant.id])

  const clientes = useMemo<ClienteAgrupado[]>(() => {
    const map = new Map<string, ClienteAgrupado>()
    for (const o of orders) {
      const tel = o.customer_telefono || '(sin teléfono)'
      const existing = map.get(tel)
      if (existing) {
        existing.pedidos.push(o)
        existing.totalGastado += o.total
        if (new Date(o.created_at) > new Date(existing.ultimaCompra)) {
          existing.ultimaCompra = o.created_at
          existing.nombre = o.customer_nombre
        }
      } else {
        map.set(tel, {
          telefono: tel,
          nombre: o.customer_nombre,
          pedidos: [o],
          totalGastado: o.total,
          ultimaCompra: o.created_at,
        })
      }
    }
    return Array.from(map.values())
  }, [orders])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = clientes
    if (q) {
      list = list.filter(c =>
        c.nombre.toLowerCase().includes(q) || c.telefono.toLowerCase().includes(q)
      )
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'nombre') cmp = a.nombre.localeCompare(b.nombre, 'es')
      else if (sortKey === 'pedidos') cmp = a.pedidos.length - b.pedidos.length
      else if (sortKey === 'ultima') cmp = new Date(a.ultimaCompra).getTime() - new Date(b.ultimaCompra).getTime()
      else if (sortKey === 'gasto') cmp = a.totalGastado - b.totalGastado
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [clientes, search, sortKey, sortDir])

  const totalClientes = clientes.length
  const recompradores = clientes.filter(c => c.pedidos.length >= 2).length
  const tasaRecompra = totalClientes > 0 ? (recompradores / totalClientes) * 100 : 0
  const ticketPromedio = orders.length > 0 ? orders.reduce((s, o) => s + o.total, 0) / orders.length : 0

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'nombre' ? 'asc' : 'desc')
    }
  }

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="font-bold text-gray-900">Clientes</h2>
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="font-bold text-gray-900">Clientes</h2>

      {totalClientes === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">👥</p>
          <p className="text-lg">Aún no hay clientes</p>
          <p className="text-sm mt-1">Cuando tengas tu primer pedido entregado, aparecerá aquí.</p>
        </div>
      ) : (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Clientes totales" value={totalClientes} />
            <StatCard label="Tasa de recompra" value={`${tasaRecompra.toFixed(0)}%`} sub={`${recompradores} recurrentes`} />
            <StatCard label="Ticket promedio" value={`$${ticketPromedio.toFixed(0)}`} />
          </div>

          {/* Buscador */}
          <div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1E5B4F] bg-white"
            />
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1fr_0.7fr_0.9fr_0.9fr] gap-1 px-3 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <button onClick={() => toggleSort('nombre')} className="text-left">Nombre{sortArrow('nombre')}</button>
              <span className="text-left">Teléfono</span>
              <button onClick={() => toggleSort('pedidos')} className="text-right">Pedidos{sortArrow('pedidos')}</button>
              <button onClick={() => toggleSort('ultima')} className="text-right">Última{sortArrow('ultima')}</button>
              <button onClick={() => toggleSort('gasto')} className="text-right">Gasto{sortArrow('gasto')}</button>
            </div>

            {filtered.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">Sin resultados para "{search}"</p>
            ) : (
              filtered.map(c => (
                <div key={c.telefono} className="border-b border-gray-50 last:border-b-0">
                  <button
                    onClick={() => setExpandedTel(t => t === c.telefono ? null : c.telefono)}
                    className="w-full grid grid-cols-[1.4fr_1fr_0.7fr_0.9fr_0.9fr] gap-1 px-3 py-3 text-sm text-left hover:bg-gray-50 transition-colors items-center"
                  >
                    <span className="font-semibold text-gray-900 truncate">{c.nombre}</span>
                    <span className="text-gray-600 truncate">{c.telefono}</span>
                    <span className="text-right font-medium text-gray-700">{c.pedidos.length}</span>
                    <span className="text-right text-gray-500 text-xs">{timeAgo(c.ultimaCompra)}</span>
                    <span className="text-right font-bold text-gray-900">${c.totalGastado.toFixed(0)}</span>
                  </button>

                  {expandedTel === c.telefono && (
                    <div className="px-3 pb-4 pt-1 space-y-3 bg-gray-50/50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        Historial ({c.pedidos.length} pedidos)
                      </p>
                      {c.pedidos.map(o => (
                        <OrderHistoryCard key={o.id} order={o} />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function OrderHistoryCard({ order }: { order: Order }) {
  const items: OrderItem[] = Array.isArray(order.items) ? order.items : JSON.parse(order.items as unknown as string)
  return (
    <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: '#86EFAC', border: '2px solid #4ADE80' }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-black tracking-tight text-gray-900">{order.numero_orden}</span>
          <span className="text-sm px-2 py-0.5 rounded-full font-bold text-gray-900" style={{ backgroundColor: 'rgba(0,0,0,0.10)' }}>
            {order.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recoger'}
          </span>
          {order.canal === 'telefono' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
              📞 Teléfono
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-black leading-none text-gray-900">${order.total.toFixed(0)}</p>
          <p className="text-sm font-semibold mt-0.5 text-gray-700">{formatDate(order.created_at)}</p>
        </div>
      </div>

      <div className="pt-3 space-y-2" style={{ borderTop: '2px solid rgba(0,0,0,0.10)' }}>
        {items.map((item, idx) => (
          <div key={idx}>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black leading-none text-gray-900">{item.quantity}×</span>
              <span className="text-xl font-bold leading-tight text-gray-900">{item.nombre}</span>
            </div>
            {item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0 && (
              <p className="text-sm font-semibold ml-10 mt-0.5 text-gray-700">{item.variantes_seleccionadas.join(' · ')}</p>
            )}
            {item.extras_seleccionados && item.extras_seleccionados.length > 0 && (
              <p className="text-sm font-semibold ml-10 mt-0.5 text-gray-700">
                + {item.extras_seleccionados.map(e => e.cantidad > 1 ? `${e.cantidad} ${e.nombre}` : e.nombre).join(', ')}
              </p>
            )}
            {item.toppings && item.toppings.length > 0 && (
              <p className="text-sm font-semibold ml-10 mt-0.5 text-gray-700">+ {item.toppings.map(t => t.nombre).join(', ')}</p>
            )}
            {item.nota && <p className="text-sm italic ml-10 mt-0.5 text-gray-700">"{item.nota}"</p>}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-gray-700">
        {order.costo_envio > 0 && <span>Envío ${order.costo_envio.toFixed(2)}</span>}
        {(order.monto_descuento ?? 0) > 0 && (
          <span className="text-green-700">Dto. {order.codigo_descuento} -${Number(order.monto_descuento).toFixed(2)}</span>
        )}
        <span>Paga ${order.monto_pago.toFixed(2)}</span>
        {order.cambio > 0 && <span className="font-black">Cambio ${order.cambio.toFixed(2)}</span>}
      </div>

      {order.indicaciones && (
        <p className="text-sm italic mt-2 text-gray-700">📝 {order.indicaciones}</p>
      )}
    </div>
  )
}
