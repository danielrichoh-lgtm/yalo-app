import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !data.user) {
      setLoading(false)
      return setError('Correo o contraseña incorrectos')
    }

    const { data: adminRow } = await supabase
      .from('restaurant_users')
      .select('rol')
      .eq('user_id', data.user.id)
      .eq('rol', 'super_admin')
      .maybeSingle()

    if (!adminRow) {
      await supabase.auth.signOut()
      setLoading(false)
      return setError('No tienes acceso de administrador')
    }

    sessionStorage.setItem('admin_session', JSON.stringify({ user_id: data.user.id, email: data.user.email }))
    navigate('/admin/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 mb-4 border border-white/10">
            <span className="text-white text-xl font-black">Y</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Yalo Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Panel de super administración</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Correo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@holayalo.mx"
              className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(220,38,38,0.10)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm text-gray-900 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#ffffff' }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
