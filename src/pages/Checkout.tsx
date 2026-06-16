import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import type { DeliveryType, OrderItem } from '../lib/types'

export default function Checkout() {
  const { items, restaurant, total, clearCart } = useCart()
  const { customer } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const deliveryTypeFromCart = (location.state as { deliveryType?: DeliveryType })?.deliveryType ?? 'pickup'

  const [form, setForm] = useState({
    nombre: customer?.nombre ?? '',
    telefono: customer?.telefono ?? '',
    direccion: '',
    establecimiento: '',
    piso: 'No aplica',
    despacho: '',
    indicaciones: '',
    monto_pago: '',
  })
  const [deliveryType] = useState<DeliveryType>(deliveryTypeFromCart)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)

  useEffect(() => {
    if (items.length === 0) navigate('/menu/mi-tierra')
  }, [items.length, navigate])

  const costoPorPlatillo = restaurant?.costo_envio_por_platillo ?? 0
  const dishCount = items.reduce((sum, it) => sum + it.quantity, 0)
  const deliveryCost = deliveryType === 'domicilio' ? costoPorPlatillo * dishCount : 0
  const orderTotal = total + deliveryCost
  const montoPago = parseFloat(form.monto_pago) || 0
  const cambio = Math.max(0, montoPago - orderTotal)
  const isExact = form.monto_pago !== '' && montoPago > 0 && montoPago === orderTotal
  const belowTotal = form.monto_pago !== '' && montoPago > 0 && montoPago < orderTotal

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!/^\d{10}$/.test(form.telefono)) {
      errs.telefono = 'Ingresa un número celular válido de 10 dígitos'
    }
    if (deliveryType === 'domicilio') {
      if (!form.direccion.trim()) errs.direccion = 'La dirección es requerida'
      if (!form.establecimiento.trim()) errs.establecimiento = 'El establecimiento o referencia es requerido'
    }
    if (!form.monto_pago) {
      errs.monto_pago = 'Ingresa el monto de pago'
    } else if (montoPago < orderTotal) {
      errs.monto_pago = 'El monto debe ser mayor o igual al total'
    }
    return errs
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return
    setConfirmModal(true)
  }

  const doInsert = async () => {
    setLoading(true)

    const { data: lastOrder } = await supabase
      .from('orders')
      .select('numero_orden')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextNum = 1
    if (lastOrder?.numero_orden) {
      const match = lastOrder.numero_orden.match(/(\d+)$/)
      if (match) nextNum = parseInt(match[1]) + 1
    }
    const numero_orden = `ORD-${String(nextNum).padStart(3, '0')}`

    const orderItems: OrderItem[] = items.map(item => {
      const variantSuffix = item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0
        ? ` (${item.variantes_seleccionadas.join(', ')})`
        : ''
      return {
        dish_id: item.dish.id,
        nombre: item.dish.nombre + variantSuffix,
        precio: item.dish.precio + (item.variantes_precio ?? 0),
        quantity: item.quantity,
        toppings: [],
        nota: item.nota,
        variantes_seleccionadas: item.variantes_seleccionadas,
        extras_seleccionados: item.extras_seleccionados,
        variantes_precio: item.variantes_precio,
      }
    })

    const { data: order, error: dbError } = await supabase.from('orders').insert({
      numero_orden,
      restaurant_id: '1b991239-7915-4106-b883-8b50897682f8',
      customer_email: customer?.email ?? '',
      customer_nombre: form.nombre,
      customer_telefono: form.telefono,
      delivery_type: deliveryType,
      direccion: form.direccion,
      establecimiento: form.establecimiento,
      piso: form.piso,
      despacho: form.despacho,
      indicaciones: form.indicaciones,
      items: JSON.stringify(orderItems),
      subtotal: total,
      costo_envio: deliveryCost,
      total: orderTotal,
      monto_pago: montoPago,
      cambio,
      status: 'Nuevo',
    }).select().single()

    setLoading(false)
    if (dbError || !order) {
      console.error('Order insert error:', dbError)
      setConfirmModal(false)
      setError('Error al enviar el pedido. Intenta de nuevo.')
      return
    }

    const saved = JSON.parse(localStorage.getItem('yalo_mis_pedidos') || '[]')
    saved.unshift(numero_orden)
    localStorage.setItem('yalo_mis_pedidos', JSON.stringify(saved.slice(0, 20)))

    clearCart()
    navigate('/confirmacion', { state: { order } })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-[#1A6B3C] text-white px-4 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white">←</button>
          <h1 className="font-bold text-lg">Checkout</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Contact */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
          <h2 className="font-bold text-gray-900">Datos de contacto</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              required
              placeholder="Juan Pérez"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (10 dígitos)</label>
            <input
              value={form.telefono}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                setForm(f => ({ ...f, telefono: val }))
                if (submitted) setFieldErrors(prev => ({
                  ...prev,
                  telefono: /^\d{10}$/.test(val) ? '' : 'Ingresa un número celular válido de 10 dígitos',
                }))
              }}
              required
              placeholder="5512345678"
              maxLength={10}
              inputMode="numeric"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none ${fieldErrors.telefono ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#1A6B3C]'}`}
            />
            {fieldErrors.telefono && <p className="text-red-500 text-xs mt-1">{fieldErrors.telefono}</p>}
          </div>
        </div>

        {/* Address (domicilio only) */}
        {deliveryType === 'domicilio' && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="font-bold text-gray-900">Dirección de entrega</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección <span className="text-red-400">*</span></label>
              <input
                value={form.direccion}
                onChange={e => {
                  setForm(f => ({ ...f, direccion: e.target.value }))
                  if (submitted) setFieldErrors(prev => ({
                    ...prev,
                    direccion: e.target.value.trim() ? '' : 'La dirección es requerida',
                  }))
                }}
                placeholder="Av. Reforma 123"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none ${fieldErrors.direccion ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#1A6B3C]'}`}
              />
              {fieldErrors.direccion && <p className="text-red-500 text-xs mt-1">{fieldErrors.direccion}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Establecimiento o referencia <span className="text-red-400">*</span></label>
              <input
                value={form.establecimiento}
                onChange={e => {
                  setForm(f => ({ ...f, establecimiento: e.target.value }))
                  if (submitted) setFieldErrors(prev => ({
                    ...prev,
                    establecimiento: e.target.value.trim() ? '' : 'El establecimiento o referencia es requerido',
                  }))
                }}
                placeholder="Torre A, Edificio El Pino..."
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none ${fieldErrors.establecimiento ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#1A6B3C]'}`}
              />
              {fieldErrors.establecimiento && <p className="text-red-500 text-xs mt-1">{fieldErrors.establecimiento}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Piso / Interior</label>
              <input value={form.piso} onChange={e => setForm(f => ({ ...f, piso: e.target.value }))} placeholder="No aplica" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Despacho</label>
              <input value={form.despacho} onChange={e => setForm(f => ({ ...f, despacho: e.target.value }))} placeholder="Depto. 4B..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Indicaciones adicionales</label>
              <textarea value={form.indicaciones} onChange={e => setForm(f => ({ ...f, indicaciones: e.target.value }))} placeholder="Tocar el timbre 2 veces..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none h-16 focus:outline-none focus:border-[#1A6B3C]" />
            </div>
          </div>
        )}

        {/* Payment */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
          <h2 className="font-bold text-gray-900">Pago</h2>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-xl">💵</span>
            <div>
              <p className="font-medium text-gray-800 text-sm">Efectivo al entregar</p>
              <p className="text-xs text-gray-500">Pago en efectivo contra entrega</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿Con cuánto va a pagar? <span className="text-red-400">*</span></label>
            <input
              type="number"
              value={form.monto_pago}
              onChange={e => {
                setForm(f => ({ ...f, monto_pago: e.target.value }))
                if (submitted) {
                  const val = parseFloat(e.target.value) || 0
                  setFieldErrors(prev => ({
                    ...prev,
                    monto_pago: !e.target.value ? 'Ingresa el monto de pago' : val < orderTotal ? 'El monto debe ser mayor o igual al total' : '',
                  }))
                }
              }}
              min={orderTotal}
              step="1"
              placeholder={`Mínimo $${orderTotal.toFixed(2)}`}
              className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none ${fieldErrors.monto_pago ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#1A6B3C]'}`}
            />
            {fieldErrors.monto_pago && <p className="text-red-500 text-xs mt-1">{fieldErrors.monto_pago}</p>}
            {isExact && <p className="text-sm text-[#1A6B3C] font-medium mt-1.5">Pago exacto ✓</p>}
            {!isExact && montoPago > orderTotal && montoPago > 0 && (
              <p className="text-sm text-[#1A6B3C] font-medium mt-1.5">
                Cambio estimado: <span className="font-bold">${cambio.toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-bold text-gray-900 mb-3">Resumen del pedido</h2>
          <div className="space-y-2 mb-3">
            {items.map((item, idx) => {
              const extrasCost = (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
              return (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.quantity}× {item.dish.nombre}{item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0 ? ` (${item.variantes_seleccionadas.join(', ')})` : ''}</span>
                  <span className="text-gray-900 font-medium">${((item.dish.precio + (item.variantes_precio ?? 0)) * item.quantity + extrasCost).toFixed(2)}</span>
                </div>
              )
            })}
          </div>
          <div className="border-t border-gray-100 pt-2 space-y-1">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
            {deliveryType === 'pickup' ? (
              <div className="flex justify-between text-sm text-gray-600"><span>Recoger en local</span><span>Gratis</span></div>
            ) : costoPorPlatillo > 0 ? (
              <div className="flex justify-between text-sm text-gray-600">
                <span className="text-gray-500">Envío: ${costoPorPlatillo} × {dishCount} platillo{dishCount !== 1 ? 's' : ''}</span>
                <span>${deliveryCost.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-sm text-gray-600"><span>Envío</span><span>Gratis</span></div>
            )}
            <div className="flex justify-between font-bold text-gray-900 pt-1"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || belowTotal}
          className="w-full bg-[#1A6B3C] text-white py-4 rounded-xl font-bold text-base hover:bg-[#155a32] disabled:opacity-60 transition-colors"
        >
          {loading ? 'Enviando pedido...' : `Confirmar pedido · $${orderTotal.toFixed(2)}`}
        </button>
      </form>

      {/* Confirmation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:px-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">¿Confirmas tu pedido?</h3>

            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {items.map((item, idx) => {
                const extrasCost = (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
                return (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.quantity}× {item.dish.nombre}{item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0 ? ` (${item.variantes_seleccionadas.join(', ')})` : ''}</span>
                    <span className="font-medium text-gray-900">${(item.dish.precio * item.quantity + extrasCost).toFixed(2)}</span>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-1">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
              {deliveryCost > 0 && costoPorPlatillo > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Envío: ${costoPorPlatillo} × {dishCount} platillo{dishCount !== 1 ? 's' : ''}</span>
                  <span>${deliveryCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 pt-1"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1 text-sm text-gray-700">
              <p>{deliveryType === 'pickup' ? '🏪 Recoger en local' : '🛵 Entrega a domicilio'}</p>
              <p>💵 Pagas con: <span className="font-semibold">${montoPago.toFixed(2)}</span>{cambio > 0 ? ` · Cambio: $${cambio.toFixed(2)}` : ' · Pago exacto ✓'}</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmModal(false)}
                disabled={loading}
                className="flex-1 border border-gray-200 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Revisar de nuevo
              </button>
              <button
                onClick={doInsert}
                disabled={loading}
                className="flex-1 bg-[#1A6B3C] text-white py-3 rounded-xl text-sm font-bold hover:bg-[#155a32] disabled:opacity-60"
              >
                {loading ? 'Enviando...' : 'Sí, confirmar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
