import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import type { DeliveryType, OrderItem } from '../lib/types'

type AppliedCoupon = {
  id: string
  codigo: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
}

export default function Checkout() {
  const { items, restaurant, total, clearCart } = useCart()
  const { customer, setCustomer } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const deliveryTypeFromCart = (location.state as { deliveryType?: DeliveryType })?.deliveryType ?? 'pickup'

  const [form, setForm] = useState({
    nombre: customer?.nombre ?? '',
    telefono: customer?.telefono_guardado || customer?.telefono || '',
    lugarType: 'oficina' as 'oficina' | 'casa',
    identificador_lugar: '',
    calle: customer?.calle ?? '',
    piso: '',
    despacho: '',
    extension: '',
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

  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')

  useEffect(() => {
    if (!customer) return
    const prefillAddress = async () => {
      const { data } = await supabase
        .from('orders')
        .select('identificador_lugar, calle, colonia, municipio, referencias, indicaciones')
        .eq('customer_email', customer.email)
        .eq('delivery_type', 'domicilio')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!data) return
      setForm(f => ({
        ...f,
        identificador_lugar: f.identificador_lugar || data.identificador_lugar || '',
        calle: f.calle || data.calle || '',
        colonia: f.colonia || data.colonia || '',
        municipio: f.municipio || data.municipio || '',
        referencias: f.referencias || data.referencias || '',
        indicaciones: f.indicaciones || data.indicaciones || '',
        lugarType: data.identificador_lugar ? 'oficina' : 'casa',
      }))
    }
    prefillAddress()
  }, [customer?.email])

  useEffect(() => {
    if (items.length === 0 && !orderConfirmed.current) {
      navigate(restaurant?.slug ? `/menu/${restaurant.slug}` : '/')
    }
  }, [items.length, navigate, restaurant])

  const costoPorPlatillo = restaurant?.costo_envio_por_platillo ?? 0
  const dishCount = items.reduce((sum, it) => sum + it.quantity, 0)
  const deliveryCost = deliveryType === 'domicilio' ? costoPorPlatillo * dishCount : 0

  const descuento = coupon
    ? coupon.tipo === 'porcentaje'
      ? Math.min(total * (coupon.valor / 100), total)
      : Math.min(coupon.valor, total)
    : 0

  const orderTotal = total - descuento + deliveryCost
  const montoPago = parseFloat(form.monto_pago) || 0
  const cambio = montoPago > 0 ? Math.max(0, montoPago - orderTotal) : 0
  const isExact = form.monto_pago !== '' && montoPago > 0 && montoPago === orderTotal
  const belowTotal = form.monto_pago !== '' && montoPago > 0 && montoPago < orderTotal

  const applyCode = async () => {
    const codigo = couponInput.trim().toUpperCase()
    if (!codigo) return
    setCouponLoading(true)
    setCouponError('')

    const { data: codes } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('codigo', codigo)
      .eq('activo', true)

    if (!codes || codes.length === 0) {
      setCouponLoading(false)
      setCouponError('Código no válido')
      return
    }

    const dc = codes.find((c: Record<string, unknown>) =>
      c.restaurant_id === null || c.restaurant_id === restaurant?.id
    )

    if (!dc) {
      setCouponLoading(false)
      setCouponError('Código no válido para este restaurante')
      return
    }

    if (dc.fecha_inicio && new Date(dc.fecha_inicio as string) > new Date()) {
      setCouponLoading(false)
      setCouponError('Este código todavía no está vigente')
      return
    }
    if (dc.fecha_fin && new Date(dc.fecha_fin as string) < new Date()) {
      setCouponLoading(false)
      setCouponError('Código expirado')
      return
    }
    if (dc.usos_maximos !== null && (dc.usos_actuales as number) >= (dc.usos_maximos as number)) {
      setCouponLoading(false)
      setCouponError('Código agotado')
      return
    }
    if (dc.monto_minimo !== null && total < (dc.monto_minimo as number)) {
      setCouponLoading(false)
      setCouponError(`Pedido mínimo de $${Number(dc.monto_minimo).toFixed(0)} para aplicar este código`)
      return
    }

    setCoupon({ id: dc.id as string, codigo: dc.codigo as string, tipo: dc.tipo as 'porcentaje' | 'monto_fijo', valor: dc.valor as number })
    setFieldErrors(prev => ({ ...prev, monto_pago: '' }))
    setCouponLoading(false)
  }

  const removeCoupon = () => {
    setCoupon(null)
    setCouponInput('')
    setCouponError('')
    setFieldErrors(prev => ({ ...prev, monto_pago: '' }))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!/^\d{10}$/.test(form.telefono)) {
      errs.telefono = 'Ingresa un número celular válido de 10 dígitos'
    }
    if (deliveryType === 'domicilio') {
      if (!form.calle.trim()) errs.calle = 'La calle y número son requeridos'
      if (form.lugarType === 'oficina' && !form.identificador_lugar.trim()) {
        errs.identificador_lugar = 'El nombre del establecimiento es requerido'
      }
      if (!form.municipio.trim()) errs.municipio = 'El municipio es requerido'
    }
    if (form.monto_pago && montoPago > 0 && montoPago < orderTotal) {
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
    if (data) setCustomer({ ...customer, ...patch })
  }

  const doInsert = async () => {
    setLoading(true)

    let finalDescuento = 0
    let couponCodigoToSave: string | null = null

    if (coupon) {
      const { data: dc } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('id', coupon.id)
        .maybeSingle()

      const isValid = dc
        && dc.activo
        && (dc.restaurant_id === null || dc.restaurant_id === restaurant!.id)
        && (!dc.fecha_inicio || new Date(dc.fecha_inicio as string) <= new Date())
        && (!dc.fecha_fin || new Date(dc.fecha_fin as string) >= new Date())
        && (dc.usos_maximos === null || (dc.usos_actuales as number) < (dc.usos_maximos as number))
        && (dc.monto_minimo === null || total >= (dc.monto_minimo as number))

      if (!isValid) {
        setLoading(false)
        setConfirmModal(false)
        setCoupon(null)
        setCouponInput('')
        setError('El código de descuento ya no es válido. Revisa tu pedido antes de continuar.')
        return
      }

      finalDescuento = (dc.tipo as string) === 'porcentaje'
        ? Math.min(total * ((dc.valor as number) / 100), total)
        : Math.min(dc.valor as number, total)
      couponCodigoToSave = dc.codigo as string
    }

    const finalTotal = total - finalDescuento + deliveryCost

    const { data: nextNum, error: rpcError } = await supabase.rpc('increment_order_number', {
      p_restaurant_id: restaurant!.id,
    })
    if (rpcError || nextNum == null) {
      setLoading(false)
      setConfirmModal(false)
      setError('Error al generar número de orden. Intenta de nuevo.')
      return
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

    const pisoParts = [form.piso, form.despacho, form.extension].map(v => v.trim()).filter(Boolean)
    const pisoCombined = pisoParts.length > 0 ? pisoParts.join(' · ') : null
    const finalMonto = montoPago > 0 ? montoPago : finalTotal
    const finalCambio = Math.max(0, finalMonto - finalTotal)

    const nuevoOrderId = crypto.randomUUID()
    const { error: dbError } = await supabase.from('orders').insert({
      id: nuevoOrderId,
      numero_orden,
      restaurant_id: restaurant!.id,
      customer_email: customer?.email ?? '',
      customer_nombre: form.nombre,
      customer_telefono: form.telefono,
      delivery_type: deliveryType,
      calle: form.calle,
      interior_depto: '',
      piso_despacho: pisoCombined,
      identificador_lugar: form.lugarType === 'oficina' ? form.identificador_lugar : null,
      colonia: form.colonia,
      municipio: form.municipio,
      referencias: form.referencias,
      indicaciones: form.indicaciones,
      direccion: '',
      establecimiento: '',
      piso: 'No aplica',
      despacho: '',
      items: JSON.stringify(orderItems),
      subtotal: total,
      costo_envio: deliveryCost,
      total: finalTotal,
      monto_pago: finalMonto,
      cambio: finalCambio,
      codigo_descuento: couponCodigoToSave,
      monto_descuento: finalDescuento,
      status: 'Nuevo',
    })

    if (dbError) {
      console.error('Order insert error:', dbError)
      console.error('Order insert error (full):', JSON.stringify(dbError, null, 2))
      console.error('Order insert payload:', JSON.stringify({
        numero_orden,
        restaurant_id: restaurant!.id,
        customer_email: customer?.email ?? '',
        customer_nombre: form.nombre,
        customer_telefono: form.telefono,
        delivery_type: deliveryType,
        calle: form.calle,
        interior_depto: '',
        piso_despacho: pisoCombined,
        identificador_lugar: form.lugarType === 'oficina' ? form.identificador_lugar : null,
        colonia: form.colonia,
        municipio: form.municipio,
        referencias: form.referencias,
        indicaciones: form.indicaciones,
        direccion: '',
        establecimiento: '',
        piso: 'No aplica',
        despacho: '',
        items: orderItems,
        subtotal: total,
        costo_envio: deliveryCost,
        total: finalTotal,
        monto_pago: finalMonto,
        cambio: finalCambio,
        codigo_descuento: couponCodigoToSave,
        monto_descuento: finalDescuento,
        status: 'Nuevo',
      }, null, 2))
      setLoading(false)
      setConfirmModal(false)
      setError('Error al enviar el pedido. Intenta de nuevo.')
      return
    }

    if (coupon) {
      await supabase.rpc('increment_coupon_usage', { p_coupon_id: coupon.id })
    }

    await saveCustomerAddress()

    const saved = JSON.parse(localStorage.getItem('yalo_mis_pedidos') || '[]')
    saved.unshift(numero_orden)
    localStorage.setItem('yalo_mis_pedidos', JSON.stringify(saved.slice(0, 20)))

    setLoading(false)
    orderConfirmed.current = true
    clearCart()
    navigate(`/pedido/confirmado/${nuevoOrderId}`)
  }

  const inp = (
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
    const val = form[name] as string
    const err = fieldErrors[name]
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{opts?.required && <span className="text-red-400 ml-0.5">*</span>}
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
                [name]: v.trim() ? '' : `${label} es requerido`,
              }))
            }
          }}
          className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${err ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
          style={!err ? { borderColor: 'var(--border)' } : {}}
        />
        {err && <p className="text-red-500 text-sm mt-1">{err}</p>}
      </div>
    )
  }

  const smallInp = (name: 'piso' | 'despacho' | 'extension', label: string, placeholder: string) => (
    <div className="flex-1 min-w-0">
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={form[name]}
        placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{ borderColor: 'var(--border)' }}
      />
    </div>
  )

  const addressSummary = deliveryType === 'domicilio'
    ? [form.calle, form.colonia, form.municipio].filter(Boolean).join(', ')
    : null

  return (
    <div className="min-h-screen pb-8" style={{ background: 'var(--background)' }}>
      <header className="bg-white border-b sticky top-0 z-30" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1040px] mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-lg">←</button>
          <h1 className="font-display font-bold text-lg text-gray-900">Checkout</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-[1040px] mx-auto px-4 py-6 space-y-4">

        {/* CONTACTO */}
        <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-display font-bold text-gray-900 text-lg">Contacto</h2>
          {inp('nombre', 'Nombre completo', { required: true, placeholder: 'Juan Pérez', autoComplete: 'name' })}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono<span className="text-red-400 ml-0.5">*</span>
            </label>
            <input
              value={form.telefono}
              inputMode="numeric"
              maxLength={10}
              placeholder="10 dígitos"
              autoComplete="tel"
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 10)
                setForm(f => ({ ...f, telefono: v }))
                if (submitted) setFieldErrors(prev => ({
                  ...prev,
                  telefono: /^\d{10}$/.test(v) ? '' : 'Ingresa un número celular válido de 10 dígitos',
                }))
              }}
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${fieldErrors.telefono ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
              style={!fieldErrors.telefono ? { borderColor: 'var(--border)' } : {}}
            />
            {fieldErrors.telefono && <p className="text-red-500 text-sm mt-1">{fieldErrors.telefono}</p>}
          </div>
        </div>

        {deliveryType === 'domicilio' && (
          <>
            {/* TIPO DE LUGAR */}
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-display font-bold text-gray-900 text-lg mb-4">¿A dónde llevamos tu pedido?</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, lugarType: 'oficina' }))}
                  className={`py-4 rounded-xl font-semibold text-sm border-2 transition-all flex flex-col items-center gap-1.5 ${
                    form.lugarType === 'oficina' ? 'text-gray-900' : 'text-gray-500'
                  }`}
                  style={form.lugarType === 'oficina' ? { borderColor: 'var(--restaurant-accent)', background: 'rgba(30,91,79,0.04)' } : { borderColor: 'var(--border)' }}
                >
                  <span className="text-2xl">🏢</span>
                  <span>Oficina / Comercio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, lugarType: 'casa' }))}
                  className={`py-4 rounded-xl font-semibold text-sm border-2 transition-all flex flex-col items-center gap-1.5 ${
                    form.lugarType === 'casa' ? 'text-gray-900' : 'text-gray-500'
                  }`}
                  style={form.lugarType === 'casa' ? { borderColor: 'var(--restaurant-accent)', background: 'rgba(30,91,79,0.04)' } : { borderColor: 'var(--border)' }}
                >
                  <span className="text-2xl">🏠</span>
                  <span>Casa</span>
                </button>
              </div>
            </div>

            {/* UBICACIÓN */}
            <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-gray-900 text-lg">Ubicación</h2>
                {customer && (customer.calle || customer.colonia) && (
                  <span className="text-xs font-semibold" style={{ color: 'var(--restaurant-accent)' }}>Guardada ✓</span>
                )}
              </div>

              {form.lugarType === 'oficina' && (
                inp('identificador_lugar', 'Nombre del establecimiento o comercio', {
                  required: true,
                  placeholder: 'Farmacia Guadalajara, Edificio Torres...',
                })
              )}

              {inp('calle', 'Calle y número', {
                required: true,
                placeholder: 'Av. Reforma 123',
                autoComplete: 'address-line1',
              })}

              {form.lugarType === 'oficina' && (
                <div className="flex gap-2">
                  {smallInp('piso', 'Piso', 'Piso 3')}
                  {smallInp('despacho', 'Despacho', 'Desp. B')}
                  {smallInp('extension', 'Extensión', 'Ext. 4501')}
                </div>
              )}

              {inp('colonia', 'Colonia', {
                placeholder: 'Col. Centro',
              })}

              {inp('municipio', 'Municipio', {
                required: true,
                placeholder: 'Monterrey',
              })}

              {inp('referencias', 'Referencias', {
                placeholder: 'Entre Juárez y Morelos, frente a la farmacia...',
              })}

              {inp('indicaciones', 'Indicaciones al repartidor', {
                placeholder: 'Tocar el timbre, preguntar por Juan...',
              })}
            </div>
          </>
        )}

        {/* PICKUP */}
        {deliveryType === 'pickup' && (
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-display font-bold text-gray-900 text-lg mb-3">¿Alguna indicación?</h2>
            {inp('indicaciones', 'Indicaciones (opcional)', {
              placeholder: 'Paso a recoger en 20 min...',
            })}
          </div>
        )}

        {/* PAGO */}
        <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-display font-bold text-gray-900 text-lg">Pago</h2>
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--background)' }}>
            <span className="text-xl">💵</span>
            <div>
              <p className="font-medium text-gray-800 text-sm">Efectivo al entregar</p>
              <p className="text-sm text-gray-500">Pago en efectivo contra entrega</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿Con cuánto pagas?
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
                    monto_pago: e.target.value && val > 0 && val < orderTotal
                      ? 'El monto debe ser mayor o igual al total'
                      : '',
                  }))
                }
              }}
              min={orderTotal}
              step="1"
              placeholder={`Ej. $${orderTotal.toFixed(0)}`}
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${fieldErrors.monto_pago ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
              style={!fieldErrors.monto_pago ? { borderColor: 'var(--border)' } : {}}
            />
            {fieldErrors.monto_pago && <p className="text-red-500 text-sm mt-1">{fieldErrors.monto_pago}</p>}
            {isExact && <p className="text-sm font-medium mt-1.5" style={{ color: 'var(--restaurant-accent)' }}>Pago exacto ✓</p>}
            {!isExact && montoPago > orderTotal && montoPago > 0 && (
              <p className="text-sm font-bold mt-1.5 text-gray-900">
                Tu cambio: <span>${cambio.toFixed(2)}</span>
              </p>
            )}
            {!form.monto_pago && (
              <p className="text-sm text-gray-400 mt-1.5">Si dejas vacío, se asume pago exacto</p>
            )}
          </div>
        </div>

        {/* DESCUENTO */}
        <div className="bg-white rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-display font-bold text-gray-900 text-lg">¿Tienes un código de descuento?</h2>
          {!coupon ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCode() } }}
                  placeholder="Ej. VERANO15"
                  maxLength={30}
                  className="flex-1 border rounded-xl px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:ring-2 tracking-wider"
                  style={{ borderColor: 'var(--border)' }}
                />
                <button
                  type="button"
                  onClick={applyCode}
                  disabled={couponLoading || !couponInput.trim()}
                  className="px-5 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 shrink-0 transition-opacity hover:opacity-90"
                  style={{ background: 'var(--restaurant-accent)' }}
                >
                  {couponLoading ? '...' : 'Aplicar'}
                </button>
              </div>
              {couponError && <p className="text-red-500 text-sm font-medium">{couponError}</p>}
            </div>
          ) : (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ backgroundColor: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.3)' }}
            >
              <div>
                <p className="font-bold text-sm" style={{ color: '#15803D' }}>
                  ✓ Código aplicado: {coupon.codigo}
                </p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: '#15803D' }}>
                  -${descuento.toFixed(2)} de descuento
                </p>
              </div>
              <button
                type="button"
                onClick={removeCoupon}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light ml-3 leading-none"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* RESUMEN */}
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-display font-bold text-gray-900 text-lg mb-3">Resumen del pedido</h2>
          <div className="space-y-2 mb-3">
            {items.map((item, idx) => {
              const extrasCost = (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
              return (
                <div key={idx} className="flex justify-between text-sm">
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
          <div className="border-t pt-2 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
            {descuento > 0 && coupon && (
              <div className="flex justify-between text-sm font-semibold" style={{ color: '#15803D' }}>
                <span>Descuento ({coupon.codigo})</span>
                <span>-${descuento.toFixed(2)}</span>
              </div>
            )}
            {deliveryType === 'pickup' ? (
              <div className="flex justify-between text-sm text-gray-600"><span>Recoger en local</span><span>Gratis</span></div>
            ) : costoPorPlatillo > 0 ? (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Envío: ${costoPorPlatillo} × {dishCount} platillo{dishCount !== 1 ? 's' : ''}</span>
                <span>${deliveryCost.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-sm text-gray-600"><span>Envío</span><span>Gratis</span></div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-lg pt-1"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
          </div>
        </div>

        {/* AVISO DE COBERTURA */}
        {deliveryType === 'domicilio' && (
          <div className="rounded-2xl px-4 py-3.5 flex gap-3" style={{ backgroundColor: '#FEFCE8', border: '1px solid rgba(253,224,71,0.4)' }}>
            <span className="text-lg shrink-0 mt-0.5">📍</span>
            <p className="text-sm text-yellow-800 leading-relaxed">
              Solo entregamos a domicilio dentro de un radio aproximado de 1 km del restaurante. Si tu ubicación está fuera de esta zona, tu pedido podría cambiarse a <strong>PARA RECOGER</strong>.
            </p>
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        {restaurant?.estado !== 'active' && (
          <div className="rounded-2xl px-4 py-3.5 text-center" style={{ backgroundColor: '#FEF3C7', border: '1px solid rgba(251,191,36,0.4)' }}>
            <p className="text-sm font-semibold text-amber-800">
              Este restaurante está en configuración y aún no acepta pedidos.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || belowTotal || restaurant?.estado !== 'active'}
          className="w-full text-white py-4 rounded-xl font-bold text-base disabled:opacity-60 transition-all hover:opacity-90"
          style={{ background: 'var(--ink)' }}
        >
          {loading ? 'Enviando pedido...' : `Confirmar pedido · ${orderTotal.toFixed(2)}`}
        </button>
      </form>

      {/* Confirmation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:px-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold text-gray-900 text-lg">¿Confirmas tu pedido?</h3>

            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-700 leading-snug">
                    {item.quantity}× {item.dish.nombre}
                    {item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0
                      ? ` (${item.variantes_seleccionadas.join(', ')})`
                      : ''}
                  </span>
                  <span className="font-medium text-gray-900 ml-2 shrink-0">
                    ${(item.dish.precio * item.quantity + (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
              {descuento > 0 && coupon && (
                <div className="flex justify-between text-sm font-semibold" style={{ color: '#15803D' }}>
                  <span>Descuento ({coupon.codigo})</span>
                  <span>-${descuento.toFixed(2)}</span>
                </div>
              )}
              {deliveryCost > 0 && costoPorPlatillo > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Envío: ${costoPorPlatillo} × {dishCount} platillo{dishCount !== 1 ? 's' : ''}</span>
                  <span>${deliveryCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-lg pt-1"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
            </div>

            <div className="rounded-xl px-4 py-3 space-y-1 text-sm text-gray-700" style={{ background: 'var(--background)' }}>
              <p>{deliveryType === 'pickup' ? '🏪 Recoger en local' : '🛵 Entrega a domicilio'}</p>
              {addressSummary && <p className="text-sm text-gray-500">{addressSummary}</p>}
              <p>
                💵 Pagas con:{' '}
                <span className="font-semibold">
                  {montoPago > 0 ? `$${montoPago.toFixed(2)}` : `$${orderTotal.toFixed(2)} (exacto)`}
                </span>
                {cambio > 0 ? ` · Cambio: $${cambio.toFixed(2)}` : ''}
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmModal(false)}
                disabled={loading}
                className="flex-1 border py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: 'var(--border)' }}
              >
                Revisar de nuevo
              </button>
              <button
                onClick={doInsert}
                disabled={loading}
                className="flex-1 text-white py-3 rounded-xl text-sm font-bold disabled:opacity-60 hover:opacity-90"
                style={{ background: 'var(--ink)' }}
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
