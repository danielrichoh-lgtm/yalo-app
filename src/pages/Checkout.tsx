import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import type { DeliveryType, OrderItem } from '../lib/types'

export default function Checkout() {
  const { items, restaurant, total, clearCart } = useCart()
  const { customer, setCustomer } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const deliveryTypeFromCart = (location.state as { deliveryType?: DeliveryType })?.deliveryType ?? 'pickup'

  const [form, setForm] = useState({
    nombre: customer?.nombre ?? '',
    telefono: customer?.telefono_guardado || customer?.telefono || '',
    calle: customer?.calle ?? '',
    interior_depto: customer?.interior_depto ?? '',
    identificador_lugar: '',
    colonia: customer?.colonia ?? '',
    municipio: customer?.municipio ?? '',
    referencias: customer?.referencias ?? '',
    indicaciones: '',
    monto_pago: '',
  })
  const [deliveryType] = useState<DeliveryType>(deliveryTypeFromCart)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)
  const orderConfirmed = useRef(false)

  useEffect(() => {
    if (!customer) return
    const prefillAddress = async () => {
      const { data } = await supabase
        .from('orders')
        .select('calle, interior_depto, identificador_lugar, colonia, municipio, referencias, indicaciones')
        .eq('customer_email', customer.email)
        .eq('delivery_type', 'domicilio')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!data) return
      setForm(f => ({
        ...f,
        calle: f.calle || data.calle || '',
        interior_depto: f.interior_depto || data.interior_depto || '',
        identificador_lugar: f.identificador_lugar || data.identificador_lugar || '',
        colonia: f.colonia || data.colonia || '',
        municipio: f.municipio || data.municipio || '',
        referencias: f.referencias || data.referencias || '',
        indicaciones: f.indicaciones || data.indicaciones || '',
      }))
    }
    prefillAddress()
  }, [customer?.email])

  useEffect(() => {
    if (items.length === 0 && !orderConfirmed.current) {
      navigate('/menu/mi-tierra')
    }
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
      if (!form.calle.trim()) errs.calle = 'La calle y número son requeridos'
      if (!form.identificador_lugar.trim()) errs.identificador_lugar = 'Este campo es requerido para el repartidor'
      if (!form.colonia.trim()) errs.colonia = 'La colonia es requerida'
      if (!form.municipio.trim()) errs.municipio = 'El municipio es requerido'
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

  const saveCustomerAddress = async () => {
    if (!customer) return
    const patch = {
      nombre: form.nombre,
      telefono_guardado: form.telefono,
      calle: form.calle,
      interior_depto: form.interior_depto,
      colonia: form.colonia,
      municipio: form.municipio,
      referencias: form.referencias,
    }
    const { data } = await supabase
      .from('customers')
      .update(patch)
      .eq('id', customer.id)
      .select()
      .single()
    if (data) {
      setCustomer({ ...customer, ...patch })
    }
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
      // new structured fields
      calle: form.calle,
      interior_depto: form.interior_depto,
      identificador_lugar: form.identificador_lugar,
      colonia: form.colonia,
      municipio: form.municipio,
      referencias: form.referencias,
      indicaciones: form.indicaciones,
      // legacy fields cleared for new orders
      direccion: '',
      establecimiento: '',
      piso: 'No aplica',
      despacho: '',
      items: JSON.stringify(orderItems),
      subtotal: total,
      costo_envio: deliveryCost,
      total: orderTotal,
      monto_pago: montoPago,
      cambio,
      status: 'Nuevo',
    }).select().single()

    if (dbError || !order) {
      console.error('Order insert error:', dbError)
      setLoading(false)
      setConfirmModal(false)
      setError('Error al enviar el pedido. Intenta de nuevo.')
      return
    }

    // Save address to customer profile in the background
    await saveCustomerAddress()

    const saved = JSON.parse(localStorage.getItem('yalo_mis_pedidos') || '[]')
    saved.unshift(numero_orden)
    localStorage.setItem('yalo_mis_pedidos', JSON.stringify(saved.slice(0, 20)))

    setLoading(false)
    orderConfirmed.current = true
    clearCart()
    navigate(`/pedido/confirmado/${order.id}`)
  }

  // Inline field updater with live validation
  const field = (
    name: keyof typeof form,
    label: string,
    opts?: {
      required?: boolean
      placeholder?: string
      inputMode?: 'numeric' | 'text'
      maxLength?: number
      type?: string
      autoComplete?: string
    }
  ) => {
    const val = form[name]
    const err = fieldErrors[name]
    return (
      <div>
        <label className="block text-base font-medium text-gray-700 mb-1">
          {label}
          {opts?.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
          type={opts?.type ?? 'text'}
          value={val}
          autoComplete={opts?.autoComplete}
          inputMode={opts?.inputMode}
          maxLength={opts?.maxLength}
          placeholder={opts?.placeholder}
          onChange={e => {
            let v = e.target.value
            if (opts?.inputMode === 'numeric') v = v.replace(/\D/g, '').slice(0, opts?.maxLength ?? 99)
            setForm(f => ({ ...f, [name]: v }))
            if (submitted && opts?.required) {
              setFieldErrors(prev => ({
                ...prev,
                [name]: v.trim() ? '' : `${label.replace(' *', '')} es requerido`,
              }))
            }
          }}
          className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none ${err ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#1A6B3C]'}`}
        />
        {err && <p className="text-red-500 text-sm mt-1">{err}</p>}
      </div>
    )
  }

  const addressSummary = deliveryType === 'domicilio'
    ? [form.calle, form.interior_depto, form.colonia, form.municipio].filter(Boolean).join(', ')
    : null

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
          <h2 className="font-bold text-gray-900 text-lg">Datos de contacto</h2>
          {field('nombre', 'Nombre completo', { required: true, placeholder: 'Juan Pérez', autoComplete: 'name' })}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-1">
              Teléfono (10 dígitos)<span className="text-red-400 ml-1">*</span>
            </label>
            <input
              value={form.telefono}
              inputMode="numeric"
              maxLength={10}
              placeholder="8112345678"
              autoComplete="tel"
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 10)
                setForm(f => ({ ...f, telefono: v }))
                if (submitted) setFieldErrors(prev => ({
                  ...prev,
                  telefono: /^\d{10}$/.test(v) ? '' : 'Ingresa un número celular válido de 10 dígitos',
                }))
              }}
              className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none ${fieldErrors.telefono ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#1A6B3C]'}`}
            />
            {fieldErrors.telefono && <p className="text-red-500 text-sm mt-1">{fieldErrors.telefono}</p>}
          </div>
        </div>

        {/* Delivery address — structured fields */}
        {deliveryType === 'domicilio' && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">Dirección de entrega</h2>
              {customer && (customer.calle || customer.colonia) && (
                <span className="text-xs text-[#1A6B3C] font-medium">Guardada ✓</span>
              )}
            </div>

            {field('calle', 'Calle y número', {
              required: true,
              placeholder: 'Av. Reforma 123',
              autoComplete: 'address-line1',
            })}
            {field('interior_depto', 'Interior / depto', {
              placeholder: 'Depto. 4B, Local 2...',
              autoComplete: 'address-line2',
            })}
            {field('identificador_lugar', 'Nombre del establecimiento o color de la casa', {
              required: true,
              placeholder: 'Casa azul, Farmacia Guadalajara, Edificio Torres...',
            })}
            {field('colonia', 'Colonia', {
              required: true,
              placeholder: 'Col. Centro',
            })}
            {field('municipio', 'Municipio', {
              required: true,
              placeholder: 'Monterrey',
            })}
            {field('referencias', 'Referencias (cruces, puntos de referencia)', {
              placeholder: 'Entre Juárez y Morelos, frente a la farmacia...',
            })}
            {field('indicaciones', 'Indicaciones adicionales al repartidor', {
              placeholder: 'Tocar el timbre, segundo piso...',
            })}
          </div>
        )}

        {/* Pickup — still capture indicaciones */}
        {deliveryType === 'pickup' && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-bold text-gray-900 text-lg mb-3">¿Alguna indicación?</h2>
            {field('indicaciones', 'Indicaciones (opcional)', {
              placeholder: 'Paso a recoger en 20 min...',
            })}
          </div>
        )}

        {/* Payment */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">Pago</h2>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-xl">💵</span>
            <div>
              <p className="font-medium text-gray-800 text-base">Efectivo al entregar</p>
              <p className="text-sm text-gray-500">Pago en efectivo contra entrega</p>
            </div>
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-1">
              ¿Con cuánto va a pagar?<span className="text-red-400 ml-1">*</span>
            </label>
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
              className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none ${fieldErrors.monto_pago ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#1A6B3C]'}`}
            />
            {fieldErrors.monto_pago && <p className="text-red-500 text-sm mt-1">{fieldErrors.monto_pago}</p>}
            {isExact && <p className="text-base text-[#1A6B3C] font-medium mt-1.5">Pago exacto ✓</p>}
            {!isExact && montoPago > orderTotal && montoPago > 0 && (
              <p className="text-base text-[#1A6B3C] font-medium mt-1.5">
                Cambio estimado: <span className="font-bold">${cambio.toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-bold text-gray-900 text-lg mb-3">Resumen del pedido</h2>
          <div className="space-y-2 mb-3">
            {items.map((item, idx) => {
              const extrasCost = (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
              return (
                <div key={idx} className="flex justify-between text-base">
                  <span className="text-gray-700 leading-snug">
                    {item.quantity}× {item.dish.nombre}
                    {item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0
                      ? ` (${item.variantes_seleccionadas.join(', ')})`
                      : ''}
                  </span>
                  <span className="text-gray-900 font-semibold ml-2 shrink-0">
                    ${((item.dish.precio + (item.variantes_precio ?? 0)) * item.quantity + extrasCost).toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="border-t border-gray-100 pt-2 space-y-1.5">
            <div className="flex justify-between text-base text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
            {deliveryType === 'pickup' ? (
              <div className="flex justify-between text-base text-gray-600"><span>Recoger en local</span><span>Gratis</span></div>
            ) : costoPorPlatillo > 0 ? (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Envío: ${costoPorPlatillo} × {dishCount} platillo{dishCount !== 1 ? 's' : ''}</span>
                <span>${deliveryCost.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-base text-gray-600"><span>Envío</span><span>Gratis</span></div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-lg pt-1"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
          </div>
        </div>

        {error && <p className="text-red-500 text-base text-center">{error}</p>}

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
                  <div key={idx} className="flex justify-between text-base">
                    <span className="text-gray-700 leading-snug">
                      {item.quantity}× {item.dish.nombre}
                      {item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0
                        ? ` (${item.variantes_seleccionadas.join(', ')})`
                        : ''}
                    </span>
                    <span className="font-medium text-gray-900 ml-2 shrink-0">
                      ${(item.dish.precio * item.quantity + extrasCost).toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <div className="flex justify-between text-base text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
              {deliveryCost > 0 && costoPorPlatillo > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Envío: ${costoPorPlatillo} × {dishCount} platillo{dishCount !== 1 ? 's' : ''}</span>
                  <span>${deliveryCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-lg pt-1"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1 text-base text-gray-700">
              <p>{deliveryType === 'pickup' ? '🏪 Recoger en local' : '🛵 Entrega a domicilio'}</p>
              {addressSummary && <p className="text-sm text-gray-500">{addressSummary}</p>}
              <p>💵 Pagas con: <span className="font-semibold">${montoPago.toFixed(2)}</span>{cambio > 0 ? ` · Cambio: $${cambio.toFixed(2)}` : ' · Pago exacto ✓'}</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmModal(false)}
                disabled={loading}
                className="flex-1 border border-gray-200 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Revisar de nuevo
              </button>
              <button
                onClick={doInsert}
                disabled={loading}
                className="flex-1 bg-[#1A6B3C] text-white py-3 rounded-xl text-base font-bold hover:bg-[#155a32] disabled:opacity-60"
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
