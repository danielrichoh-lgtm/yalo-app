import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Restaurant } from '../../lib/types'

const FALLBACK: Record<string, { nombre: string; direccion: string }> = {
  'mi-tierra': {
    nombre: 'Restaurante Mi Tierra',
    direccion: 'Morelos 350 Ote, Monterrey',
  },
}

export default function BranchSelectPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)

  useEffect(() => {
    if (!slug) return
    supabase
      .from('Restaurants')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        if (data) setRestaurant(data as Restaurant)
      })
  }, [slug])

  const nombre = restaurant?.nombre ?? FALLBACK[slug ?? '']?.nombre ?? slug ?? ''
  const direccion = FALLBACK[slug ?? '']?.direccion ?? ''

  const handleSelect = () => {
    sessionStorage.setItem(`branch_selected_${slug}`, '1')
    navigate(`/menu/${slug}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-lg w-full mx-auto flex flex-col flex-1">
        {/* Title */}
        <div className="px-5 pt-10 pb-4 text-center">
          <h1 className="text-2xl font-bold text-[#1A6B3C]">¿Desde dónde nos visitas?</h1>
        </div>

        {/* Branch card */}
        <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="text-[#1A6B3C] text-xl mt-0.5">📍</span>
            <div>
              <p className="font-bold text-gray-900 text-base leading-tight">{nombre}</p>
              {direccion && <p className="text-sm text-gray-500 mt-0.5">{direccion}</p>}
            </div>
          </div>
          <button
            onClick={handleSelect}
            className="w-full bg-[#1A6B3C] hover:bg-[#155a32] active:bg-[#114a2a] text-white font-semibold py-3 rounded-xl transition-colors text-base"
          >
            Seleccionar
          </button>
        </div>
      </div>
    </div>
  )
}
