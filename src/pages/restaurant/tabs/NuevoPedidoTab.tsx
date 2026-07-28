import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Restaurant, MenuItem, CartItem, DeliveryType, OrderItem } from '../../../lib/types'
import { MENU_CATEGORIAS } from '../../../lib/types'
import ManualDishModal from '../../../components/ManualDishModal'

type AppliedCoupon = {
  id: string
  codigo: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
}

export default function NuevoPedidoTab({ restaurant }: { restaurant: Restaurant }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null)
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    lugarType: 'oficina' as 'oficina' | 'casa',
    identificador_lugar: '',
    calle: '',
    piso: '',
    despacho: '',
    extension: '',
    colonia: '',
    municipio: '',
    referencias: '',
    indicaciones: '',
    monto_pago: '',
  })

  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')

  useEffect(() => {
    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('disponible', true)
      .order('created_at')
      .then(({ data }) => {
        if (data) setMenuItems(data as MenuItem[])
      })
  }, [restaurant.id])

  const total = useMemo(() => {
    return cart.reduce((sum, it) => {
      const extrasCost = (it.extras_seleccionados ?? []).reduce((es, e) => es + e.precio * e.cantidad, 0)
      return sum + (it.dish.precio + (it.variantes_precio ?? 0)) * it.quantity + extrasCost
    }, 0)
  }, [cart])

  const costoPorPlatillo = restaurant.costo_envio_por_platillo ?? 0
  const dishCount = cart.reduce((sum, it) => sum + it.quantity, 0)
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

  const visibleCategories = useMemo(() => {
    const allCats = Array.from(new Set(menuItems.map(i => i.categoria ?? 'Comidas')))
    return [
      ...MENU_CATEGORIAS.filter(c => allCats.includes(c)),
      ...allCats.filter(c => !MENU_CATEGORIAS.includes(c)).sort((a, b) => a.localeCompare(b, 'es')),
    ]
  }, [menuItems])

  const addToCart = (item: CartItem) => {
    setCart(prev => [...prev, item])
  }

  const updateQuantity = (index: number, qty: number) => {
    setCart(prev => {
      if (qty < 1) return prev.filter((_, i) => i !== index)
      return prev.map((it, i) => (i === index ? { ...it, quantity: qty } : it))
    })
  }

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

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
      c.restaurant_id === null || c.restaurant_id === restaurant.id
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
    if (!form.nombre.trim()) errs.nombre = 'El nombre es requerido'
    if (!/^\d{10}$/.test(form.telefono)) {
      errs.telefono = 'Ingresa un número celular válido de 10 dígitos'
    }
    if (cart.length === 0) {
      errs.cart = 'Agrega al menos un platillo al pedido'
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

  const doInsert = async () => {
    setLoading(true)
    setError('')

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
        && (dc.restaurant_id === null || dc.restaurant_id === restaurant.id)
        && (!dc.fecha_inicio || new Date(dc.fecha_inicio as string) <= new Date())
        && (!dc.fecha_fin || new Date(dc.fecha_fin as string) >= new Date())
        && (dc.usos_maximos === null || (dc.usos_actuales as number) < (dc.usos_maximos as number))
        && (dc.monto_minimo === null || total >= (dc.monto_minimo as number))

      if (!isValid) {
        setLoading(false)
        setConfirmModal(false)
        setCoupon(null)
        setCouponInput('')
        setError('El código de descuento ya no es válido.')
        return
      }

      finalDescuento = (dc.tipo as string) === 'porcentaje'
        ? Math.min(total * ((dc.valor as number) / 100), total)
        : Math.min(dc.valor as number, total)
      couponCodigoToSave = dc.codigo as string
    }

    const finalTotal = total - finalDescuento + deliveryCost

    const { data: nextNum, error: rpcError } = await supabase.rpc('increment_order_number', {
      p_restaurant_id: restaurant.id,
    })
    if (rpcError || nextNum == null) {
      setLoading(false)
      setConfirmModal(false)
      setError('Error al generar número de orden. Intenta de nuevo.')
      return
    }
    const numero_orden = `ORD-${String(nextNum).padStart(3, '0')}`

    const orderItems: OrderItem[] = cart.map(item => {
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

    const { data: order, error: dbError } = await supabase.from('orders').insert({
      numero_orden,
      restaurant_id: restaurant.id,
      customer_email: '',
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
    }).select().single()

    if (dbError || !order) {
      console.error('Order insert error:', dbError)
      setLoading(false)
      setConfirmModal(false)
      setError('Error al crear el pedido. Intenta de nuevo.')
      return
    }

    if (coupon) {
      await supabase.rpc('increment_coupon_usage', { p_coupon_id: coupon.id })
    }

    setLoading(false)
    setConfirmModal(false)
    setSuccessMsg(`Pedido ${numero_orden} creado correctamente`)
    setCart([])
    setCoupon(null)
    setCouponInput('')
    setCouponError('')
    setForm({
      nombre: '', telefono: '', lugarType: 'oficina', identificador_lugar: '',
      calle: '', piso: '', despacho: '', extension: '', colonia: '', municipio: '',
      referencias: '', indicaciones: '', monto_pago: '',
    })
    setSubmitted(false)
    setFieldErrors({})
    setTimeout(() => setSuccessMsg(''), 4000)
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
    }
  ) => {
    const val = form[name] as string
    const err = fieldErrors[name]
    return (
      <div>
        <label className="block text-base font-medium text-gray-700 mb-1">
          {label}{opts?.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
          type={opts?.type ?? 'text'}
          value={val}
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
          className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none ${err ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#1A6B3C]'}`}
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
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-[#1A6B3C]"
      />
    </div>
  )

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ backgroundColor: 'rgba(52,199,118,0.10)', border: '1.5px solid #34C776' }}>
          <span className="text-lg">✓</span>
          <p className="font-semibold text-sm" style={{ color: '#15803D' }}>{successMsg}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <h2 className="font-bold text-gray-900 text-lg">Nuevo pedido manual</h2>
        <span className="text-xs text-gray-400 font-medium">(teléfono / mostrador)</span>
      </div>

      {/* MENU SELECTION */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h3 className="font-bold text-gray-900 text-base mb-3">1. Platillos</h3>
        {visibleCategories.map(cat => (
          <div key={cat} className="mb-4 last:mb-0">
            <p className="text-xs font-bold tracking-wide text-gray-400 uppercase mb-2">{cat}</p>
            <div className="space-y-2">
              {menuItems.filter(item => item.categoria === cat).map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedDish(item)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#1A6B3C] hover:bg-green-50/30 transition-colors text-left"
                >
                  {item.foto ? (
                    <img src={item.foto} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">🍽️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{item.nombre}</p>
                    <p className="text-[#1A6B3C] font-semibold text-sm">${item.precio.toFixed(2)}</p>
                  </div>
                  <span className="text-[#1A6B3C] text-xl font-bold shrink-0">+</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {menuItems.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No hay platillos disponibles</p>
        )}
      </div>

      {/* CART */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 text-base mb-3">2. Resumen del pedido</h3>
          <div className="space-y-2 mb-3">
            {cart.map((item, idx) => {
              const extrasCost = (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
              return (
                <div key={idx} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-snug">
                      <span className="font-medium">{item.quantity}× {item.dish.nombre}</span>
                      {item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0
                        ? <span className="text-gray-500"> ({item.variantes_seleccionadas.join(', ')})</span>
                        : ''}
                    </p>
                    {item.extras_seleccionados && item.extras_seleccionados.length > 0 && (
                      <p className="text-xs text-gray-400">
                        + {item.extras_seleccionados.map(e => `${e.cantidad}× ${e.nombre}`).join(', ')}
                      </p>
                    )}
                    {item.nota && <p className="text-xs text-gray-400 italic">"{item.nota}"</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-gray-900">
                      ${((item.dish.precio + (item.variantes_precio ?? 0)) * item.quantity + extrasCost).toFixed(2)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(idx, item.quantity - 1)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm hover:bg-gray-200">−</button>
                      <span className="text-xs font-semibold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, item.quantity + 1)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm hover:bg-gray-200">+</button>
                      <button onClick={() => removeItem(idx)} className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-500 text-sm hover:bg-red-100 ml-1">×</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t border-gray-100 pt-2">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
          </div>
        </div>
      )}
      {submitted && fieldErrors.cart && (
        <p className="text-red-500 text-sm text-center">{fieldErrors.cart}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* DELIVERY TYPE */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 text-base mb-3">3. Tipo de entrega</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`py-4 rounded-xl font-bold text-base border-2 transition-colors flex flex-col items-center gap-1 ${
                deliveryType === 'pickup'
                  ? 'bg-[#1A6B3C] border-[#1A6B3C] text-white'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              <span className="text-2xl">🏪</span>
              <span>Recoger en local</span>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType('domicilio')}
              className={`py-4 rounded-xl font-bold text-base border-2 transition-colors flex flex-col items-center gap-1 ${
                deliveryType === 'domicilio'
                  ? 'bg-[#1A6B3C] border-[#1A6B3C] text-white'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              <span className="text-2xl">🛵</span>
              <span>Entrega a domicilio</span>
            </button>
          </div>
        </div>

        {/* CONTACT */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
          <h3 className="font-bold text-gray-900 text-base">4. Datos del cliente</h3>
          {inp('nombre', 'Nombre completo', { required: true, placeholder: 'Juan Pérez' })}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-1">
              Teléfono<span className="text-red-400 ml-1">*</span>
            </label>
            <input
              value={form.telefono}
              inputMode="numeric"
              maxLength={10}
              placeholder="10 dígitos"
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

        {/* ADDRESS (domicilio only) */}
        {deliveryType === 'domicilio' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 text-base mb-4">¿A dónde llevamos el pedido?</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, lugarType: 'oficina' }))}
                  className={`py-4 rounded-xl font-bold text-base border-2 transition-colors flex flex-col items-center gap-1 ${
                    form.lugarType === 'oficina'
                      ? 'bg-[#1A6B3C] border-[#1A6B3C] text-white'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="text-2xl">🏢</span>
                  <span>Oficina / Comercio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, lugarType: 'casa' }))}
                  className={`py-4 rounded-xl font-bold text-base border-2 transition-colors flex flex-col items-center gap-1 ${
                    form.lugarType === 'casa'
                      ? 'bg-[#1A6B3C] border-[#1A6B3C] text-white'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="text-2xl">🏠</span>
                  <span>Casa</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
              <h3 className="font-bold text-gray-900 text-base">Ubicación</h3>
              {form.lugarType === 'oficina' && (
                inp('identificador_lugar', 'Nombre del establecimiento o comercio', {
                  required: true,
                  placeholder: 'Farmacia Guadalajara, Edificio Torres...',
                })
              )}
              {inp('calle', 'Calle y número', { required: true, placeholder: 'Av. Reforma 123' })}
              {form.lugarType === 'oficina' && (
                <div className="flex gap-2">
                  {smallInp('piso', 'Piso', 'Piso 3')}
                  {smallInp('despacho', 'Despacho', 'Desp. B')}
                  {smallInp('extension', 'Extensión', 'Ext. 4501')}
                </div>
              )}
              {inp('colonia', 'Colonia', { placeholder: 'Col. Centro' })}
              {inp('municipio', 'Municipio', { required: true, placeholder: 'Monterrey' })}
              {inp('referencias', 'Referencias', { placeholder: 'Entre Juárez y Morelos, frente a la farmacia...' })}
              {inp('indicaciones', 'Indicaciones al repartidor', { placeholder: 'Tocar el timbre, preguntar por Juan...' })}
            </div>
          </>
        )}

        {deliveryType === 'pickup' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 text-base mb-3">¿Alguna indicación?</h3>
            {inp('indicaciones', 'Indicaciones (opcional)', { placeholder: 'Paso a recoger en 20 min...' })}
          </div>
        )}

        {/* PAYMENT */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
          <h3 className="font-bold text-gray-900 text-base">{deliveryType === 'domicilio' ? '5' : '5'}. Pago</h3>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-xl">💵</span>
            <div>
              <p className="font-medium text-gray-800 text-base">Efectivo al entregar</p>
              <p className="text-sm text-gray-500">Pago en efectivo contra entrega</p>
            </div>
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-1">
              ¿Con cuánto paga?
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
              className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none ${fieldErrors.monto_pago ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#1A6B3C]'}`}
            />
            {fieldErrors.monto_pago && <p className="text-red-500 text-sm mt-1">{fieldErrors.monto_pago}</p>}
            {isExact && <p className="text-base text-[#1A6B3C] font-medium mt-1.5">Pago exacto ✓</p>}
            {!isExact && montoPago > orderTotal && montoPago > 0 && (
              <p className="text-base text-[#1A6B3C] font-bold mt-1.5">
                Cambio: <span>${cambio.toFixed(2)}</span>
              </p>
            )}
            {!form.monto_pago && (
              <p className="text-sm text-gray-400 mt-1.5">Si dejas vacío, se asume pago exacto</p>
            )}
          </div>
        </div>

        {/* DISCOUNT */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
          <h3 className="font-bold text-gray-900 text-base">¿Código de descuento?</h3>
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
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base font-mono uppercase focus:outline-none focus:border-[#1A6B3C] tracking-wider"
                />
                <button
                  type="button"
                  onClick={applyCode}
                  disabled={couponLoading || !couponInput.trim()}
                  className="px-5 py-3 rounded-xl bg-[#1A6B3C] text-white font-bold text-base disabled:opacity-50 shrink-0 transition-opacity"
                >
                  {couponLoading ? '...' : 'Aplicar'}
                </button>
              </div>
              {couponError && <p className="text-red-500 text-sm font-medium">{couponError}</p>}
            </div>
          ) : (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ backgroundColor: 'rgba(52,199,118,0.10)', border: '1.5px solid #34C776' }}
            >
              <div>
                <p className="font-bold text-sm" style={{ color: '#15803D' }}>
                  ✓ Código aplicado: {coupon.codigo}
                </p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: '#15803D' }}>
                  -{descuento.toFixed(2)} de descuento
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

        {/* TOTAL SUMMARY */}
        {cart.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between text-base text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
              {descuento > 0 && coupon && (
                <div className="flex justify-between text-base font-semibold" style={{ color: '#15803D' }}>
                  <span>Descuento ({coupon.codigo})</span>
                  <span>-${descuento.toFixed(2)}</span>
                </div>
              )}
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
        )}

        {error && <p className="text-red-500 text-base text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || belowTotal || cart.length === 0}
          className="w-full bg-[#1A6B3C] text-white py-4 rounded-xl font-bold text-base hover:bg-[#155a32] disabled:opacity-60 transition-colors"
        >
          {loading ? 'Creando pedido...' : `Confirmar pedido · $${orderTotal.toFixed(2)}`}
        </button>
      </form>

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:px-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">¿Confirmas este pedido?</h3>

            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {cart.map((item, idx) => {
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
                      ${((item.dish.precio + (item.variantes_precio ?? 0)) * item.quantity + extrasCost).toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <div className="flex justify-between text-base text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
              {descuento > 0 && coupon && (
                <div className="flex justify-between text-base font-semibold" style={{ color: '#15803D' }}>
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

            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1 text-base text-gray-700">
              <p>{deliveryType === 'pickup' ? '🏪 Recoger en local' : '🛵 Entrega a domicilio'}</p>
              {deliveryType === 'domicilio' && form.calle && (
                <p className="text-sm text-gray-500">{[form.calle, form.colonia, form.municipio].filter(Boolean).join(', ')}</p>
              )}
              <p>👤 {form.nombre || '—'} · 📞 {form.telefono || '—'}</p>
              <p>
                💵 Pago:{' '}
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
                className="flex-1 border border-gray-200 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Revisar de nuevo
              </button>
              <button
                onClick={doInsert}
                disabled={loading}
                className="flex-1 bg-[#1A6B3C] text-white py-3 rounded-xl text-base font-bold hover:bg-[#155a32] disabled:opacity-60"
              >
                {loading ? 'Creando...' : 'Sí, crear pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISH MODAL */}
      {selectedDish && (
        <ManualDishModal
          dish={selectedDish}
          onAdd={addToCart}
          onClose={() => setSelectedDish(null)}
        />
      )}
    </div>
  )
}
