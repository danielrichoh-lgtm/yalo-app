import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Restaurant, MenuItem } from '../../lib/types'
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const sectionRefs = useRef<Partial<Record<string, HTMLElement | null>>>({})
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (restaurant) {
      document.title = `${restaurant.nombre} - Pedidos a domicilio`
      return () => { document.title = 'Yalo - Pedidos directos' }
    }
  }, [restaurant])

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

  const visibleCategories = useMemo(() => {
    const allCats = Array.from(new Set(items.map(i => i.categoria ?? 'Comidas')))
    return [
      ...MENU_CATEGORIAS.filter(c => allCats.includes(c)),
      ...allCats.filter(c => !MENU_CATEGORIAS.includes(c)).sort((a, b) => a.localeCompare(b, 'es')),
    ]
  }, [items])

  const scrollToCategory = (cat: string) => {
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-gray-400">Cargando...</div>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center text-gray-500">Restaurante no encontrado</div>
      </div>
    )
  }

  if (restaurant.activo === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <p className="text-4xl mb-4">🚫</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Restaurante no disponible</h1>
          <p className="text-gray-500 text-sm">Este restaurante no está disponible en este momento.</p>
        </div>
      </div>
    )
  }

  const open = isOpen(restaurant)

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1040px] mx-auto px-4 py-4">
          {/* Top row: logo + name + actions */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {restaurant.logo ? (
                <img src={restaurant.logo} alt="" className="w-12 h-12 rounded-full object-cover border" style={{ borderColor: 'var(--border)' }} />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl text-white" style={{ background: 'var(--restaurant-accent)' }}>
                  {restaurant.nombre?.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-display font-bold text-xl leading-tight text-gray-900 truncate">{restaurant.nombre}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: open ? 'rgba(30,158,99,0.10)' : 'rgba(107,114,128,0.10)',
                      color: open ? 'var(--success)' : 'var(--muted)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: open ? 'var(--success)' : 'var(--muted)' }} />
                    {open ? 'Abierto' : 'Cerrado'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {open ? `Cierra ${restaurant.hora_cierre}` : `Abre ${restaurant.hora_apertura}`}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              {customer ? (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Hola, {customer.nombre.split(' ')[0]}</p>
                  <div className="flex items-center gap-3 justify-end">
                    <Link to="/cliente/pedidos" className="text-sm font-medium hover:underline" style={{ color: 'var(--restaurant-accent)' }}>Mis pedidos</Link>
                    <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Salir</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link to="/cliente/pedidos" className="text-sm font-medium hover:underline" style={{ color: 'var(--restaurant-accent)' }}>Mis pedidos</Link>
                  <Link to="/cliente/login" className="text-sm text-gray-500 hover:text-gray-700">Iniciar sesión</Link>
                </div>
              )}
            </div>
          </div>
          {/* Second row: address + phone */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-gray-500">
            {restaurant.direccion && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.direccion)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-gray-700"
              >
                <span>📍</span>
                {restaurant.direccion}
              </a>
            )}
            <a href="tel:+528183405611" className="inline-flex items-center gap-1 hover:text-gray-700">
              <span>📞</span>
              81 8340-5611
            </a>
            <span className="text-gray-400">🛵 Envío a 500m</span>
          </div>
        </div>
      </header>

      {/* Sticky category nav */}
      {visibleCategories.length > 1 && (
        <div className="sticky top-0 z-30 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-[1040px] mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto no-scrollbar py-2.5">
              {visibleCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-colors flex-shrink-0 ${
                    activeCategory === cat
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={activeCategory === cat ? { borderBottom: '2px solid var(--restaurant-accent)' } : { borderBottom: '2px solid transparent' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1040px] mx-auto px-4 py-6">
        {!open && (
          <div className="mb-5 rounded-2xl px-5 py-3.5 text-center" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <p className="font-semibold text-[15px] leading-snug text-amber-800">
              Ahorita estamos cerrados. Abrimos a las {restaurant.hora_apertura}.
            </p>
          </div>
        )}
        {restaurant.banner_activo && restaurant.banner_promo && restaurant.banner_promo.trim() !== '' && (
          <div className="mb-6">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-2 px-1" style={{ color: 'var(--muted)' }}>
              Promoción de la semana
            </p>
            <div className="rounded-2xl px-5 py-4" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
              <p className="text-[15px] leading-snug text-gray-900">
                {restaurant.banner_promo.trim().replace(/GRATIS/i, (m) => `<span style="color: var(--restaurant-accent); font-weight: 600">${m}</span>`)
                }
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(30,91,79,0.08)', color: 'var(--yalo-primary)' }}>
                Exclusivo en pedidos directos
              </span>
            </div>
          </div>
        )}
        {items.length === 0 ? (
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
                  <h2 className="font-display text-lg font-bold text-gray-900 mb-3 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>{cat}</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {catItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (!open) {
                            if (toastTimer.current) clearTimeout(toastTimer.current)
                            setToast('Disponible cuando abramos')
                            toastTimer.current = setTimeout(() => setToast(null), 2000)
                            return
                          }
                          setSelectedDish(item)
                        }}
                        className={`bg-white rounded-2xl border p-4 flex items-center gap-4 text-left transition-all ${open ? 'hover:border-gray-300' : 'opacity-60'}`}
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-[17px] leading-snug">{item.nombre}</p>
                            {item.es_destacado && (
                              <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(46,204,113,0.12)', color: 'var(--yalo-primary)' }}>
                                ⭐ Más pedido
                              </span>
                            )}
                          </div>
                          {item.descripcion && <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.descripcion}</p>}
                          <p className="font-bold text-base mt-1.5 text-gray-900">${item.precio.toFixed(2)}</p>
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

      <footer className="max-w-[1040px] mx-auto px-4 py-8 text-center">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#2ECC71' }} />
          <span style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700 }}>Powered by Yalo</span>
        </a>
      </footer>

      {selectedDish && <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />}
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
      <CartButton onOpen={() => setCartOpen(true)} disabled={!open} />

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg" style={{ background: 'var(--ink)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
