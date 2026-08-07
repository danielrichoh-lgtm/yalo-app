import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Restaurant } from '../../lib/types'

const FALLBACK_DIRECCION: Record<string, string> = {
  'mi-tierra': 'Morelos 350 Ote, Monterrey',
}

export default function BranchSelectPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [branches, setBranches] = useState<Restaurant[]>([])

  useEffect(() => {
    if (!slug) return
    supabase
      .from('Restaurants')
      .select('*')
      .eq('slug', slug)
      .then(({ data }) => {
        const results = (data as Restaurant[]) ?? []
        if (results.length === 1) {
          // Single branch — skip selection screen entirely
          sessionStorage.setItem(`branch_selected_${slug}`, '1')
          navigate(`/menu/${slug}`, { replace: true })
          return
        }
        setBranches(results)
      })
  }, [slug, navigate])

  const handleSelect = (branch: Restaurant) => {
    sessionStorage.setItem(`branch_selected_${slug}`, branch.id)
    navigate(`/menu/${slug}`)
  }

  // While loading or auto-redirecting, render nothing
  if (branches.length === 0) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-lg w-full mx-auto flex flex-col flex-1">
        <div className="px-5 pt-10 pb-4 text-center">
          <h1 className="text-2xl font-bold text-[#1A6B3C]">¿Desde dónde nos visitas?</h1>
        </div>

        <div className="mx-4 mt-4 flex flex-col gap-3">
          {branches.map(branch => (
            <div
              key={branch.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-[#1A6B3C] text-xl mt-0.5">📍</span>
                <div>
                  <p className="font-bold text-gray-900 text-base leading-tight">{branch.nombre}</p>
                  {FALLBACK_DIRECCION[slug ?? ''] && (
                    <p className="text-sm text-gray-500 mt-0.5">{FALLBACK_DIRECCION[slug ?? '']}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleSelect(branch)}
                className="w-full bg-[#1A6B3C] hover:bg-[#155a32] active:bg-[#114a2a] text-white font-semibold py-3 rounded-xl transition-colors text-base"
              >
                Seleccionar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
