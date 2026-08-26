import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ensureRestaurantForUser } from '../../lib/restaurant'
import type { Restaurant } from '../../lib/types'

type Step = 1 | 2 | 3

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    direccion: '',
    hora_apertura: '08:00',
    hora_cierre: '22:00',
    pickup_activo: true,
    repartidor_propio: true,
    costo_envio_por_platillo: 0,
    pedido_minimo: 0,
    radio_entrega_km: 1,
  })

  useEffect(() => {
    let cancelled = false

    const loadRestaurant = async () => {
      const stored = sessionStorage.getItem('restaurant_session')
      if (stored) {
        const r = JSON.parse(stored) as Restaurant
        if (cancelled) return
        if (r.estado !== 'draft' || r.onboarding_completed === true) {
          navigate('/restaurant/dashboard', { replace: true })
          return
        }
        setRestaurant(r)
        setForm(f => ({
          ...f,
          direccion: r.direccion ?? '',
          hora_apertura: r.hora_apertura ?? '08:00',
          hora_cierre: r.hora_cierre ?? '22:00',
          pickup_activo: r.pickup_activo ?? true,
          repartidor_propio: r.repartidor_propio ?? true,
          costo_envio_por_platillo: r.costo_envio_por_platillo ?? 0,
          pedido_minimo: r.pedido_minimo ?? 0,
          radio_entrega_km: r.radio_entrega_km ?? 1,
        }))
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled || !session?.user) {
        navigate('/restaurant/login', { replace: true })
        return
      }

      const r = await ensureRestaurantForUser(session.user.id)
      if (cancelled || !r) {
        navigate('/restaurant/login', { replace: true })
        return
      }

      if (r.estado !== 'draft' || r.onboarding_completed === true) {
        navigate('/restaurant/dashboard', { replace: true })
        return
      }

      setRestaurant(r)
      setForm(f => ({
        ...f,
        direccion: r.direccion ?? '',
        hora_apertura: r.hora_apertura ?? '08:00',
        hora_cierre: r.hora_cierre ?? '22:00',
        pickup_activo: r.pickup_activo ?? true,
        repartidor_propio: r.repartidor_propio ?? true,
        costo_envio_por_platillo: r.costo_envio_por_platillo ?? 0,
        pedido_minimo: r.pedido_minimo ?? 0,
        radio_entrega_km: r.radio_entrega_km ?? 1,
      }))
      setLoading(false)
    }

    loadRestaurant()

    return () => { cancelled = true }
  }, [navigate])

  const saveStep = async (updates: Partial<Restaurant>) => {
    if (!restaurant) return
    setSaving(true)
    const { data, error: dbError } = await supabase
      .from('Restaurants')
      .update(updates)
      .eq('id', restaurant.id)
      .select()
      .single()
    setSaving(false)
    if (dbError || !data) {
      setError('Error al guardar: ' + (dbError?.message ?? 'desconocido'))
      return null
    }
    const updated = data as Restaurant
    setRestaurant(updated)
    sessionStorage.setItem('restaurant_session', JSON.stringify(updated))
    return updated
  }

  const handleStep1Next = async () => {
    if (!form.direccion.trim()) return setError('La dirección es requerida')
    if (!form.hora_apertura || !form.hora_cierre) return setError('Los horarios son requeridos')
    setError('')
    const updated = await saveStep({
      direccion: form.direccion.trim(),
      hora_apertura: form.hora_apertura,
      hora_cierre: form.hora_cierre,
      pickup_activo: form.pickup_activo,
      repartidor_propio: form.repartidor_propio,
      costo_envio_por_platillo: form.costo_envio_por_platillo,
      pedido_minimo: form.pedido_minimo,
    })
    if (updated) setStep(2)
  }

  const handleStep2Next = async () => {
    if (form.radio_entrega_km <= 0) return setError('El radio debe ser mayor a 0')
    setError('')
    const updated = await saveStep({
      radio_entrega_km: form.radio_entrega_km,
    })
    if (updated) setStep(3)
  }

  const handleFinish = async () => {
    setError('')
    setSaving(true)
    const { data, error: dbError } = await supabase
      .from('Restaurants')
      .update({ onboarding_completed: true })
      .eq('id', restaurant!.id)
      .select()
      .single()
    setSaving(false)
    if (dbError || !data) {
      return setError('Error al completar: ' + (dbError?.message ?? 'desconocido'))
    }
    const updated = data as Restaurant
    sessionStorage.setItem('restaurant_session', JSON.stringify(updated))

    supabase.functions.invoke('notificar-restaurante-registrado', {
      body: JSON.stringify({
        nombre: updated.nombre,
        slug: updated.slug,
        telefono: updated.telefono ?? '',
      }),
    }).catch(() => {})

    navigate('/restaurant/dashboard', { replace: true })
  }

  if (loading || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-gray-400">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: 'var(--background)' }}>
      <header className="bg-white border-b sticky top-0 z-30" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1040px] mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-gray-900">Completa tu restaurante</h1>
            <p className="text-xs text-gray-500 mt-0.5">{restaurant.nombre}</p>
          </div>
          <span className="text-sm font-medium text-gray-400">Paso {step} de 3</span>
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-full transition-all duration-500" style={{ width: `${(step / 3) * 100}%`, background: 'var(--yalo-primary)' }} />
        </div>
      </header>

      <main className="max-w-[1040px] mx-auto px-4 py-6">
        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-display font-bold text-gray-900 text-lg">Datos básicos</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección del restaurante</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                  placeholder="Av. Reforma 123, Monterrey"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora de apertura</label>
                  <input
                    type="time"
                    value={form.hora_apertura}
                    onChange={e => setForm(f => ({ ...f, hora_apertura: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora de cierre</label>
                  <input
                    type="time"
                    value={form.hora_cierre}
                    onChange={e => setForm(f => ({ ...f, hora_cierre: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-display font-bold text-gray-900 text-lg">Tipo de entrega</h2>
              <label className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${form.pickup_activo ? '' : 'opacity-60'}`} style={form.pickup_activo ? { borderColor: 'var(--yalo-primary)', background: 'rgba(30,91,79,0.04)' } : { borderColor: 'var(--border)' }}>
                <input type="checkbox" checked={form.pickup_activo} onChange={e => setForm(f => ({ ...f, pickup_activo: e.target.checked }))} className="w-4 h-4" style={{ accentColor: 'var(--yalo-primary)' }} />
                <div>
                  <p className="font-medium text-gray-900 text-sm">Recoger en local</p>
                  <p className="text-xs text-gray-500 mt-0.5">Los clientes pueden recoger su pedido</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${form.repartidor_propio ? '' : 'opacity-60'}`} style={form.repartidor_propio ? { borderColor: 'var(--yalo-primary)', background: 'rgba(30,91,79,0.04)' } : { borderColor: 'var(--border)' }}>
                <input type="checkbox" checked={form.repartidor_propio} onChange={e => setForm(f => ({ ...f, repartidor_propio: e.target.checked }))} className="w-4 h-4" style={{ accentColor: 'var(--yalo-primary)' }} />
                <div>
                  <p className="font-medium text-gray-900 text-sm">Repartidor propio</p>
                  <p className="text-xs text-gray-500 mt-0.5">Tienes tu propio equipo de reparto</p>
                </div>
              </label>
            </div>

            <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-display font-bold text-gray-900 text-lg">Costos de entrega</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo de envío por platillo (MXN)</label>
                <input
                  type="number"
                  value={form.costo_envio_por_platillo}
                  min={0}
                  step={1}
                  onChange={e => setForm(f => ({ ...f, costo_envio_por_platillo: parseInt(e.target.value) || 0 }))}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)' }}
                />
                <p className="text-xs text-gray-400 mt-1">Ej. $5 por platillo — se multiplica por el número de platillos del pedido. 0 = envío gratis.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pedido mínimo (MXN)</label>
                <input
                  type="number"
                  value={form.pedido_minimo}
                  min={0}
                  step={1}
                  onChange={e => setForm(f => ({ ...f, pedido_minimo: parseInt(e.target.value) || 0 }))}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)' }}
                />
                <p className="text-xs text-gray-400 mt-1">0 = sin mínimo</p>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button onClick={handleStep1Next} disabled={saving} className="w-full text-white py-4 rounded-xl font-bold text-base disabled:opacity-60 hover:opacity-90 transition-all" style={{ background: 'var(--ink)' }}>
              {saving ? 'Guardando...' : 'Continuar'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-display font-bold text-gray-900 text-lg">Zona de cobertura</h2>
              <p className="text-sm text-gray-500">Define hasta qué distancia de tu restaurante ofreces entrega a domicilio. Los clientes fuera de esta zona verán la opción de recoger en local.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Radio de entrega (km)</label>
                <input
                  type="number"
                  value={form.radio_entrega_km}
                  min={0.5}
                  step={0.5}
                  onChange={e => setForm(f => ({ ...f, radio_entrega_km: parseFloat(e.target.value) || 1 }))}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)' }}
                />
                <p className="text-xs text-gray-400 mt-1">Distancia máxima desde tu restaurante para entregas a domicilio. Mínimo 0.5 km.</p>
              </div>
              <div className="rounded-xl p-4 flex gap-3" style={{ background: 'rgba(30,91,79,0.04)', border: '1px solid rgba(30,91,79,0.15)' }}>
                <span className="text-lg shrink-0 mt-0.5">📍</span>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Los clientes dentro de <strong>{form.radio_entrega_km} km</strong> de tu restaurante podrán pedir entrega a domicilio. Los que estén fuera verán solo la opción de recoger.
                </p>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border py-4 rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50" style={{ borderColor: 'var(--border)' }}>
                Atrás
              </button>
              <button onClick={handleStep2Next} disabled={saving} className="flex-1 text-white py-4 rounded-xl font-bold text-base disabled:opacity-60 hover:opacity-90 transition-all" style={{ background: 'var(--ink)' }}>
                {saving ? 'Guardando...' : 'Continuar'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border p-6 text-center" style={{ borderColor: 'var(--border)' }}>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: 'rgba(30,158,99,0.10)' }}>
                <span className="text-3xl">✓</span>
              </div>
              <h2 className="font-display font-bold text-gray-900 text-xl mb-2">Tu restaurante está casi listo.</h2>
              <p className="text-gray-500 text-sm mb-1">Ahora arma tu menú.</p>
            </div>

            <div className="bg-white rounded-2xl border p-5 space-y-2" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Resumen</h3>
              <Row label="Restaurante" value={restaurant.nombre} />
              <Row label="Dirección" value={form.direccion || '—'} />
              <Row label="Horario" value={`${form.hora_apertura} - ${form.hora_cierre}`} />
              <Row label="Entrega" value={[
                form.pickup_activo ? 'Recoger' : '',
                form.repartidor_propio ? 'Repartidor propio' : '',
              ].filter(Boolean).join(', ') || '—'} />
              <Row label="Radio de cobertura" value={`${form.radio_entrega_km} km`} />
              <Row label="Envío por platillo" value={form.costo_envio_por_platillo > 0 ? `$${form.costo_envio_por_platillo}` : 'Gratis'} />
              <Row label="Pedido mínimo" value={form.pedido_minimo > 0 ? `$${form.pedido_minimo}` : 'Sin mínimo'} />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border py-4 rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50" style={{ borderColor: 'var(--border)' }}>
                Atrás
              </button>
              <button onClick={handleFinish} disabled={saving} className="flex-1 text-white py-4 rounded-xl font-bold text-base disabled:opacity-60 hover:opacity-90 transition-all" style={{ background: 'var(--ink)' }}>
                {saving ? 'Guardando...' : 'Crear mi menú'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}
