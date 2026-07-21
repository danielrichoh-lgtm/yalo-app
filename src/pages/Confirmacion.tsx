import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Order } from '../lib/types'

// This page is kept for backward-compat deep links.
// New orders go directly to /pedido/:numero_orden from Checkout.
export default function Confirmacion() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const order = state?.order as Order | undefined

  useEffect(() => {
    if (order?.numero_orden) {
      navigate(`/pedido/${order.numero_orden}`, { replace: true, state: { isNew: true } })
    }
  }, [order, navigate])

  // Fallback — shown briefly if no order in state or while redirecting
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Redirigiendo...</p>
        <button onClick={() => navigate(-1)} className="text-[#1A6B3C] font-medium hover:underline">
          Ir al menú
        </button>
      </div>
    </div>
  )
}
