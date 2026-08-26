import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre_responsable: '',
    nombre_restaurante: '',
    email: '',
    telefono: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.nombre_responsable.trim()) return setError('Ingresa tu nombre')
    if (!form.nombre_restaurante.trim()) return setError('Ingresa el nombre del restaurante')
    if (!/^\d{10}$/.test(form.telefono)) return setError('El teléfono debe tener 10 dígitos')
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')

    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          nombre_restaurante: form.nombre_restaurante.trim(),
          telefono: form.telefono.trim(),
        },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    })

    if (authError) {
      setLoading(false)
      if (authError.message.toLowerCase().includes('already registered')) {
        return setError('Este correo ya está registrado. Inicia sesión.')
      }
      return setError('Error al crear cuenta: ' + authError.message)
    }

    if (!authData.user) {
      setLoading(false)
      return setError('Error al crear cuenta. Intenta de nuevo.')
    }

    if (!authData.session) {
      setNeedsEmailConfirm(true)
      setLoading(false)
      return
    }

    setLoading(false)
    navigate(`/onboarding`)
  }

  if (needsEmailConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'var(--yalo-primary)' }}>
            <span className="text-white text-3xl">✉</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Revisa tu correo</h1>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Te enviamos un enlace de confirmación a <strong>{form.email}</strong>.
            Haz clic en el enlace para continuar con la configuración de tu restaurante.
          </p>
          <Link to="/restaurant/login" className="inline-block text-sm font-medium hover:underline" style={{ color: 'var(--yalo-primary)' }}>
            Ya confirmé mi correo →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          ← Volver al inicio
        </button>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: 'var(--yalo-primary)' }}>
            <span className="text-white text-2xl font-bold font-display">Y</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Crear mi restaurante</h1>
          <p className="text-sm text-gray-500 mt-1">Regístra tu restaurante en Yalo</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--border)' }}>
          {[
            { key: 'nombre_responsable', label: 'Tu nombre (responsable)', type: 'text', placeholder: 'Juan Pérez' },
            { key: 'nombre_restaurante', label: 'Nombre del restaurante', type: 'text', placeholder: 'Restaurante La Esquina' },
            { key: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'juan@ejemplo.com' },
            { key: 'telefono', label: 'Teléfono / WhatsApp', type: 'tel', placeholder: '5512345678' },
            { key: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={e => {
                  let v = e.target.value
                  if (key === 'telefono') v = v.replace(/\D/g, '').slice(0, 10)
                  setForm(f => ({ ...f, [key]: v }))
                }}
                required
                placeholder={placeholder}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
          ))}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full text-white py-3 rounded-xl font-semibold disabled:opacity-60 hover:opacity-90 transition-all" style={{ background: 'var(--ink)' }}>
            {loading ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link to="/restaurant/login" className="font-medium hover:underline" style={{ color: 'var(--yalo-primary)' }}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
