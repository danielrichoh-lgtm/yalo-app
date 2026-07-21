import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Order, OrderItem, OrderStatus, Restaurant } from '../../../lib/types'

interface CardColors {
  bg: string
  borderColor: string
  textColor: string
  subColor: string
  mutedBg: string
}

const COLORS: Record<string, CardColors> = {
  nuevo:     { bg: '#FDE047', borderColor: '#FACC15', textColor: '#111827', subColor: '#374151', mutedBg: 'rgba(0,0,0,0.10)' },
  active:    { bg: '#FB923C', borderColor: '#EA7722', textColor: '#ffffff', subColor: 'rgba(255,255,255,0.85)', mutedBg: 'rgba(255,255,255,0.20)' },
  entregado: { bg: '#86EFAC', borderColor: '#4ADE80', textColor: '#111827', subColor: '#374151', mutedBg: 'rgba(0,0,0,0.10)' },
  cancelado: { bg: '#F3F4F6', borderColor: '#D1D5DB', textColor: '#6B7280', subColor: '#9CA3AF', mutedBg: 'rgba(0,0,0,0.06)' },
}

function getColors(status: OrderStatus): CardColors {
  if (status === 'Nuevo') return COLORS.nuevo
  if (status === 'En proceso') return COLORS.active
  if (status === 'Entregado') return COLORS.entregado
  return COLORS.cancelado
}

// AudioContext singleton — persists for the full browser session once created
let alertCtx: AudioContext | null = null

function getOrCreateCtx(): AudioContext | null {
  try {
    if (!alertCtx || alertCtx.state === 'closed') alertCtx = new AudioContext()
    return alertCtx
  } catch { return null }
}

async function ensureResumed(): Promise<AudioContext | null> {
  const ctx = getOrCreateCtx()
  if (!ctx) return null
  if (ctx.state === 'suspended') {
    try { await ctx.resume() } catch { return null }
  }
  return ctx
}

function scheduleTones(ctx: AudioContext) {
  const pairs = [{ t: 0, freq: 1046 }, { t: 0.18, freq: 740 }]
  pairs.forEach(({ t, freq }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.15, ctx.currentTime + t)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.16)
    osc.start(ctx.currentTime + t)
    osc.stop(ctx.currentTime + t + 0.16)
  })
}

async function playAlertTone() {
  const ctx = await ensureResumed()
  if (ctx) scheduleTones(ctx)
}

