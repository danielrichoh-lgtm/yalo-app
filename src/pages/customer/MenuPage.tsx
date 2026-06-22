import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Restaurant, MenuItem, MenuCategoria } from '../../lib/types'
import { MENU_CATEGORIAS } from '../../lib/types'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import DishModal from '../../components/DishModal'
import CartButton from '../../components/CartButton'
import CartDrawer from '../../components/CartDrawer'

const FALLBACK_RESTAURANTS: Record<string, Restaurant> = {
  'mi-tierra': {
    id: '5aeef72b-71d5-4219-826a-4e5223dd9eb5',
    nombre: 'Restaurante Mi Tierra',
    slug: 'mi-tierra',
    email: 'demo@holayalo.mx',
    password: '',
    servicio_activo: true,
    hora_apertura: '08:00',
    hora_cierre: '22:00',
    costo_envio: 0,
    costo_envio_por_platillo: 0,
    pickup_activo: true,
    repartidor_propio: true,
    repartidor_externo: false,
    logo: null,
    pedido_minimo: 0,
    tiempo_estimado: null,
    created_at: '',
  },
}

function isOpen(restaurant: Restaurant): boolean {
  if (!restaurant.servicio_activo) return false
  const now = new Date()
  const [openH, openM] = restaurant.hora_apertura.split(':').map(Number)
  const [closeH, closeM] = restaurant.hora_cierre.split(':').map(Number)
  const minutes = now.getHours() * 60 + now.getMinutes()
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM
  return minutes >= openMinutes && minutes < closeMinutes
}

export default function MenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { customer, logout } = useAuth()
  const { setRestaurant } = useCart()
  const [restaurant, setRestaurantLocal] = useState<Restaurant | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<MenuCategoria | null>(null)
  const sectionRefs = useRef<Partial<Record<MenuCategoria, HTMLElement | null>>>({})

  useEffect(() => {
    if (slug && !sessionStorage.getItem(`branch_selected_${slug}`)) {
      navigate(`/menu/${slug}/sucursal`, { replace: true })
    }
  }, [slug, navigate])

  useEffect(() => {
    if (!slug) return

    supabase
      .from('Restaurants')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data: rest, error }) => {
        if (error) console.error('[MenuPage] Restaurants error:', error.message)

        const r = (rest as Restaurant) ?? (slug ? FALLBACK_RESTAURANTS[slug] : null)

        if (!r) {
          setLoading(false)
          return
        }

        setRestaurantLocal(r)
        setRestaurant(r)

        if (searchParams.get('abrirCarrito') === '1') {
          setCartOpen(true)
          setSearchParams({}, { replace: true })
        }

        console.log('[MenuPage] fetching menu_items for restaurant_id:', r.id)
        supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', r.id)
          .eq('disponible', true)
          .order('created_at')
          .then(({ data: menuData, error: menuError }) => {
            console.log('[MenuPage] menu_items:', { data: menuData, error: menuError })
            if (menuError) console.error('[MenuPage] menu_items error:', menuError.message)
            if (menuData) setItems(menuData as MenuItem[])
            setLoading(false)
          })
      })
  }, [slug, setRestaurant])

  const visibleCategories = MENU_CATEGORIAS.filter(cat =>
    items.some(i => (i.categoria ?? 'Comidas') === cat)
  )

  const scrollToCategory = (cat: MenuCategoria) => {
    const el = sectionRefs.current[cat]
    if (el) {
      const offset = 100
      const y = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top: y, behavior: 'smooth' })
      setActiveCategory(cat)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">Restaurante no encontrado</div>
      </div>
    )
  }

  const open = isOpen(restaurant)

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <header className="bg-[#1A6B3C] text-white">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {restaurant.logo ? (
                <img src={restaurant.logo} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white/30" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl">
                  {restaurant.nombre?.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="font-bold text-xl leading-tight">{restaurant.nombre}</h1>
                <p className={`text-xs ${open ? 'text-[#34C776]' : 'text-white/60'}`}>
                  {open ? `Abierto · Cierra a las ${restaurant.hora_cierre}` : 'Cerrado ahora'}
                </p>
                <p className="text-xs text-white/60 mt-0.5">
                  ¿Algún problema?{' '}
                  <a href="tel:+528183405611" className="text-white/80 hover:text-white underline-offset-2 hover:underline">
                    81 8340-5611
                  </a>
                </p>
              </div>
            </div>
            <div className="text-right text-sm">
              {customer ? (
                <div>
                  <p className="text-white/80 text-xs">Hola, {customer.nombre.split(' ')[0]}</p>
                  <Link to="/cliente/pedidos" className="text-[#34C776] text-xs font-medium hover:underline">Mis pedidos</Link>
                  <button onClick={logout} className="ml-3 text-white/60 text-xs hover:text-white">Salir</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/cliente/pedidos" className="text-[#34C776] text-xs font-medium hover:underline">Mis pedidos</Link>
                  <Link to="/cliente/login" className="text-white/70 text-xs hover:text-white">Iniciar sesión</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sticky category nav */}
      {open && visibleCategories.length > 1 && (
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto no-scrollbar py-2">
              {visibleCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-base font-medium transition-colors flex-shrink-0 ${
                    activeCategory === cat
                      ? 'bg-[#1A6B3C] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-5">
        {!open ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🌙</p>
            <h2 className="text-xl font-bold text-gray-800">Restaurante cerrado</h2>
            <p className="text-gray-500 mt-2">Vuelve pronto · Horario: {restaurant.hora_apertura} – {restaurant.hora_cierre}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No hay platillos disponibles</div>
        ) : (
          <div className="space-y-8">
            {visibleCategories.map(cat => {
              const catItems = items.filter(i => (i.categoria ?? 'Comidas') === cat)
              return (
                <section
                  key={cat}
                  ref={el => { sectionRefs.current[cat] = el }}
                >
                  <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">{cat}</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {catItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedDish(item)}
                        className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 text-left hover:border-[#1A6B3C]/30 hover:shadow-sm transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-[17px] leading-snug">{item.nombre}</p>
                            {item.es_destacado && (
                              <span className="inline-flex items-center gap-0.5 bg-[#34C776]/15 text-[#1A6B3C] text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                                ⭐ Más pedido
                              </span>
                            )}
                          </div>
                          {item.descripcion && <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.descripcion}</p>}
                          <p className="text-[#1A6B3C] font-bold text-base mt-1.5">${item.precio.toFixed(2)}</p>
                        </div>
                        {item.foto && (
                          <img src={item.foto} alt={item.nombre} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>

      {selectedDish && <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />}
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
      <CartButton onOpen={() => setCartOpen(true)} />
    </div>
  )
}
