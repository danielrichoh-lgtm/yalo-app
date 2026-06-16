import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'

interface Props {
  onClose: () => void
}

export default function CartDrawer({ onClose }: Props) {
  const { items, restaurant, updateQuantity, removeItem, total, itemCount } = useCart()
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'domicilio'>(
    restaurant?.pickup_activo ? 'pickup' : 'domicilio'
  )
  const navigate = useNavigate()

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
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-sm h-full flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#1A6B3C] text-white px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg">Tu carrito ({itemCount})</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.map((item, idx) => {
            const extrasCost = (item.extras_seleccionados ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0)
            const lineTotal = item.dish.precio * item.quantity + extrasCost
            return (
              <div key={idx} className="border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">
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
                  <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400 ml-2 text-lg leading-none">×</button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(idx, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200"
                    >−</button>
                    <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-[#1A6B3C] flex items-center justify-center text-white hover:bg-[#155a32]"
                    >+</button>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">${lineTotal.toFixed(2)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-gray-100 p-4 space-y-3">
          {(showPickup || showDomicilio) && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Tipo de entrega</p>
              <div className="flex gap-2">
                {showPickup && (
                  <button
                    onClick={() => setDeliveryType('pickup')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${deliveryType === 'pickup' ? 'bg-[#1A6B3C] text-white border-[#1A6B3C]' : 'border-gray-200 text-gray-700'}`}
                  >
                    Recoger
                  </button>
                )}
                {showDomicilio && (
                  <button
                    onClick={() => setDeliveryType('domicilio')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${deliveryType === 'domicilio' ? 'bg-[#1A6B3C] text-white border-[#1A6B3C]' : 'border-gray-200 text-gray-700'}`}
                  >
                    A domicilio
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {deliveryType === 'pickup'
                  ? '⏱ Tiempo estimado de preparación: 10-15 min'
                  : '⏱ Tiempo estimado de llegada: 30-40 min'}
              </p>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>${total.toFixed(2)}</span>
            </div>
            {deliveryType === 'domicilio' && costoPorPlatillo > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span className="text-gray-500">Envío: ${costoPorPlatillo} × {dishCount} platillo{dishCount !== 1 ? 's' : ''}</span>
                <span>${deliveryCost.toFixed(2)}</span>
              </div>
            )}
            {deliveryType === 'domicilio' && costoPorPlatillo === 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Envío</span><span>Gratis</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span><span>${orderTotal.toFixed(2)}</span>
            </div>
          </div>

          {belowMinimum && (
            <p className="text-xs text-red-500 font-medium text-center">
              Pedido mínimo: ${pedidoMinimo.toFixed(2)} — te faltan ${faltante.toFixed(2)}
            </p>
          )}

          <button
            onClick={handleContinue}
            disabled={belowMinimum}
            className={`w-full bg-[#1A6B3C] text-white py-3 rounded-xl font-semibold transition-colors ${belowMinimum ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#155a32]'}`}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