function elapsedLabel(createdAt: string, now: number): string {
  const mins = Math.floor((now - new Date(createdAt).getTime()) / 60_000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

function printOrder(order: Order): void {
  const items: OrderItem[] = Array.isArray(order.items)
    ? order.items
    : JSON.parse(order.items as unknown as string)

  const date = new Date(order.created_at)
  const tz = 'America/Monterrey'
  const dateStr = date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz })

  const dash = `<div style="border-top:1px dashed #000;margin:6px 0;"></div>`
  const solid = `<div style="border-top:2px solid #000;margin:6px 0;"></div>`

  const addrLines: string[] = []
  if (order.calle) {
    if (order.identificador_lugar) addrLines.push(`&#127968; ${order.identificador_lugar}`)
    addrLines.push(order.calle + (order.interior_depto ? ', ' + order.interior_depto : ''))
    if (order.piso_despacho) addrLines.push(`${order.piso_despacho}`)
    const colMun = [order.colonia ? `Col. ${order.colonia}` : '', order.municipio ?? ''].filter(Boolean).join(', ')
    if (colMun) addrLines.push(colMun)
    if (order.referencias) addrLines.push(`Ref: ${order.referencias}`)
    if (order.indicaciones) addrLines.push(`Notas: ${order.indicaciones}`)
  } else if (order.direccion) {
    const parts = [order.establecimiento, order.direccion, order.piso !== 'No aplica' ? order.piso : '', order.despacho].filter(Boolean)
    addrLines.push(parts.join(', '))
  }

  const itemsHtml = items.map(item => {
    const variants = item.variantes_seleccionadas?.length
      ? `<div style="font-size:8pt;color:#333;word-break:break-word;">&#8226; ${item.variantes_seleccionadas.join(' · ')}</div>` : ''
    const extras = item.extras_seleccionados?.length
      ? `<div style="font-size:8pt;color:#333;word-break:break-word;">+ ${item.extras_seleccionados.map(e => (e.cantidad > 1 ? `${e.cantidad} ${e.nombre}` : e.nombre)).join(', ')}</div>` : ''
    const toppings = item.toppings?.length
      ? `<div style="font-size:8pt;color:#333;word-break:break-word;">+ ${item.toppings.map(t => t.nombre).join(', ')}</div>` : ''
    const nota = item.nota
      ? `<div style="font-size:7pt;font-style:italic;color:#555;word-break:break-word;">"${item.nota}"</div>` : ''
    return `
      <div style="text-align:center;margin-bottom:6px;">
        <div style="font-size:11pt;font-weight:900;word-break:break-word;line-height:1.2;">${item.quantity}&times; ${item.nombre}</div>
        ${variants}${extras}${toppings}${nota}
      </div>`
  }).join('')

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:9pt;width:50mm;max-width:50mm;margin:0 auto;padding:0;color:#000;background:#fff;box-sizing:border-box;">
  <div style="text-align:center;margin-bottom:3px;">
    <div style="font-size:8pt;font-weight:900;">RESTAURANTE</div>
    <div style="font-size:12pt;font-weight:900;">MI TIERRA</div>
  </div>
  ${solid}
  <div style="text-align:center;margin:2px 0 3px;">
    <div style="font-size:18pt;font-weight:900;word-break:break-all;">${order.numero_orden}</div>
    <div style="font-size:7pt;font-weight:900;border:1.5px solid #000;padding:1px 6px;margin-top:2px;display:inline-block;word-break:break-word;">
      ${order.delivery_type === 'domicilio' ? 'ENTREGA A DOMICILIO' : 'RECOGER EN LOCAL'}
    </div>
  </div>
  ${solid}
  <div style="text-align:center;margin-bottom:4px;">
    <div style="font-size:11pt;font-weight:900;word-break:break-word;">${order.customer_nombre}</div>
    <div style="font-size:10pt;font-weight:700;word-break:break-word;">Tel: ${order.customer_telefono}</div>
    <div style="font-size:8pt;color:#555;">${dateStr}</div>
  </div>
  ${order.delivery_type === 'domicilio' && addrLines.length > 0 ? `
  ${solid}
  <div style="text-align:center;margin-bottom:5px;">
    <div style="font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">&#9660; Direcci&#243;n de entrega &#9660;</div>
    ${addrLines.map(l => `<div style="font-size:14pt;font-weight:900;word-break:break-word;overflow-wrap:break-word;line-height:1.25;margin-bottom:2px;">${l}</div>`).join('')}
  </div>` : ''}
  ${solid}
  <div style="text-align:center;margin-bottom:5px;">
    ${itemsHtml}
  </div>
  ${solid}
  <div style="text-align:center;font-size:9pt;margin-bottom:4px;">
    <div>Subtotal: $${order.subtotal.toFixed(2)}</div>
    ${order.costo_envio > 0 ? `<div>Env&#237;o: $${order.costo_envio.toFixed(2)}</div>` : ''}
    ${(order.monto_descuento ?? 0) > 0 ? `<div>Descuento (${order.codigo_descuento ?? ''}): -$${Number(order.monto_descuento).toFixed(2)}</div>` : ''}
    <div style="font-size:15pt;font-weight:900;border-top:2px solid #000;margin-top:3px;padding-top:2px;">TOTAL: $${order.total.toFixed(2)}</div>
  </div>
  ${dash}
  <div style="text-align:center;font-size:9pt;">
    <div>&#191;Con cu&#225;nto paga? <b>$${order.monto_pago.toFixed(2)}</b></div>
    ${order.cambio > 0
      ? `<div style="font-weight:900;font-size:10pt;">Su cambio: $${order.cambio.toFixed(2)}</div>`
      : `<div style="font-style:italic;color:#555;font-size:8pt;">Pago exacto &#10003;</div>`}
  </div>
</div>`

  let el = document.getElementById('print-ticket')
  if (!el) {
    el = document.createElement('div')
    el.id = 'print-ticket'
    document.body.appendChild(el)
  }
  el.innerHTML = html
  window.print()
}

interface Props { restaurant: Restaurant }

export default function PedidosTab({ restaurant }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const knownIds = useRef<Set<string>>(new Set())
  const alertInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const unlockAudio = useCallback(async () => {
    const ctx = getOrCreateCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') await ctx.resume()
    scheduleTones(ctx)
    setAudioUnlocked(true)
  }, [])

  // Re-resume the context on any user interaction so it never stays suspended
  useEffect(() => {
    if (!audioUnlocked) return
    const resume = () => {
      const ctx = getOrCreateCtx()
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') resume() }
    document.addEventListener('click', resume)
    document.addEventListener('touchstart', resume)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('click', resume)
      document.removeEventListener('touchstart', resume)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [audioUnlocked])

  const hasNuevo = orders.some(o => o.status === 'Nuevo')

  useEffect(() => {
    if (alertInterval.current) { clearInterval(alertInterval.current); alertInterval.current = null }
    if (!hasNuevo || !audioUnlocked) return
    // Play immediately, then every 4 s — each call resumes the context first
    playAlertTone()
    alertInterval.current = setInterval(() => { playAlertTone() }, 4000)
    return () => {
      if (alertInterval.current) { clearInterval(alertInterval.current); alertInterval.current = null }
    }
  }, [hasNuevo, audioUnlocked])

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('archivado', false)
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, payload => {
        const order = payload.new as Order
        if (!knownIds.current.has(order.id)) {
          knownIds.current.add(order.id)
          setOrders(prev => [order, ...prev])
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, payload => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, payload => {
        setOrders(prev => prev.filter(o => o.id !== payload.old.id))
      })
      .subscribe()

    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => { supabase.removeChannel(channel); clearInterval(timer) }
  }, [fetchOrders])

  const updateStatus = async (id: string, status: OrderStatus) => {
    await supabase.from('orders').update({ status }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  const deleteOrder = async (id: string) => {
    await supabase.from('orders').delete().eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  const limpiarVista = async () => {
    const ids = orders
      .filter(o => o.status === 'Entregado' || o.status === 'Cancelado')
      .map(o => o.id)
    if (ids.length === 0) return
    await supabase.from('orders').update({ archivado: true }).in('id', ids)
    setOrders(prev => prev.filter(o => !ids.includes(o.id)))
  }

  const [confirmLimpiar, setConfirmLimpiar] = useState(false)

  const nuevo = orders.filter(o => o.status === 'Nuevo')
  const enProceso = orders.filter(o => o.status === 'En proceso')
  const entregados = orders.filter(o => o.status === 'Entregado')
  const cancelados = orders.filter(o => o.status === 'Cancelado')
  const [canceladosOpen, setCanceladosOpen] = useState(false)

  return (
    <div className="space-y-4">

      {/* Top bar: sound + limpiar */}
      <div className="flex items-center gap-2">
        {!audioUnlocked ? (
          <button
            onClick={unlockAudio}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-base shadow-sm"
            style={{ backgroundColor: '#FEF9C3', color: '#713F12', border: '2px solid #FDE047' }}
          >
            🔔 Activar alertas de sonido
          </button>
        ) : hasNuevo ? (
          <div
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-sm"
            style={{ backgroundColor: '#FEF9C3', color: '#713F12', border: '2px solid #FDE047' }}
          >
            🔔 Sonido activo — alertando nuevos pedidos
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <button
          onClick={() => setConfirmLimpiar(true)}
          className="shrink-0 text-sm font-semibold px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          🧹 Limpiar vista
        </button>
      </div>

      {/* NUEVOS */}
      {nuevo.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-lg">
            <span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse inline-block" />
            NUEVOS ({nuevo.length})
          </h2>
          <div className="space-y-3">
            {nuevo.map(order => (
              <OrderCard key={order.id} order={order} now={now}
                onAccept={async () => { await updateStatus(order.id, 'En proceso'); printOrder(order) }}
                onDecline={() => updateStatus(order.id, 'Cancelado')} />
            ))}
          </div>
        </section>
      )}

      {/* EN PROCESO */}
      {enProceso.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-900 mb-3 text-lg">En proceso ({enProceso.length})</h2>
          <div className="space-y-3">
            {enProceso.map(order => (
              <OrderCard key={order.id} order={order} now={now}
                onCancel={() => updateStatus(order.id, 'Cancelado')}
              >
                <div className="mt-4">
                  <button
                    onClick={() => updateStatus(order.id, 'Entregado')}
                    style={{ backgroundColor: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.5)', color: '#fff' }}
                    className="font-bold text-base px-5 py-2.5 rounded-xl active:scale-95 transition-transform w-full"
                  >
                    Marcar como Entregado ✓
                  </button>
                </div>
              </OrderCard>
            ))}
          </div>
        </section>
      )}

      {/* ENTREGADOS */}
      {entregados.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-500 mb-3 text-lg">Entregados ({entregados.length})</h2>
          <div className="space-y-3">
            {entregados.map(order => (
              <OrderCard key={order.id} order={order} now={now}>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm px-3 py-1.5 rounded-xl font-bold"
                    style={{ backgroundColor: 'rgba(0,0,0,0.12)', color: '#166534' }}>
                    Entregado ✓
                  </span>
                  <button onClick={() => deleteOrder(order.id)} className="text-sm ml-auto font-medium" style={{ color: '#6B7280' }}>
                    Eliminar
                  </button>
                </div>
              </OrderCard>
            ))}
          </div>
        </section>
      )}

      {/* CANCELADOS */}
      {cancelados.length > 0 && (
        <section>
          <button
            onClick={() => setCanceladosOpen(o => !o)}
            className="w-full flex items-center justify-between mb-3"
          >
            <h2 className="font-bold text-gray-400 text-lg">Cancelados ({cancelados.length})</h2>
            <span className="text-gray-400 text-xl leading-none">{canceladosOpen ? '▲' : '▼'}</span>
          </button>
          {canceladosOpen && (
            <div className="space-y-3">
              {cancelados.map(order => (
                <OrderCard key={order.id} order={order} now={now} />
              ))}
            </div>
          )}
        </section>
      )}

      {orders.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">🍽</p>
          <p className="text-lg">No hay pedidos aún</p>
        </div>
      )}

      {confirmLimpiar && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:px-4" onClick={() => setConfirmLimpiar(false)}>
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900 text-lg leading-snug">¿Limpiar la vista?</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Los pedidos entregados y cancelados se ocultarán del tablero, pero seguirán guardados en tu historial y métricas.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmLimpiar(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-base border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => { setConfirmLimpiar(false); await limpiarVista() }}
                className="flex-1 py-3 rounded-xl font-bold text-base text-white bg-[#1A6B3C] hover:bg-[#155a32] transition-colors"
              >
                Sí, limpiar
              </button>
            </div>
          </div>
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
  onCancel?: () => void
  children?: React.ReactNode
}

function OrderCard({ order, now, onAccept, onDecline, onCancel, children }: CardProps) {
  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items as unknown as string)
  const isLate = order.status === 'Nuevo' && (now - new Date(order.created_at).getTime()) > 10 * 60_000
  const c = getColors(order.status)
  const elapsed = elapsedLabel(order.created_at, now)
  const [confirmingDecline, setConfirmingDecline] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  return (
    <div className="rounded-2xl p-4 shadow-md" style={{ backgroundColor: c.bg, border: `2px solid ${c.borderColor}` }}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-black tracking-tight" style={{ color: c.textColor }}>
            {order.numero_orden}
          </span>
          <span className="text-sm px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: c.mutedBg, color: c.textColor }}>
            {order.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recoger'}
          </span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-black leading-none" style={{ color: c.textColor }}>
            ${order.total.toFixed(0)}
          </p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: isLate ? '#DC2626' : c.subColor, fontWeight: isLate ? 900 : undefined }}>
            {isLate ? `⚠ ${elapsed}` : elapsed}
          </p>
        </div>
      </div>

      {/* Customer */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-base font-bold" style={{ color: c.textColor }}>{order.customer_nombre}</span>
        <a href={`tel:+52${order.customer_telefono}`} className="text-sm font-bold underline underline-offset-2" style={{ color: c.textColor, opacity: 0.75 }}>
          📞 {order.customer_telefono}
        </a>
      </div>

      {/* Address */}
      {order.delivery_type === 'domicilio' && (
        <div className="mb-3">
          {order.calle ? (
            <div className="text-sm font-semibold space-y-0.5" style={{ color: c.textColor, opacity: 0.9 }}>
              <p>📍 {[order.calle, order.interior_depto].filter(Boolean).join(', ')}</p>
              {order.piso_despacho && <p style={{ opacity: 0.9 }}>📌 {order.piso_despacho}</p>}
              {order.identificador_lugar && <p style={{ opacity: 1 }}>🏠 {order.identificador_lugar}</p>}
              <p style={{ opacity: 0.85 }}>Col. {order.colonia}{order.municipio ? `, ${order.municipio}` : ''}</p>
              {order.referencias && <p style={{ opacity: 0.75 }}>🗺 {order.referencias}</p>}
            </div>
          ) : order.direccion ? (
            <p className="text-sm font-semibold mb-0" style={{ color: c.textColor, opacity: 0.85 }}>
              📍 {[order.establecimiento, order.direccion, order.piso !== 'No aplica' ? order.piso : '', order.despacho].filter(Boolean).join(', ')}
            </p>
          ) : null}
        </div>
      )}

      {/* Items */}
      <div className="pt-3 space-y-2" style={{ borderTop: `2px solid rgba(0,0,0,0.10)` }}>
        {items.map((item: {
          nombre: string; quantity: number
          variantes_seleccionadas?: string[]
          extras_seleccionados?: { nombre: string; precio: number; cantidad: number }[]
          toppings?: { nombre: string; quantity: number }[]
          nota?: string
        }, idx: number) => (
          <div key={idx}>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black leading-none" style={{ color: c.textColor }}>{item.quantity}×</span>
              <span className="text-xl font-bold leading-tight" style={{ color: c.textColor }}>{item.nombre}</span>
            </div>
            {item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0 && (
              <p className="text-sm font-semibold ml-10 mt-0.5" style={{ color: c.subColor }}>{item.variantes_seleccionadas.join(' · ')}</p>
            )}
            {item.extras_seleccionados && item.extras_seleccionados.length > 0 && (
              <p className="text-sm font-semibold ml-10 mt-0.5" style={{ color: c.subColor }}>
                + {item.extras_seleccionados.map(e => e.cantidad > 1 ? `${e.cantidad} ${e.nombre}` : e.nombre).join(', ')}
              </p>
            )}
            {item.toppings && item.toppings.length > 0 && (
              <p className="text-sm font-semibold ml-10 mt-0.5" style={{ color: c.subColor }}>+ {item.toppings.map(t => t.nombre).join(', ')}</p>
            )}
            {item.nota && <p className="text-sm italic ml-10 mt-0.5" style={{ color: c.subColor }}>"{item.nota}"</p>}
          </div>
        ))}
      </div>

      {/* Payment summary */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold" style={{ color: c.subColor }}>
        {order.costo_envio > 0 && <span>Envío ${order.costo_envio.toFixed(2)}</span>}
        {(order.monto_descuento ?? 0) > 0 && (
          <span style={{ color: '#15803D' }}>Dto. {order.codigo_descuento} -${Number(order.monto_descuento).toFixed(2)}</span>
        )}
        <span>Paga ${order.monto_pago.toFixed(2)}</span>
        {order.cambio > 0 && <span className="font-black">Cambio ${order.cambio.toFixed(2)}</span>}
      </div>

      {order.indicaciones && (
        <p className="text-sm italic mt-2" style={{ color: c.subColor }}>📝 {order.indicaciones}</p>
      )}

      {/* Accept / Decline */}
      {onAccept && onDecline && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 text-white text-lg font-black py-3 rounded-xl active:scale-95 transition-transform shadow-md"
            style={{ backgroundColor: '#15803D' }}
          >
            ✓ Aceptar
          </button>
          <button
            onClick={() => setConfirmingDecline(true)}
            className="flex-1 text-white text-lg font-black py-3 rounded-xl active:scale-95 transition-transform shadow-md"
            style={{ backgroundColor: '#DC2626' }}
          >
            ✕ Declinar
          </button>
        </div>
      )}

      {confirmingDecline && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:px-4" onClick={() => setConfirmingDecline(false)}>
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900 text-lg leading-snug">¿Seguro que quieres declinar este pedido?</h3>
            <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmingDecline(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-base border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setConfirmingDecline(false); onDecline?.() }}
                className="flex-1 py-3 rounded-xl font-bold text-base text-white transition-colors"
                style={{ backgroundColor: '#DC2626' }}
              >
                Sí, declinar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingCancel && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:px-4" onClick={() => setConfirmingCancel(false)}>
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900 text-lg leading-snug">¿Cancelar este pedido?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">La comanda ya se imprimió — verifica con cocina antes de cancelar. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmingCancel(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-base border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                No, regresar
              </button>
              <button
                onClick={() => { setConfirmingCancel(false); onCancel?.() }}
                className="flex-1 py-3 rounded-xl font-bold text-base text-white transition-colors"
                style={{ backgroundColor: '#DC2626' }}
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual print fallback */}
      <button
        onClick={() => printOrder(order)}
        className="mt-3 w-full py-2.5 rounded-xl font-bold text-sm text-center active:scale-95 transition-transform"
        style={{ backgroundColor: '#1f2937', color: '#ffffff' }}
      >
        🖨 Imprimir comanda
      </button>
      {children}
      {onCancel && (
        <button
          onClick={() => setConfirmingCancel(true)}
          className="mt-2 w-full py-2 rounded-xl text-sm font-semibold transition-colors active:scale-95"
          style={{ backgroundColor: 'rgba(220,38,38,0.10)', color: '#B91C1C', border: '1.5px solid rgba(220,38,38,0.25)' }}
        >
          Cancelar pedido
        </button>
      )}
    </div>
  )
}
