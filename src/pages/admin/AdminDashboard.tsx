import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Restaurant, RestaurantUser } from '../../lib/types'
import DiscountCodesSection from './DiscountCodesSection'

const generateSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const EMPTY_NEW_FORM = { nombre: '', slug: '', direccion: '', telefono: '' }
const EMPTY_USER_FORM = { email: '', password: '', rol: 'admin' }

export default function AdminDashboard() {
  const navigate = useNavigate()
  const adminEmail = JSON.parse(sessionStorage.getItem('admin_session') || '{}').email ?? ''

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)

  // New restaurant form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState(EMPTY_NEW_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Toggle loading per restaurant
  const [toggling, setToggling] = useState<string | null>(null)

  // Accesos modal
  const [accesosTarget, setAccesosTarget] = useState<Restaurant | null>(null)
  const [accesosUsers, setAccesosUsers] = useState<RestaurantUser[]>([])
  const [accesosLoading, setAccesosLoading] = useState(false)
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM)
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')

  const loadRestaurants = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('Restaurants')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setRestaurants(data as Restaurant[])
    setLoading(false)
  }, [])

  useEffect(() => { loadRestaurants() }, [loadRestaurants])

  const logout = async () => {
    await supabase.auth.signOut()
    sessionStorage.removeItem('admin_session')
    navigate('/admin', { replace: true })
  }

  const toggleActivo = async (r: Restaurant) => {
    setToggling(r.id)
    const next = r.activo === false ? true : false
    await supabase.from('Restaurants').update({ activo: next }).eq('id', r.id)
    setRestaurants(prev => prev.map(x => x.id === r.id ? { ...x, activo: next } : x))
    setToggling(null)
  }

  const handleNombreChange = (nombre: string) => {
    setNewForm(f => ({ ...f, nombre, slug: generateSlug(nombre) }))
  }

  const createRestaurant = async () => {
    if (!newForm.nombre.trim()) { setSaveError('El nombre es requerido'); return }
    if (!newForm.slug.trim()) { setSaveError('El slug es requerido'); return }
    setSaving(true); setSaveError('')
    const { data, error } = await supabase
      .from('Restaurants')
      .insert({
        nombre: newForm.nombre.trim(),
        slug: newForm.slug.trim(),
        direccion: newForm.direccion.trim(),
        telefono: newForm.telefono.trim(),
        email: '',
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
        tiempo_estimado: 25,
        activo: true,
        ultimo_numero_orden: 0,
      })
      .select()
      .single()
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setRestaurants(prev => [data as Restaurant, ...prev])
    setShowNewForm(false)
    setNewForm(EMPTY_NEW_FORM)
  }

  const openAccesos = async (r: Restaurant) => {
    setAccesosTarget(r)
    setAccesosUsers([])
    setUserForm(EMPTY_USER_FORM)
    setUserError(''); setUserSuccess('')
    setAccesosLoading(true)
    const { data } = await supabase
      .from('restaurant_users')
      .select('*')
      .eq('restaurant_id', r.id)
      .order('created_at')
    if (data) setAccesosUsers(data as RestaurantUser[])
    setAccesosLoading(false)
  }

  const createUser = async () => {
    if (!userForm.email.trim()) { setUserError('El correo es requerido'); return }
    if (!userForm.password) { setUserError('La contraseña es requerida'); return }
    if (userForm.password.length < 6) { setUserError('La contraseña debe tener al menos 6 caracteres'); return }
    setUserSaving(true); setUserError(''); setUserSuccess('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUserError('Sesión expirada — vuelve a iniciar sesión'); setUserSaving(false); return }

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-restaurant-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: userForm.email.trim(),
          password: userForm.password,
          restaurant_id: accesosTarget!.id,
          rol: userForm.rol,
        }),
      }
    )

    const result = await resp.json()
    setUserSaving(false)

    if (!resp.ok || result.error) {
      setUserError(result.error ?? 'Error al crear el usuario')
      return
    }

    setUserSuccess(`Usuario creado correctamente`)
    setUserForm(EMPTY_USER_FORM)
    const { data } = await supabase
      .from('restaurant_users')
      .select('*')
      .eq('restaurant_id', accesosTarget!.id)
      .order('created_at')
    if (data) setAccesosUsers(data as RestaurantUser[])
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="border-b border-white/8 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
              <span className="text-white text-sm font-black">Y</span>
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Yalo Admin</p>
              <p className="text-gray-400 text-xs">{adminEmail}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Restaurants section */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Restaurantes ({restaurants.length})</h1>
          <button
            onClick={() => { setShowNewForm(v => !v); setSaveError('') }}
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{
              backgroundColor: showNewForm ? 'rgba(255,255,255,0.08)' : '#ffffff',
              color: showNewForm ? '#9ca3af' : '#111827',
            }}
          >
            {showNewForm ? 'Cancelar' : '+ Nuevo restaurante'}
          </button>
        </div>

        {/* New restaurant form */}
        {showNewForm && (
          <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="font-semibold text-sm text-gray-300 uppercase tracking-wide">Nuevo restaurante</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newForm.nombre}
                  onChange={e => handleNombreChange(e.target.value)}
                  placeholder="Mi Restaurante"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Slug * (URL: /menu/slug)</label>
                <input
                  type="text"
                  value={newForm.slug}
                  onChange={e => setNewForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="mi-restaurante"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 font-mono"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Dirección</label>
                <input
                  type="text"
                  value={newForm.direccion}
                  onChange={e => setNewForm(f => ({ ...f, direccion: e.target.value }))}
                  placeholder="Av. Reforma 123, Col. Centro"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={newForm.telefono}
                  onChange={e => setNewForm(f => ({ ...f, telefono: e.target.value }))}
                  placeholder="8183001234"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                />
              </div>
            </div>
            {saveError && (
              <p className="text-red-400 text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(220,38,38,0.10)' }}>
                {saveError}
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={createRestaurant}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-900 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#ffffff' }}
              >
                {saving ? 'Guardando...' : 'Crear restaurante'}
              </button>
            </div>
          </div>
        )}

        {/* Restaurant list */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Cargando...</div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No hay restaurantes aún</div>
        ) : (
          <div className="space-y-2">
            {restaurants.map(r => (
              <div
                key={r.id}
                className="rounded-2xl px-4 py-4 flex items-center justify-between gap-3"
                style={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-white">{r.nombre}</p>
                    <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">/menu/{r.slug}</span>
                  </div>
                  {(r.direccion || r.telefono) && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {[r.direccion, r.telefono].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-0.5">
                    Alta: {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Activo toggle */}
                  <button
                    onClick={() => toggleActivo(r)}
                    disabled={toggling === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                    style={
                      r.activo !== false
                        ? { backgroundColor: 'rgba(52,199,118,0.12)', color: '#34C776' }
                        : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#6b7280' }
                    }
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${r.activo !== false ? 'bg-[#34C776]' : 'bg-gray-500'}`} />
                    {toggling === r.id ? '...' : r.activo !== false ? 'Activo' : 'Inactivo'}
                  </button>
                  {/* Accesos */}
                  <button
                    onClick={() => openAccesos(r)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}
                  >
                    Accesos
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <DiscountCodesSection restaurants={restaurants} />
      </main>

      {/* Accesos modal */}
      {accesosTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:px-4"
          onClick={() => setAccesosTarget(null)}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-5 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-white">Accesos</h2>
                <p className="text-sm text-gray-400 mt-0.5">{accesosTarget.nombre}</p>
              </div>
              <button
                onClick={() => setAccesosTarget(null)}
                className="text-gray-500 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Existing users */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Usuarios con acceso</p>
              {accesosLoading ? (
                <p className="text-sm text-gray-500">Cargando...</p>
              ) : accesosUsers.length === 0 ? (
                <p className="text-sm text-gray-500">Sin usuarios asignados aún</p>
              ) : (
                <div className="space-y-2">
                  {accesosUsers.map(u => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                    >
                      <div>
                        <p className="text-sm text-white font-medium">{u.email}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{u.user_id}</p>
                      </div>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={
                          u.rol === 'super_admin'
                            ? { backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }
                            : { backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }
                        }
                      >
                        {u.rol}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new user */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agregar acceso</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Correo</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="restaurante@ejemplo.com"
                    className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                    style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contraseña temporal</label>
                  <input
                    type="text"
                    value={userForm.password}
                    onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="mín. 6 caracteres"
                    className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                    style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Rol</label>
                <select
                  value={userForm.rol}
                  onChange={e => setUserForm(f => ({ ...f, rol: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <option value="admin">admin — Acceso al dashboard de este restaurante</option>
                  <option value="super_admin">super_admin — Acceso al panel admin completo</option>
                </select>
              </div>

              {userError && (
                <p className="text-red-400 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(220,38,38,0.10)' }}>
                  {userError}
                </p>
              )}
              {userSuccess && (
                <p className="text-green-400 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(52,199,118,0.10)' }}>
                  {userSuccess}
                </p>
              )}

              <button
                onClick={createUser}
                disabled={userSaving}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-900 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#ffffff' }}
              >
                {userSaving ? 'Creando usuario...' : 'Crear usuario y asignar acceso'}
              </button>
              <p className="text-xs text-gray-600 text-center">
                El usuario podrá iniciar sesión en /restaurant/login con estas credenciales
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
