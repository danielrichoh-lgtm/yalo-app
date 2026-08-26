import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { supabase } from '../lib/supabase'

export default function LandingPage() {
  const [leadForm, setLeadForm] = useState({
    nombre: '',
    restaurante: '',
    telefono: '',
    numero_sucursales: '',
  })
  const [leadLoading, setLeadLoading] = useState(false)
  const [leadError, setLeadError] = useState('')
  const [leadSuccess, setLeadSuccess] = useState(false)

  const handleLeadSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLeadError('')

    if (!leadForm.nombre.trim()) return setLeadError('Ingresa tu nombre')
    if (!leadForm.restaurante.trim()) return setLeadError('Ingresa el nombre del restaurante')
    if (!/^\d{10}$/.test(leadForm.telefono)) return setLeadError('El teléfono debe tener 10 dígitos')
    if (!leadForm.numero_sucursales) return setLeadError('Selecciona el número de sucursales')

    setLeadLoading(true)

    const { error: insertError } = await supabase.from('leads_informacion').insert({
      nombre: leadForm.nombre.trim(),
      restaurante: leadForm.restaurante.trim(),
      telefono: leadForm.telefono.trim(),
      numero_sucursales: leadForm.numero_sucursales,
    })

    if (insertError) {
      setLeadLoading(false)
      return setLeadError('No pudimos enviar tu información. Intenta de nuevo.')
    }

    const { error: fnError } = await supabase.functions.invoke('notificar-lead', {
      body: {
        nombre: leadForm.nombre.trim(),
        restaurante: leadForm.restaurante.trim(),
        telefono: leadForm.telefono.trim(),
        numero_sucursales: leadForm.numero_sucursales,
      },
    })
    if (fnError) console.error('notificar-lead falló:', fnError.message)

    setLeadLoading(false)
    setLeadSuccess(true)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-md bg-[#F7F7F5]/80 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Logo className="text-xl" />
          <Link
            to="/restaurant/login"
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: 'var(--ink)' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-5 pt-16 pb-12 sm:pt-24 sm:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-medium tracking-wide uppercase mb-5" style={{ color: 'var(--muted)' }}>
            Hecho por restauranteros, para restauranteros · Monterrey
          </p>
          <h1 className="font-display font-bold leading-[1.05] mb-6" style={{ color: 'var(--ink)', fontSize: 'clamp(2.5rem, 8vw, 4.5rem)' }}>
            Tu restaurante.<br />Tu link.<br />Tu dinero.
          </h1>
          <p className="text-base sm:text-lg mb-8 max-w-xl mx-auto" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Recibe pedidos directos desde tu propio link. Crea tu menú digital gratis, sin tarjeta.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              to="/signup"
              className="w-full sm:w-auto inline-block px-8 py-4 rounded-xl font-semibold text-white text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--yalo-primary)' }}
            >
              Crear mi menú gratis
            </Link>
            <Link
              to="/restaurant/login"
              className="text-sm font-medium underline underline-offset-4 transition-colors hover:opacity-70"
              style={{ color: 'var(--ink)' }}
            >
              ¿Ya tienes cuenta? Inicia sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="px-5 pb-16 sm:pb-24">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-px rounded-2xl overflow-hidden" style={{ background: 'var(--border)' }}>
          {[
            { stat: '0%', label: 'comisión por venta, siempre' },
            { stat: '$0', label: 'para crear tu menú' },
            { stat: 'Minutos', label: 'para tenerlo listo' },
          ].map((item) => (
            <div key={item.stat} className="p-6 text-center" style={{ background: 'var(--surface)' }}>
              <p className="font-display font-bold text-3xl sm:text-4xl mb-1" style={{ color: 'var(--ink)' }}>
                {item.stat}
              </p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="px-5 py-16 sm:py-24" style={{ background: 'var(--surface)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-center mb-12 sm:mb-16" style={{ color: 'var(--ink)', fontSize: 'clamp(1.75rem, 5vw, 2.5rem)' }}>
            Cómo funciona
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { num: '01', title: 'Crea tu menú', desc: 'Fotos, precios y categorías. Gratis, sin tarjeta.' },
              { num: '02', title: 'Comparte tu link', desc: 'Tu link único, donde tú quieras: WhatsApp, Instagram, tus empaques.' },
              { num: '03', title: 'Entra el pedido', desc: 'Alerta en tu dashboard con todo el detalle.' },
              { num: '04', title: 'Ya lo', desc: 'El dinero es tuyo, sin comisión.' },
            ].map((step, i) => (
              <div
                key={step.num}
                className="relative p-6 rounded-2xl border transition-all hover:shadow-md"
                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
              >
                <span
                  className="font-display font-bold text-sm block mb-4"
                  style={{ color: '#2ECC71' }}
                >
                  {step.num}
                </span>
                <h3 className="font-display font-bold text-lg mb-2" style={{ color: 'var(--ink)' }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {step.desc}
                </p>
                {i < 3 && (
                  <span className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px" style={{ background: 'var(--border)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sección final — formulario de leads */}
      <section className="px-5 py-16 sm:py-24">
        <div className="max-w-md mx-auto">
          <h2 className="font-display font-bold text-center mb-4" style={{ color: 'var(--ink)', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}>
            ¿Solo quieres información?
          </h2>
          <p className="text-base text-center mb-8" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Déjanos tus datos y nuestro equipo te contacta para ayudarte a activar pedidos y delivery.
          </p>

          {leadSuccess ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: '#2ECC71' }}>
                <span className="text-white text-2xl">✓</span>
              </div>
              <h3 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--ink)' }}>¡Gracias!</h3>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Recibimos tu información. Nos pondremos en contacto contigo pronto.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLeadSubmit} className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre</label>
                <input
                  type="text"
                  value={leadForm.nombre}
                  onChange={e => setLeadForm(f => ({ ...f, nombre: e.target.value }))}
                  required
                  placeholder="Juan Pérez"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del restaurante</label>
                <input
                  type="text"
                  value={leadForm.restaurante}
                  onChange={e => setLeadForm(f => ({ ...f, restaurante: e.target.value }))}
                  required
                  placeholder="Restaurante La Esquina"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono / WhatsApp</label>
                <input
                  type="tel"
                  value={leadForm.telefono}
                  onChange={e => setLeadForm(f => ({ ...f, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  required
                  placeholder="5512345678"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de sucursales</label>
                <select
                  value={leadForm.numero_sucursales}
                  onChange={e => setLeadForm(f => ({ ...f, numero_sucursales: e.target.value }))}
                  required
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <option value="" disabled>Selecciona una opción</option>
                  <option value="1">1</option>
                  <option value="2-3">2-3</option>
                  <option value="4-5">4-5</option>
                  <option value="Más de 5">Más de 5</option>
                </select>
              </div>
              {leadError && <p className="text-red-500 text-sm">{leadError}</p>}
              <button
                type="submit"
                disabled={leadLoading}
                className="w-full text-white py-3 rounded-xl font-semibold disabled:opacity-60 hover:opacity-90 transition-all"
                style={{ background: 'var(--yalo-primary)' }}
              >
                {leadLoading ? 'Enviando...' : 'Quiero que me contacten'}
              </button>
            </form>
          )}

          <div className="text-center mt-8">
            <Link
              to="/signup"
              className="inline-block text-sm font-medium underline underline-offset-4 transition-colors hover:opacity-70"
              style={{ color: 'var(--ink)' }}
            >
              ¿Ya quieres empezar? Crea tu menú gratis →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo className="text-base" />
          <div className="flex items-center gap-5">
            <a href="tel:+528181690655" className="text-sm font-medium transition-colors hover:opacity-70" style={{ color: 'var(--ink)' }}>
              81 8169 0655
            </a>
            <a
              href="https://instagram.com/holayalo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium transition-colors hover:opacity-70"
              style={{ color: 'var(--ink)' }}
            >
              Instagram
            </a>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Hecho en Monterrey · Sin comisión, siempre.
          </p>
        </div>
      </footer>
    </div>
  )
}
