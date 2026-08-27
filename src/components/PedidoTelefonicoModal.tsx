import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Restaurant, MenuItem, CartItem, OrderItem, DeliveryType, VarianteGrupo, DishExtra } from '../lib/types'
import { MENU_CATEGORIAS } from '../lib/types'
import DishModal from './DishModal'

interface Props {
  restaurant: Restaurant
  onClose?: () => void
  onConfirmed: () => void
  embedded?: boolean
}

/* ---- helpers to detect whether a dish has modifiers ---- */
function parseVariantes(raw: string | null | undefined): VarianteGrupo[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}
function parseExtras(raw: string | null | undefined): DishExtra[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}
function hasModifiers(dish: MenuItem): boolean {
  return parseVariantes(dish.variantes).length > 0 || parseExtras(dish.extras).length > 0
}

const ITEMS_PER_PAGE = 24

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function PedidoTelefonicoModal({ restaurant, onClose, onConfirmed, embedded }: Props) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<string>('')
  const [pageByCat, setPageByCat] = useState<Record<string, number>>({})
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    deliveryType: 'pickup' as DeliveryType,
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
  const [lastAddrFound, setLastAddrFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at')
      .then(({ data }) => {
        if (data) {
          const parsed = data as MenuItem[]
          setItems(parsed)
          const cats = Array.from(new Set(parsed.map(i => i.categoria ?? 'Comidas')))
          const first = [
            ...MENU_CATEGORIAS.filter(c => cats.includes(c)),
            ...cats.filter(c => !MENU_CATEGORIAS.includes(c)).sort((a, b) => a.localeCompare(b, 'es')),
          ][0]
          if (first) setActiveCat(first)
        }
        setLoading(false)
      })
  }, [restaurant.id])

  useEffect(() => {
    if (embedded) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [embedded])

  const categories = useMemo(() => {
    const allCats = Array.from(new Set(items.map(i => i.categoria ?? 'Comidas')))
    return [
      ...MENU_CATEGORIAS.filter(c => allCats.includes(c)),
      ...allCats.filter(c => !MENU_CATEGORIAS.includes(c)).sort((a, b) => a.localeCompare(b, 'es')),
    ]
  }, [items])

  const catItems = useMemo(() => {
    return items.filter(i => (i.categoria ?? 'Comidas') === activeCat)
  }, [items, activeCat])

  const isSearching = searchQuery.trim().length > 0
  const searchResults = useMemo(() => {
    if (!isSearching) return []
    const q = normalize(searchQuery)
    return items.filter(i => normalize(i.nombre).includes(q))
  }, [items, searchQuery, isSearching])

  const currentPage = pageByCat[activeCat] ?? 0
  const totalPages = Math.max(1, Math.ceil(catItems.length / ITEMS_PER_PAGE))
  const pageItems = catItems.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE)

  const setCat = (cat: string) => {
    setActiveCat(cat)
    setPageByCat(prev => ({ ...prev, [cat]: 0 }))
  }

  const turnPage = (delta: number) => {
    setPageByCat(prev => {
      const cur = prev[activeCat] ?? 0
      const next = Math.max(0, Math.min(totalPages - 1, cur + delta))
      return { ...prev, [activeCat]: next }
    })
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, it) => {
      const extrasCost = (it.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
      return sum + (it.dish.precio + (it.variantes_precio ?? 0)) * it.quantity + extrasCost
    }, 0)
  }, [cart])

  const dishCount = cart.reduce((s, it) => s + it.quantity, 0)
  const costoPorPlatillo = restaurant.costo_envio_por_platillo ?? 0
  const deliveryCost = form.deliveryType === 'domicilio' ? costoPorPlatillo * dishCount : 0
  const orderTotal = cartTotal + deliveryCost
  const montoPago = parseFloat(form.monto_pago) || 0
  const cambio = montoPago > 0 ? Math.max(0, montoPago - orderTotal) : 0

  const addToCart = (item: CartItem) => {
    setCart(prev => [...prev, item])
  }

  const clearSearch = () => {
    setSearchQuery('')
    searchInputRef.current?.focus()
  }

  const quickAdd = (dish: MenuItem) => {
    if (!dish.disponible) return
    if (hasModifiers(dish)) {
      setSelectedDish(dish)
      return
    }
    const item: CartItem = {
      dish,
      quantity: 1,
      toppings: [],
      nota: '',
    }
    setCart(prev => [...prev, item])
    if (isSearching) clearSearch()
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isSearching && searchResults.length === 1) {
      e.preventDefault()
      quickAdd(searchResults[0])
    }
  }

  const updateQty = (index: number, qty: number) => {
    if (qty < 1) {
      setCart(prev => prev.filter((_, i) => i !== index))
      return
    }
    setCart(prev => prev.map((it, i) => (i === index ? { ...it, quantity: qty } : it)))
  }

  const removeLine = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const clearTicket = () => {
    setCart([])
    setConfirmClear(false)
  }

  const lookupLastAddress = async () => {
    const tel = form.telefono.trim()
    if (!/^\d{10}$/.test(tel)) return
    const { data } = await supabase
      .from('orders')
      .select('identificador_lugar, calle, colonia, municipio, referencias, indicaciones')
      .eq('restaurant_id', restaurant.id)
      .eq('customer_telefono', tel)
      .eq('delivery_type', 'domicilio')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setForm(f => ({
        ...f,
        identificador_lugar: data.identificador_lugar || f.identificador_lugar,
        calle: data.calle || f.calle,
        colonia: data.colonia || f.colonia,
        municipio: data.municipio || f.municipio,
        referencias: data.referencias || f.referencias,
        indicaciones: data.indicaciones || f.indicaciones,
        lugarType: data.identificador_lugar ? 'oficina' : 'casa',
        deliveryType: 'domicilio',
      }))
      setLastAddrFound(true)
    } else {
      setLastAddrFound(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!/^\d{10}$/.test(form.telefono)) { setError('El teléfono debe tener 10 dígitos'); return }
    if (form.deliveryType === 'domicilio') {
      if (!form.calle.trim()) { setError('La calle y número son requeridos'); return }
      if (form.lugarType === 'oficina' && !form.identificador_lugar.trim()) { setError('El nombre del establecimiento es requerido'); return }
      if (!form.municipio.trim()) { setError('El municipio es requerido'); return }
    }
    if (cart.length === 0) { setError('Agrega al menos un platillo'); return }

    setSubmitting(true)

    try {
      const { data: nextNum, error: rpcError } = await supabase.rpc('increment_order_number', {
        p_restaurant_id: restaurant.id,
      })
      if (rpcError || nextNum == null) {
        setError('Error al generar número de orden. Intenta de nuevo.')
        setSubmitting(false)
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
      const finalMonto = montoPago > 0 ? montoPago : orderTotal
      const finalCambio = Math.max(0, finalMonto - orderTotal)

      const { data: order, error: dbError } = await supabase.from('orders').insert({
        numero_orden,
        restaurant_id: restaurant.id,
        customer_email: '',
        customer_nombre: form.nombre,
        customer_telefono: form.telefono,
        delivery_type: form.deliveryType,
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
        subtotal: cartTotal,
        costo_envio: deliveryCost,
        total: orderTotal,
        monto_pago: finalMonto,
        cambio: finalCambio,
        codigo_descuento: null,
        monto_descuento: 0,
        status: 'En proceso',
        canal: 'telefono',
      }).select().single()

      if (dbError || !order) {
        setError('Error al guardar el pedido. Intenta de nuevo.')
        setSubmitting(false)
        return
      }

      printComanda(order as OrderForPrint, restaurant)

      setCart([])
      setForm({
        nombre: '', telefono: '', deliveryType: 'pickup', lugarType: 'oficina',
        identificador_lugar: '', calle: '', piso: '', despacho: '', extension: '',
        colonia: '', municipio: '', referencias: '', indicaciones: '', monto_pago: '',
      })
      setLastAddrFound(false)
      setShowCheckout(false)
      setSubmitting(false)
      onConfirmed()
    } catch {
      setError('Error inesperado. Intenta de nuevo.')
      setSubmitting(false)
    }
  }

  const inp = (
    name: keyof typeof form,
    label: string,
    opts?: { required?: boolean; placeholder?: string; inputMode?: 'numeric' | 'text'; maxLength?: number }
  ) => {
    const val = form[name] as string
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{opts?.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={val}
          inputMode={opts?.inputMode}
          maxLength={opts?.maxLength}
          placeholder={opts?.placeholder}
          onChange={e => {
            let v = e.target.value
            if (opts?.inputMode === 'numeric') v = v.replace(/\D/g, '').slice(0, opts?.maxLength ?? 99)
            setForm(f => ({ ...f, [name]: v }))
          }}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-[#1E5B4F]"
        />
      </div>
    )
  }

  /* ---- shared JSX fragments ---- */
  const dishGrid = (
    <>
      {/* Search bar */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar platillo..."
            className="w-full border-2 border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-base font-medium focus:outline-none focus:border-[#1E5B4F] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-gray-100 text-gray-500 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors"
              aria-label="Limpiar búsqueda"
            >✕</button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-4 pb-2 shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => { setCat(cat); clearSearch() }}
            className={`px-4 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${
              !isSearching && activeCat === cat
                ? 'bg-[#1E5B4F] text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Dish grid + pagination */}
      <div className="flex-1 overflow-hidden px-4 pb-2 flex flex-col">
        {loading ? (
          <p className="text-center text-gray-400 py-8">Cargando...</p>
        ) : isSearching ? (
          searchResults.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Sin resultados para "{searchQuery}"</p>
          ) : (
            <div
              className="grid gap-2 flex-1 content-start"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gridAutoRows: '90px',
              }}
            >
              {searchResults.map(item => (
                <button
                  key={item.id}
                  onClick={() => quickAdd(item)}
                  disabled={!item.disponible}
                  className={`rounded-xl border-2 p-2 flex flex-col items-center justify-center text-center transition-all ${
                    !item.disponible
                      ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                      : 'border-gray-100 bg-white hover:border-[#1E5B4F] hover:bg-green-50/30 active:scale-95'
                  }`}
                >
                  <span className={`font-bold text-base leading-tight line-clamp-2 ${!item.disponible ? 'text-gray-400' : 'text-gray-900'}`}>
                    {item.nombre}
                  </span>
                  <span className={`text-sm mt-1 ${!item.disponible ? 'text-gray-400' : 'text-[#1E5B4F]'}`}>
                    ${item.precio.toFixed(0)}
                  </span>
                  {!item.disponible && (
                    <span className="text-[10px] text-gray-400 font-medium mt-0.5">Agotado</span>
                  )}
                </button>
              ))}
            </div>
          )
        ) : pageItems.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No hay platillos en esta categoría</p>
        ) : (
          <>
            <div
              className="grid gap-2 flex-1 content-start"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gridAutoRows: '90px',
              }}
            >
              {pageItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => quickAdd(item)}
                  disabled={!item.disponible}
                  className={`rounded-xl border-2 p-2 flex flex-col items-center justify-center text-center transition-all ${
                    !item.disponible
                      ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                      : 'border-gray-100 bg-white hover:border-[#1E5B4F] hover:bg-green-50/30 active:scale-95'
                  }`}
                >
                  <span className={`font-bold text-base leading-tight line-clamp-2 ${!item.disponible ? 'text-gray-400' : 'text-gray-900'}`}>
                    {item.nombre}
                  </span>
                  <span className={`text-sm mt-1 ${!item.disponible ? 'text-gray-400' : 'text-[#1E5B4F]'}`}>
                    ${item.precio.toFixed(0)}
                  </span>
                  {!item.disponible && (
                    <span className="text-[10px] text-gray-400 font-medium mt-0.5">Agotado</span>
                  )}
                </button>
              ))}
            </div>

            {/* Pagination at the foot of the grid */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 shrink-0">
                <span className="text-sm text-gray-400 font-medium">
                  Página {currentPage + 1} de {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => turnPage(-1)}
                    disabled={currentPage === 0}
                    className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >◀</button>
                  <button
                    onClick={() => turnPage(1)}
                    disabled={currentPage >= totalPages - 1}
                    className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >▶</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )

  const ticketPanel = (
    <div className="flex flex-col border-l-2 border-gray-100 bg-gray-50 h-full" style={{ width: '30%' }}>
      <div className="px-4 py-3 shrink-0 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-base">Ticket</h3>
        {cart.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="text-xs font-semibold text-red-500 hover:text-red-600"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {cart.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Toca un platillo para agregarlo</p>
        ) : (
          <div className="space-y-2">
            {cart.map((item, idx) => {
              const extrasCost = (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
              const unitPrice = item.dish.precio + (item.variantes_precio ?? 0)
              const lineTotal = unitPrice * item.quantity + extrasCost
              return (
                <div key={idx} className="bg-white rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-snug">{item.dish.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">${unitPrice.toFixed(2)} c/u</p>
                    </div>
                    <button
                      onClick={() => removeLine(idx)}
                      className="text-gray-300 hover:text-red-500 text-lg leading-none shrink-0"
                    >×</button>
                  </div>
                  {item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1 leading-snug">
                      {item.variantes_seleccionadas.join(' · ')}
                    </p>
                  )}
                  {item.extras_seleccionados && item.extras_seleccionados.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                      + {item.extras_seleccionados.map(e => (e.cantidad > 1 ? `${e.cantidad}× ${e.nombre}` : e.nombre)).join(', ')}
                    </p>
                  )}
                  {item.nota && (
                    <p className="text-xs text-gray-400 italic mt-0.5 leading-snug">"{item.nota}"</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQty(idx, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-300"
                      >−</button>
                      <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(idx, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-300"
                      >+</button>
                    </div>
                    <span className="font-bold text-gray-900 text-sm">${lineTotal.toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-4 py-3 shrink-0 bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-gray-900">Total</span>
          <span className="font-bold text-[#1E5B4F] text-xl">${cartTotal.toFixed(2)}</span>
        </div>
        <button
          onClick={() => setShowCheckout(true)}
          disabled={cart.length === 0}
          className="w-full bg-[#1E5B4F] text-white py-3 rounded-xl font-bold text-base hover:bg-[#164A40] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Guardar pedido
        </button>
      </div>
    </div>
  )

  const overlays = (
    <>
      {selectedDish && (
        <DishModal
          dish={selectedDish}
          onClose={() => setSelectedDish(null)}
          onAdd={addToCart}
        />
      )}

      {confirmClear && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-4" onClick={() => setConfirmClear(false)}>
          <div className="bg-white rounded-2xl p-5 space-y-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg">¿Limpiar ticket?</h3>
            <p className="text-sm text-gray-500">Se quitarán todos los platillos del ticket actual.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClear(false)} className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={clearTicket} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600">Sí, limpiar</button>
            </div>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center sm:px-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl h-[92vh] sm:h-[88vh] flex flex-col">
            <div className="bg-[#1E5B4F] text-white px-4 py-3 flex items-center justify-between shrink-0 sm:rounded-t-2xl">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowCheckout(false)} className="text-white/70 hover:text-white text-lg">←</button>
                <h2 className="font-bold text-base">Datos del cliente</h2>
              </div>
              <button onClick={() => setShowCheckout(false)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
                <h3 className="font-bold text-gray-900 text-base">Contacto</h3>
                {inp('nombre', 'Nombre completo', { required: true, placeholder: 'Juan Pérez' })}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono<span className="text-red-400 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.telefono}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10 dígitos"
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setForm(f => ({ ...f, telefono: v }))
                      setLastAddrFound(false)
                    }}
                    onBlur={lookupLastAddress}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-[#1E5B4F]"
                  />
                  {lastAddrFound && (
                    <p className="text-xs text-[#1E5B4F] font-semibold mt-1.5">✓ Dirección cargada del último pedido</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
                <h3 className="font-bold text-gray-900 text-base">Tipo de entrega</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, deliveryType: 'pickup' }))}
                    className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors flex flex-col items-center gap-1 ${
                      form.deliveryType === 'pickup' ? 'bg-[#1E5B4F] border-[#1E5B4F] text-white' : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    <span className="text-xl">🏪</span>
                    <span>Recoger</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, deliveryType: 'domicilio' }))}
                    className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors flex flex-col items-center gap-1 ${
                      form.deliveryType === 'domicilio' ? 'bg-[#1E5B4F] border-[#1E5B4F] text-white' : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    <span className="text-xl">🛵</span>
                    <span>Domicilio</span>
                  </button>
                </div>
              </div>

              {form.deliveryType === 'domicilio' && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
                  <h3 className="font-bold text-gray-900 text-base">Ubicación</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, lugarType: 'oficina' }))}
                      className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors flex flex-col items-center gap-1 ${
                        form.lugarType === 'oficina' ? 'bg-[#1E5B4F] border-[#1E5B4F] text-white' : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      <span className="text-xl">🏢</span>
                      <span>Oficina</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, lugarType: 'casa' }))}
                      className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors flex flex-col items-center gap-1 ${
                        form.lugarType === 'casa' ? 'bg-[#1E5B4F] border-[#1E5B4F] text-white' : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      <span className="text-xl">🏠</span>
                      <span>Casa</span>
                    </button>
                  </div>
                  {form.lugarType === 'oficina' && inp('identificador_lugar', 'Establecimiento', { required: true, placeholder: 'Farmacia Guadalajara...' })}
                  {inp('calle', 'Calle y número', { required: true, placeholder: 'Av. Reforma 123' })}
                  {form.lugarType === 'oficina' && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Piso</label>
                        <input value={form.piso} onChange={e => setForm(f => ({ ...f, piso: e.target.value }))} placeholder="Piso 3" className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-[#1E5B4F]" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Despacho</label>
                        <input value={form.despacho} onChange={e => setForm(f => ({ ...f, despacho: e.target.value }))} placeholder="Desp. B" className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-[#1E5B4F]" />
                      </div>
                    </div>
                  )}
                  {inp('colonia', 'Colonia', { placeholder: 'Col. Centro' })}
                  {inp('municipio', 'Municipio', { required: true, placeholder: 'Monterrey' })}
                  {inp('referencias', 'Referencias', { placeholder: 'Entre Juárez y Morelos...' })}
                  {inp('indicaciones', 'Indicaciones al repartidor', { placeholder: 'Tocar el timbre...' })}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
                <h3 className="font-bold text-gray-900 text-base">Pago</h3>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <span className="text-lg">💵</span>
                  <p className="font-medium text-gray-800 text-sm">Efectivo al entregar</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">¿Con cuánto paga?</label>
                  <input
                    type="number"
                    value={form.monto_pago}
                    onChange={e => setForm(f => ({ ...f, monto_pago: e.target.value }))}
                    min={orderTotal}
                    step="1"
                    placeholder={`Ej. $${orderTotal.toFixed(0)}`}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-[#1E5B4F]"
                  />
                  {montoPago > orderTotal && montoPago > 0 && (
                    <p className="text-sm text-[#1E5B4F] font-bold mt-1.5">Cambio: ${cambio.toFixed(2)}</p>
                  )}
                  {!form.monto_pago && <p className="text-xs text-gray-400 mt-1">Si dejas vacío, se asume pago exacto</p>}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h3 className="font-bold text-gray-900 text-base mb-2">Resumen</h3>
                <div className="space-y-1 mb-2">
                  {cart.map((item, idx) => {
                    const extrasCost = (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
                    const lineTotal = (item.dish.precio + (item.variantes_precio ?? 0)) * item.quantity + extrasCost
                    return (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.quantity}× {item.dish.nombre}</span>
                        <span className="font-semibold ml-2 shrink-0">${lineTotal.toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-gray-100 pt-2 space-y-1">
                  <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${cartTotal.toFixed(2)}</span></div>
                  {deliveryCost > 0 ? (
                    <div className="flex justify-between text-sm text-gray-500"><span>Envío</span><span>${deliveryCost.toFixed(2)}</span></div>
                  ) : (
                    <div className="flex justify-between text-sm text-gray-600"><span>Recoger en local</span><span>Gratis</span></div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-1"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-[#1E5B4F] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#164A40] disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Confirmando...' : `Confirmar pedido telefónico · $${orderTotal.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (embedded) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex flex-col" style={{ width: '70%' }}>
            {dishGrid}
          </div>
          {ticketPanel}
        </div>
        {overlays}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex">
      <div className="bg-white w-full h-full flex flex-col">
        <div className="bg-[#1E5B4F] text-white px-5 py-3 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-lg">📞 Pedido telefónico</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex flex-col" style={{ width: '70%' }}>
            {dishGrid}
          </div>
          {ticketPanel}
        </div>
      </div>
      {overlays}
    </div>
  )
}

interface OrderForPrint {
  id: string
  numero_orden: string
  customer_nombre: string
  customer_telefono: string
  delivery_type: string
  calle: string | null
  interior_depto: string | null
  piso_despacho: string | null
  identificador_lugar: string | null
  colonia: string | null
  municipio: string | null
  referencias: string | null
  indicaciones: string | null
  direccion: string | null
  establecimiento: string | null
  piso: string | null
  despacho: string | null
  items: string
  subtotal: number
  costo_envio: number
  total: number
  monto_pago: number
  cambio: number
  monto_descuento: number | null
  codigo_descuento: string | null
  created_at: string
}

function printComanda(order: OrderForPrint, restaurant: Restaurant): void {
  const items: OrderItem[] = JSON.parse(order.items)

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
  }

  const itemsHtml = items.map(item => {
    const variants = item.variantes_seleccionadas?.length
      ? `<div style="font-size:8pt;color:#333;word-break:break-word;">&#8226; ${item.variantes_seleccionadas.join(' · ')}</div>` : ''
    const extras = item.extras_seleccionados?.length
      ? `<div style="font-size:8pt;color:#333;word-break:break-word;">+ ${item.extras_seleccionados.map(e => (e.cantidad > 1 ? `${e.cantidad} ${e.nombre}` : e.nombre)).join(', ')}</div>` : ''
    const nota = item.nota
      ? `<div style="font-size:7pt;font-style:italic;color:#555;word-break:break-word;">"${item.nota}"</div>` : ''
    return `
      <div style="text-align:center;margin-bottom:6px;">
        <div style="font-size:11pt;font-weight:900;word-break:break-word;line-height:1.2;">${item.quantity}&times; ${item.nombre}</div>
        ${variants}${extras}${nota}
      </div>`
  }).join('')

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:9pt;width:50mm;max-width:50mm;margin:0 auto;padding:0;color:#000;background:#fff;box-sizing:border-box;">
  <div style="text-align:center;margin-bottom:3px;">
    <div style="font-size:8pt;font-weight:900;">RESTAURANTE</div>
    <div style="font-size:12pt;font-weight:900;">${restaurant.nombre}</div>
    ${(restaurant.razon_social || restaurant.rfc) ? `<div style="font-size:7pt;color:#555;">${[restaurant.razon_social, restaurant.rfc].filter(Boolean).join(' · ')}</div>` : ''}
  </div>
  ${solid}
  <div style="text-align:center;margin:2px 0 3px;">
    <div style="font-size:18pt;font-weight:900;word-break:break-all;">${order.numero_orden}</div>
    <div style="font-size:7pt;font-weight:900;border:1.5px solid #000;padding:1px 6px;margin-top:2px;display:inline-block;word-break:break-word;">
      ${order.delivery_type === 'domicilio' ? 'ENTREGA A DOMICILIO' : 'RECOGER EN LOCAL'}
    </div>
    <div style="font-size:7pt;font-weight:900;background:#000;color:#fff;padding:1px 6px;margin-top:2px;display:inline-block;">TELÉFONO</div>
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
    ${addrLines.map((l: string) => `<div style="font-size:14pt;font-weight:900;word-break:break-word;overflow-wrap:break-word;line-height:1.25;margin-bottom:2px;">${l}</div>`).join('')}
  </div>` : ''}
  ${solid}
  <div style="text-align:center;margin-bottom:5px;">
    ${itemsHtml}
  </div>
  ${solid}
  <div style="text-align:center;font-size:9pt;margin-bottom:4px;">
    <div>Subtotal: $${order.subtotal.toFixed(2)}</div>
    ${order.costo_envio > 0 ? `<div>Env&#237;o: $${order.costo_envio.toFixed(2)}</div>` : ''}
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
