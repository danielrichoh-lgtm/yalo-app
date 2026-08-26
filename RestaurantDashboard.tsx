import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Restaurant } from '../../lib/types'
import PedidosTab from './tabs/PedidosTab'
import MiMenuTab from './tabs/MiMenuTab'
import ResumenTab from './tabs/ResumenTab'
import DescuentosTab from './tabs/DescuentosTab'
import NuevoPedidoTab from './tabs/NuevoPedidoTab'
import ClientesTab from './tabs/ClientesTab'

type Tab = 'pedidos' | 'nuevo' | 'menu' | 'resumen' | 'descuentos' | 'clientes'

export default function RestaurantDashboard() {
  const [restaurant, setRestaurant] = useState<Restaurant>(() => {
    return JSON.parse(sessionStorage.getItem('restaurant_session')!)
  })
  const navigate = useNavigate()

  const rol = sessionStorage.getItem('restaurant_rol') ?? 'admin'
  const isAdmin = rol === 'admin' || rol === 'super_admin'
  const isDraft = restaurant.estado === 'draft'
  const onboardingDone = restaurant.onboarding_completed === true
  const operationalBlocked = isDraft && onboardingDone

  const [tab, setTab] = useState<Tab>(operationalBlocked ? 'menu' : 'pedidos')

  useEffect(() => {
    document.title = `${restaurant.nombre} - Pedidos a domicilio`
    return () => { document.title = 'Yalo - Pedidos directos' }
  }, [restaurant.nombre])

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
    { key: 'nuevo', label: '+ Pedido' },
    ...(isAdmin ? [
      { key: 'menu' as Tab, label: 'Mi Menú' },
      { key: 'resumen' as Tab, label: 'Resumen' },
      { key: 'descuentos' as Tab, label: 'Descuentos' },
      { key: 'clientes' as Tab, label: 'Clientes' },
    ] : []),
  ]

  const blockedTabs: Tab[] = operationalBlocked ? ['pedidos', 'nuevo', 'resumen', 'descuentos', 'clientes'] : []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1E5B4F] text-white px-4 py-4 sticky top-0 z-30">
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
              <p className={`text-xs ${restaurant.servicio_activo ? 'text-[#2ECC71]' : 'text-white/60'}`}>
                {restaurant.servicio_activo ? 'Abierto' : 'Cerrado'}
              </p>
            </div>
          </div>
          <button onClick={logout} className="text-white/70 hover:text-white text-sm">Salir</button>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100 sticky top-[65px] z-20">
        <div className="max-w-2xl mx-auto flex overflow-x-auto">
          {tabs.map(t => {
            const blocked = blockedTabs.includes(t.key)
            return (
              <button
                key={t.key}
                onClick={() => !blocked && setTab(t.key)}
                className={`flex-1 min-w-[70px] py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-[#1E5B4F] text-[#1E5B4F]' : blocked ? 'border-transparent text-gray-300 cursor-not-allowed' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <main className={tab === 'nuevo' ? 'px-0 py-0' : 'max-w-2xl mx-auto px-4 py-5'}>
        {operationalBlocked && blockedTabs.includes(tab) ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-4xl mb-3">🔒</p>
            <h3 className="font-bold text-gray-900 mb-1">Esta sección no está disponible todavía</h3>
            <p className="text-sm text-gray-500 mb-4">Tu restaurante está en modo borrador. Completa y publica tu menú para desbloquear los pedidos y las herramientas operativas.</p>
            <button onClick={() => setTab('menu')} className="text-sm font-semibold text-[#1E5B4F] border border-[#1E5B4F] px-4 py-2 rounded-lg hover:bg-green-50">
              Ir a Mi Menú
            </button>
          </div>
        ) : (
          <>
            {tab === 'pedidos' && <PedidosTab restaurant={restaurant} />}
            {tab === 'nuevo' && (
              <div className="h-[calc(100vh-113px)]">
                <NuevoPedidoTab restaurant={restaurant} />
              </div>
            )}
            {tab === 'menu' && isAdmin && <MiMenuTab restaurant={restaurant} onUpdate={handleUpdate} />}
            {tab === 'resumen' && isAdmin && <ResumenTab restaurant={restaurant} />}
            {tab === 'descuentos' && isAdmin && <DescuentosTab restaurant={restaurant} />}
            {tab === 'clientes' && isAdmin && <ClientesTab restaurant={restaurant} />}
          </>
        )}
      </main>
    </div>
  )
}
