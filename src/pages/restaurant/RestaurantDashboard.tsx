import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Restaurant } from '../../lib/types'
import PedidosTab from './tabs/PedidosTab'
import MiMenuTab from './tabs/MiMenuTab'
import ResumenTab from './tabs/ResumenTab'
import DescuentosTab from './tabs/DescuentosTab'

type Tab = 'pedidos' | 'menu' | 'resumen' | 'descuentos'

export default function RestaurantDashboard() {
  const [tab, setTab] = useState<Tab>('pedidos')
  const [restaurant, setRestaurant] = useState<Restaurant>(() => {
    return JSON.parse(sessionStorage.getItem('restaurant_session')!)
  })
  const navigate = useNavigate()

  const handleUpdate = (updated: Restaurant) => {
    setRestaurant(updated)
    sessionStorage.setItem('restaurant_session', JSON.stringify(updated))
  }

  const logout = async () => {
    await supabase.auth.signOut()
    sessionStorage.clear()
    navigate('/restaurant/login')
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pedidos', label: 'Pedidos' },
    { key: 'menu', label: 'Mi Menú' },
    { key: 'resumen', label: 'Resumen' },
    { key: 'descuentos', label: 'Descuentos' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A6B3C] text-white px-4 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {restaurant.logo ? (
              <img src={restaurant.logo} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                {restaurant.nombre?.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-bold text-sm leading-tight">{restaurant.nombre}</p>
              <p className={`text-xs ${restaurant.servicio_activo ? 'text-[#34C776]' : 'text-white/60'}`}>
                {restaurant.servicio_activo ? 'Abierto' : 'Cerrado'}
              </p>
            </div>
          </div>
          <button onClick={logout} className="text-white/70 hover:text-white text-sm">Salir</button>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100 sticky top-[65px] z-20">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#1A6B3C] text-[#1A6B3C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {tab === 'pedidos' && <PedidosTab restaurant={restaurant} />}
        {tab === 'menu' && <MiMenuTab restaurant={restaurant} onUpdate={handleUpdate} />}
        {tab === 'resumen' && <ResumenTab restaurant={restaurant} />}
        {tab === 'descuentos' && <DescuentosTab restaurant={restaurant} />}
      </main>
    </div>
  )
}
