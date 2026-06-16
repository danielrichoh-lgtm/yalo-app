import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ClienteRecuperar() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://vitejs-vite-duplicat-zg1n.bolt.host/reset-password',
    })
    setLoading(false)
    if (resetError) {
      setError('Error al enviar el correo: ' + resetError.message)
    } else {
      setSuccess('Revisa tu correo electrónico para restablecer tu contraseña')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/menu/mi-tierra" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          ← Volver al menú
        </Link>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="text-sm text-gray-500 mt-1">Te enviaremos un enlace a tu correo</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {success ? (
            <div className="text-center space-y-4">
              <p className="text-4xl">✉️</p>
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{success}</p>
              <Link to="/cliente/login" className="block w-full bg-[#1A6B3C] text-white py-3 rounded-xl font-semibold hover:bg-[#155a32] text-center">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="juan@ejemplo.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-[#1A6B3C] text-white py-3 rounded-xl font-semibold hover:bg-[#155a32] disabled:opacity-60">
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          <Link to="/cliente/login" className="text-[#1A6B3C] hover:underline">← Volver al inicio de sesión</Link>
        </p>
      </div>
    </div>
  )
}
