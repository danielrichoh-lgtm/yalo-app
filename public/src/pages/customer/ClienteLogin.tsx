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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          ← Volver al menú
        </button>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1A6B3C] mb-3">
            <span className="text-white text-2xl font-bold">Y</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Iniciar sesión</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="juan@ejemplo.com" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-[#1A6B3C] text-white py-3 rounded-xl font-semibold hover:bg-[#155a32] disabled:opacity-60">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          <p className="text-center text-xs text-gray-500">
            <Link to="/cliente/recuperar" className="text-[#1A6B3C] hover:underline">¿Olvidaste tu contraseña?</Link>
          </p>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿No tienes cuenta?{' '}
          <Link to="/cliente/registro" className="text-[#1A6B3C] font-medium hover:underline">Regístrate</Link>
        </p>
      </div>
    </div>
  )
}
