import { useLocation, Link } from 'react-router-dom'
import type { Order, OrderItem } from '../lib/types'

export default function Confirmacion() {
  const { state } = useLocation()
  const order = state?.order as Order | undefined

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No se encontró el pedido</p>
          <Link to="/menu/mi-tierra" className="text-[#1A6B3C] font-medium hover:underline">Ir al menú</Link>
        </div>
      </div>
    )
  }

  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items as unknown as string) as OrderItem[]
  const estimatedTime = order.delivery_type === 'pickup' ? '10-15 min' : '30-40 min'

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-[#1A6B3C] text-white px-4 pt-12 pb-8 text-center">
        <div className="text-5xl mb-3">✅</div>
        <h1 className="text-2xl font-bold">¡Pedido enviado!</h1>
        <p className="text-white/80 text-sm mt-1">El restaurante lo revisará en breve</p>
        <div className="inline-block bg-white/20 rounded-2xl px-6 py-2 mt-4">
          <span className="font-mono font-bold text-2xl tracking-widest">{order.numero_orden}</span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3">Tu pedido</h2>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <div>
                  <span className="text-gray-700">{item.quantity}× {item.nombre}</span>
                  {item.toppings && item.toppings.length > 0 && (
                    <p className="text-xs text-gray-400">{item.toppings.map(t => `+ ${t.nombre}`).join(', ')}</p>
                  )}
                  {item.nota && <p className="text-xs text-gray-400 italic">"{item.nota}"</p>}
                </div>
                <span className="font-medium text-gray-900">
                  ${((item.precio + item.toppings.reduce((s, t) => s + t.precio * t.quantity, 0)) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
            {order.costo_envio > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Envío</span><span>${order.costo_envio.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 pt-1"><span>Total</span><span>${order.total.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Pagas con</span><span>${order.monto_pago.toFixed(2)}</span></div>
            {order.cambio > 0 && <div className="flex justify-between text-sm text-[#1A6B3C]"><span>Tu cambio</span><span>${order.cambio.toFixed(2)}</span></div>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{order.delivery_type === 'pickup' ? '🏪' : '🛵'}</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {order.delivery_type === 'pickup' ? 'Recoger en local' : 'Entrega a domicilio'}
              </p>
              {order.delivery_type === 'domicilio' && order.establecimiento && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {[order.establecimiento, order.direccion, order.piso !== 'No aplica' ? order.piso : ''].filter(Boolean).join(', ')}
                </p>
              )}
              <p className="text-xs text-[#1A6B3C] font-medium mt-1">⏱ Tiempo estimado: {estimatedTime}</p>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500">
          Tu pedido fue enviado. El restaurante lo revisará en breve.
        </p>

        <div className="flex gap-3">
          <Link
            to={`/pedido/${order.numero_orden}`}
            className="flex-1 bg-[#1A6B3C] text-white py-3 rounded-xl font-semibold text-center text-sm hover:bg-[#155a32]"
          >
            Rastrear mi pedido
          </Link>
        </div>
        <div className="flex gap-3">
          <Link to="/cliente/pedidos" className="flex-1 border border-[#1A6B3C] text-[#1A6B3C] py-3 rounded-xl font-semibold text-center text-sm hover:bg-green-50">
            Ver mis pedidos
          </Link>
          <Link to="/menu/mi-tierra" className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold text-center text-sm hover:bg-gray-50">
            Volver al menú
          </Link>
        </div>
      </div>
    </div>
  )
}
