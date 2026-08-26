import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Customer } from '../../lib/types'

export default function ClienteLogin() {
  const { setCustomer } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (authError || !authData.user) {
      setLoading(false)
      return setError('Correo o contraseña incorrectos')
    }
    const { data: customer, error: dbError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', authData.user.id)
      .single()
    setLoading(false)
    if (dbError || !customer) return setError('No se encontró la cuenta de cliente')
    setCustomer(customer as Customer)
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
          <h1 className="font-display text-2xl font-bold text-gray-900">Iniciar sesión</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="juan@ejemplo.com" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2" style={{ borderColor: 'var(--border)' }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2" style={{ borderColor: 'var(--border)' }} />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full text-white py-3 rounded-xl font-semibold disabled:opacity-60 hover:opacity-90 transition-all" style={{ background: 'var(--ink)' }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          <p className="text-center text-xs text-gray-500">
            <Link to="/cliente/recuperar" className="hover:underline" style={{ color: 'var(--yalo-primary)' }}>¿Olvidaste tu contraseña?</Link>
          </p>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿No tienes cuenta?{' '}
          <Link to="/cliente/registro" className="font-medium hover:underline" style={{ color: 'var(--yalo-primary)' }}>Regístrate</Link>
        </p>
      </div>
    </div>
  )
}
