import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { MenuItem } from '../lib/types'

interface Props {
  onClose: () => void
}

export default function CartDrawer({ onClose }: Props) {
  const { items, restaurant, updateQuantity, removeItem, total, itemCount, addItem } = useCart()
  const { customer } = useAuth()
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'domicilio'>(
    restaurant?.pickup_activo ? 'pickup' : 'domicilio'
  )
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [upsellItems, setUpsellItems] = useState<MenuItem[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!restaurant?.id) return
    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('es_upsell', true)
      .eq('disponible', true)
      .then(({ data }) => {
        if (data) setUpsellItems(data as MenuItem[])
      })
  }, [restaurant?.id])

  const cartDishIds = new Set(items.map(i => i.dish.id))
  const upsellSuggestions = upsellItems.filter(u => !cartDishIds.has(u.id)).slice(0, 3)

  const costoPorPlatillo = restaurant?.costo_envio_por_platillo ?? 0
  const dishCount = items.reduce((sum, it) => sum + it.quantity, 0)
  const deliveryCost = deliveryType === 'domicilio' ? costoPorPlatillo * dishCount : 0
  const orderTotal = total + deliveryCost
  const pedidoMinimo = restaurant?.pedido_minimo ?? 0
  const belowMinimum = pedidoMinimo > 0 && total < pedidoMinimo
  const faltante = Math.max(0, pedidoMinimo - total)

  const showPickup = restaurant?.pickup_activo
  const showDomicilio = restaurant?.repartidor_propio || restaurant?.repartidor_externo

  const handleContinue = () => {
    onClose()
    navigate('/checkout', { state: { deliveryType } })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-sm h-full flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-display font-bold text-lg text-gray-900">Tu carrito ({itemCount})</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!customer && !bannerDismissed && (
            <div className="rounded-xl px-3.5 py-3 flex items-start justify-between gap-2" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <p className="text-sm text-amber-800 leading-snug">
                <Link to="/cliente/registro" onClick={onClose} className="font-semibold underline">
                  ¿Creas una cuenta?
                </Link>{' '}
                Guarda tu dirección para pedir más rápido la próxima vez.
              </p>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-amber-400 hover:text-amber-600 text-xl leading-none flex-shrink-0 mt-0.5"
              >
                ×
              </button>
            </div>
          )}
          {items.map((item, idx) => {
            const extrasCost = (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
            const lineTotal = item.dish.precio * item.quantity + extrasCost
            return (
              <div key={idx} className="rounded-xl p-3.5 border" style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">
                      {item.dish.nombre}
                      {item.variantes_seleccionadas && item.variantes_seleccionadas.length > 0 && (
                        <span className="font-normal text-gray-500"> ({item.variantes_seleccionadas.join(', ')})</span>
                      )}
                    </p>
                    {item.extras_seleccionados && item.extras_seleccionados.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        + {item.extras_seleccionados.map(e => e.cantidad > 1 ? `${e.cantidad} ${e.nombre}` : e.nombre).join(', ')}
                      </p>
                    )}
                    {item.nota && <p className="text-xs text-gray-400 mt-0.5 italic">"{item.nota}"</p>}
                  </div>
                  <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400 ml-2 text-xl leading-none">×</button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(idx, item.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200 text-base font-bold"
                    >−</button>
                    <span className="text-base font-bold w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, item.quantity + 1)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-90 text-base font-bold"
                      style={{ background: 'var(--restaurant-accent)' }}
                    >+</button>
                  </div>
                  <span className="font-bold text-gray-900 text-sm">${lineTotal.toFixed(2)}</span>
                </div>
              </div>
            )
          })}

          {upsellSuggestions.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">¿Quieres agregar algo más?</p>
              <div className="space-y-2">
                {upsellSuggestions.map(u => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5" style={{ background: 'var(--background)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-snug truncate">{u.nombre}</p>
                      <p className="text-sm font-bold text-gray-900">${u.precio.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => addItem({ dish: u, quantity: 1, toppings: [], nota: '' })}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-90 text-lg font-bold flex-shrink-0"
                      style={{ background: 'var(--restaurant-accent)' }}
                    >+</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
          {(showPickup || showDomicilio) && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Tipo de entrega</p>
              <div className="flex gap-2">
                {showPickup && (
                  <button
                    onClick={() => setDeliveryType('pickup')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      deliveryType === 'pickup' ? 'text-white' : 'text-gray-600'
                    }`}
                    style={deliveryType === 'pickup' ? { borderColor: 'var(--restaurant-accent)', background: 'var(--restaurant-accent)' } : { borderColor: 'var(--border)' }}
                  >
                    Recoger
                  </button>
                )}
                {showDomicilio && (
                  <button
                    onClick={() => setDeliveryType('domicilio')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      deliveryType === 'domicilio' ? 'text-white' : 'text-gray-600'
                    }`}
                    style={deliveryType === 'domicilio' ? { borderColor: 'var(--restaurant-accent)', background: 'var(--restaurant-accent)' } : { borderColor: 'var(--border)' }}
                  >
                    A domicilio
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {deliveryType === 'pickup'
                  ? '⏱ Tiempo estimado de preparación: 10-15 min'
                  : '⏱ Tiempo estimado de llegada: 30-40 min'}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>${total.toFixed(2)}</span>
            </div>
            {deliveryType === 'domicilio' && costoPorPlatillo > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Envío: ${costoPorPlatillo} × {dishCount} platillo{dishCount !== 1 ? 's' : ''}</span>
                <span>${deliveryCost.toFixed(2)}</span>
              </div>
            )}
            {deliveryType === 'domicilio' && costoPorPlatillo === 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Envío</span><span>Gratis</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-lg pt-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
              <span>Total</span><span>${orderTotal.toFixed(2)}</span>
            </div>
          </div>

          {belowMinimum && (
            <p className="text-sm text-red-500 font-medium text-center">
              Pedido mínimo: ${pedidoMinimo.toFixed(2)} — te faltan ${faltante.toFixed(2)}
            </p>
          )}

          <button
            onClick={handleContinue}
            disabled={belowMinimum}
            className={`w-full text-white py-3.5 rounded-xl font-semibold text-base transition-all ${belowMinimum ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
            style={{ background: 'var(--ink)' }}
          >
            Continuar al checkout
          </button>
        </div>
      </div>
    </div>
  )
}
