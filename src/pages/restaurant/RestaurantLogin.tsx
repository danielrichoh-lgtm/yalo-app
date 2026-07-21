import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function RestaurantLogin() {
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

    const { data: assignment } = await supabase
      .from('restaurant_users')
      .select('restaurant_id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (!assignment?.restaurant_id) {
      await supabase.auth.signOut()
      setLoading(false)
      return setError('No tienes un restaurante asignado')
    }

    const { data: restaurant } = await supabase
      .from('Restaurants')
      .select('*')
      .eq('id', assignment.restaurant_id)
      .single()

    setLoading(false)
    if (!restaurant) {
      await supabase.auth.signOut()
      return setError('No se encontró el restaurante asignado')
    }
    sessionStorage.setItem('restaurant_session', JSON.stringify(restaurant))
    window.location.href = '/restaurant/dashboard'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1A6B3C] mb-4">
            <span className="text-white text-2xl font-bold">Y</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Yalo Restaurantes</h1>
          <p className="text-gray-500 text-sm mt-1">Panel de administración</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
              placeholder="demo@holayalo.mx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A6B3C] text-white py-3 rounded-xl font-semibold hover:bg-[#155a32] transition-colors disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          <p className="text-center text-xs text-gray-500">
            <Link to="/restaurant/recuperar" className="text-[#1A6B3C] hover:underline">¿Olvidaste tu contraseña?</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
