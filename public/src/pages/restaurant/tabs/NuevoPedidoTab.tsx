import { useState } from 'react'
import type { Restaurant } from '../../../lib/types'
import PedidoTelefonicoModal from '../../../components/PedidoTelefonicoModal'

export default function NuevoPedidoTab({ restaurant }: { restaurant: Restaurant }) {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <PedidoTelefonicoModal
      key={refreshKey}
      restaurant={restaurant}
      embedded
      onConfirmed={() => setRefreshKey(k => k + 1)}
    />
  )
}
