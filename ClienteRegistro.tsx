import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Customer } from '../../lib/types'

export default function ClienteRegistro() {
  const { setCustomer } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', password: '', confirmar: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^\d{10}$/.test(form.telefono)) return setError('El teléfono debe tener exactamente 10 dígitos')
    if (form.password !== form.confirmar) return setError('Las contraseñas no coinciden')
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')

    setLoading(true)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })
    if (authError) {
      setLoading(false)
      if (authError.message.toLowerCase().includes('already registered')) {
        return setError('Este correo ya está registrado')
      }
      return setError('Error al crear cuenta: ' + authError.message)
    }

    const { data, error: dbError } = await supabase
      .from('customers')
      .insert({
        id: authData.user!.id,
        nombre: form.nombre,
        telefono: form.telefono,
        email: form.email,
      })
      .select()
      .single()
    setLoading(false)
    if (dbError || !data) return setError('Error al guardar datos. Intenta de nuevo.')
    setCustomer(data as Customer)
    navigate(-1)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          ← Volver al menú
        </button>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: 'var(--yalo-primary)' }}>
            <span className="text-white text-2xl font-bold font-display">Y</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Crear cuenta</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--border)' }}>
          {[
            { key: 'nombre', label: 'Nombre completo', type: 'text', placeholder: 'Juan Pérez' },
            { key: 'telefono', label: 'Teléfono (10 dígitos)', type: 'tel', placeholder: '5512345678' },
            { key: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'juan@ejemplo.com' },
            { key: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••' },
            { key: 'confirmar', label: 'Confirmar contraseña', type: 'password', placeholder: '••••••••' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required
                placeholder={placeholder}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
          ))}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full text-white py-3 rounded-xl font-semibold disabled:opacity-60 hover:opacity-90 transition-all" style={{ background: 'var(--ink)' }}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link to="/cliente/login" className="font-medium hover:underline" style={{ color: 'var(--yalo-primary)' }}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
