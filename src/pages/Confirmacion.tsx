import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Order } from '../lib/types'

export default function Confirmacion() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const order = state?.order as Order | undefined

  useEffect(() => {
    if (order?.numero_orden) {
      navigate(`/pedido/${order.numero_orden}`, { replace: true, state: { isNew: true } })
    }
  }, [order, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="text-center">
        <p className="text-gray-400 mb-4">Redirigiendo...</p>
        <button onClick={() => navigate(-1)} className="font-medium hover:underline" style={{ color: 'var(--yalo-primary)' }}>
          Ir al menú
        </button>
      </div>
    </div>
  )
}
