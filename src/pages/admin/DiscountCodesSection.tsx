import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import type { Restaurant } from '../../lib/types'

interface DiscountCode {
  id: string
  codigo: string
  restaurant_id: string | null
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
  monto_minimo: number | null
  usos_maximos: number | null
  usos_actuales: number
  activo: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  created_at: string
  Restaurants?: { nombre: string } | null
}

type FormState = {
  codigo: string
  restaurant_id: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: string
  monto_minimo: string
  usos_maximos: string
  activo: boolean
  fecha_inicio: string
  fecha_fin: string
}

const EMPTY_FORM: FormState = {
  codigo: '',
  restaurant_id: '',
  tipo: 'porcentaje',
  valor: '',
  monto_minimo: '',
  usos_maximos: '',
  activo: true,
  fecha_inicio: '',
  fecha_fin: '',
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

function valorDisplay(code: DiscountCode) {
  return code.tipo === 'porcentaje'
    ? `${code.valor}%`
    : `$${code.valor}`
}

function vigenciaDisplay(code: DiscountCode) {
  const desde = formatDate(code.fecha_inicio)
  const hasta = formatDate(code.fecha_fin)
  if (desde && hasta) return `${desde} → ${hasta}`
  if (desde) return `Desde ${desde}`
  if (hasta) return `Hasta ${hasta}`
  return null
}

export default function DiscountCodesSection({ restaurants }: { restaurants: Restaurant[] }) {
  const [codes, setCodes] = useState<DiscountCode[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<DiscountCode | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const loadCodes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('discount_codes')
      .select('*, Restaurants(nombre)')
      .order('created_at', { ascending: false })
    if (data) setCodes(data as DiscountCode[])
    setLoading(false)
  }, [])

  useEffect(() => { loadCodes() }, [loadCodes])

  const toggleActivo = async (code: DiscountCode) => {
    setToggling(code.id)
    await supabase
      .from('discount_codes')
      .update({ activo: !code.activo })
      .eq('id', code.id)
    setCodes(prev => prev.map(c => c.id === code.id ? { ...c, activo: !code.activo } : c))
    setToggling(null)
  }

  const deleteCode = async (id: string) => {
    setDeleting(id)
    await supabase.from('discount_codes').delete().eq('id', id)
    setCodes(prev => prev.filter(c => c.id !== id))
    setDeleteConfirm(null)
    setDeleting(null)
  }

  const openNew = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModal('new')
  }

  const openEdit = (code: DiscountCode) => {
    setEditTarget(code)
    setForm({
      codigo: code.codigo,
      restaurant_id: code.restaurant_id ?? '',
      tipo: code.tipo,
      valor: String(code.valor),
      monto_minimo: code.monto_minimo != null ? String(code.monto_minimo) : '',
      usos_maximos: code.usos_maximos != null ? String(code.usos_maximos) : '',
      activo: code.activo,
      fecha_inicio: code.fecha_inicio ? code.fecha_inicio.slice(0, 10) : '',
      fecha_fin: code.fecha_fin ? code.fecha_fin.slice(0, 10) : '',
    })
    setFormError('')
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setEditTarget(null)
    setFormError('')
  }

  const f = (key: keyof FormState, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const saveCode = async () => {
    const codigo = form.codigo.trim().toUpperCase()
    if (!codigo) { setFormError('El código es requerido'); return }
    const valor = parseFloat(form.valor)
    if (!form.valor || isNaN(valor) || valor <= 0) { setFormError('El valor debe ser mayor a 0'); return }
    if (form.tipo === 'porcentaje' && valor > 100) { setFormError('El porcentaje no puede superar 100'); return }
    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio) {
      setFormError('La fecha de fin debe ser posterior a la de inicio'); return
    }

    const payload = {
      codigo,
      restaurant_id: form.restaurant_id || null,
      tipo: form.tipo,
      valor,
      monto_minimo: form.monto_minimo ? parseFloat(form.monto_minimo) : null,
      usos_maximos: form.usos_maximos ? parseInt(form.usos_maximos) : null,
      activo: form.activo,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
    }

    setSaving(true)
    setFormError('')

    if (editTarget) {
      const { error } = await supabase
        .from('discount_codes')
        .update(payload)
        .eq('id', editTarget.id)
      if (error) {
        setSaving(false)
        setFormError(error.code === '23505' ? 'Ya existe un código con ese nombre para ese restaurante' : error.message)
        return
      }
    } else {
      const { error } = await supabase.from('discount_codes').insert(payload)
      if (error) {
        setSaving(false)
        setFormError(error.code === '23505' ? 'Ya existe un código con ese nombre para ese restaurante' : error.message)
        return
      }
    }

    setSaving(false)
    closeModal()
    loadCodes()
  }

  return (
    <>
      {/* Divider */}
      <div className="border-t border-white/8 my-2" />

      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Códigos de descuento ({codes.length})</h2>
        <button
          onClick={openNew}
          className="text-sm font-semibold px-4 py-2 rounded-xl text-gray-900 transition-colors"
          style={{ backgroundColor: '#ffffff' }}
        >
          + Nuevo código
        </button>
      </div>

      {/* Code list */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">No hay códigos aún</div>
      ) : (
        <div className="space-y-2">
          {codes.map(code => {
            const vigencia = vigenciaDisplay(code)
            const restNombre = code.Restaurants?.nombre ?? null
            const usosLabel = code.usos_maximos != null
              ? `${code.usos_actuales}/${code.usos_maximos}`
              : `${code.usos_actuales}/∞`
            const isDeleteConfirm = deleteConfirm === code.id

            return (
              <div
                key={code.id}
                className="rounded-2xl px-4 py-3.5"
                style={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Left: code info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Codigo badge */}
                      <span
                        className="font-mono font-bold text-sm tracking-wider px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#f9fafb' }}
                      >
                        {code.codigo}
                      </span>
                      {/* Restaurant / Global */}
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={
                          restNombre
                            ? { backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }
                            : { backgroundColor: 'rgba(251,191,36,0.13)', color: '#fbbf24' }
                        }
                      >
                        {restNombre ?? 'Global'}
                      </span>
                      {/* Tipo + valor */}
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'rgba(52,199,118,0.12)', color: '#34C776' }}
                      >
                        {valorDisplay(code)} {code.tipo === 'porcentaje' ? 'descuento' : 'fijo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Usos */}
                      <span className="text-xs text-gray-400">{usosLabel} usos</span>
                      {/* Vigencia */}
                      {vigencia && (
                        <span className="text-xs text-gray-500">{vigencia}</span>
                      )}
                      {/* Monto mínimo */}
                      {code.monto_minimo != null && (
                        <span className="text-xs text-gray-500">Mín. ${code.monto_minimo}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Activo toggle */}
                    <button
                      onClick={() => toggleActivo(code)}
                      disabled={toggling === code.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
                      style={
                        code.activo
                          ? { backgroundColor: 'rgba(52,199,118,0.12)', color: '#34C776' }
                          : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#6b7280' }
                      }
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${code.activo ? 'bg-[#34C776]' : 'bg-gray-500'}`} />
                      {toggling === code.id ? '...' : code.activo ? 'Activo' : 'Inactivo'}
                    </button>

                    {/* Edit */}
                    {!isDeleteConfirm && (
                      <button
                        onClick={() => openEdit(code)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}
                      >
                        Editar
                      </button>
                    )}

                    {/* Delete / confirm */}
                    {!isDeleteConfirm ? (
                      <button
                        onClick={() => setDeleteConfirm(code.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ backgroundColor: 'rgba(220,38,38,0.10)', color: '#f87171' }}
                      >
                        Eliminar
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">¿Eliminar?</span>
                        <button
                          onClick={() => deleteCode(code.id)}
                          disabled={deleting === code.id}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                          style={{ backgroundColor: 'rgba(220,38,38,0.20)', color: '#f87171' }}
                        >
                          {deleting === code.id ? '...' : 'Sí'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New / Edit modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:px-4"
          onClick={closeModal}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
            style={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">
                {modal === 'new' ? 'Nuevo código' : 'Editar código'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Código */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Código *</label>
                <input
                  type="text"
                  value={form.codigo}
                  onChange={e => f('codigo', e.target.value.toUpperCase())}
                  placeholder="VERANO15"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 uppercase focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                />
              </div>

              {/* Restaurante */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Restaurante</label>
                <select
                  value={form.restaurant_id}
                  onChange={e => f('restaurant_id', e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  <option value="">Global (todos los restaurantes)</option>
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={e => f('tipo', e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="monto_fijo">Monto fijo ($)</option>
                </select>
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Valor * {form.tipo === 'porcentaje' ? '(%)' : '($)'}
                </label>
                <input
                  type="number"
                  value={form.valor}
                  onChange={e => f('valor', e.target.value)}
                  placeholder={form.tipo === 'porcentaje' ? 'Ej. 15' : 'Ej. 50'}
                  min="0.01"
                  max={form.tipo === 'porcentaje' ? '100' : undefined}
                  step="0.01"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                />
              </div>

              {/* Monto mínimo */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Monto mínimo ($) <span className="text-gray-600">opcional</span></label>
                <input
                  type="number"
                  value={form.monto_minimo}
                  onChange={e => f('monto_minimo', e.target.value)}
                  placeholder="Ej. 150"
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                />
              </div>

              {/* Usos máximos */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Usos máximos <span className="text-gray-600">vacío = ilimitado</span></label>
                <input
                  type="number"
                  value={form.usos_maximos}
                  onChange={e => f('usos_maximos', e.target.value)}
                  placeholder="Ilimitado"
                  min="1"
                  step="1"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)' }}
                />
              </div>

              {/* Fecha inicio */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Fecha inicio <span className="text-gray-600">opcional</span></label>
                <input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={e => f('fecha_inicio', e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)', colorScheme: 'dark' }}
                />
              </div>

              {/* Fecha fin */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Fecha fin <span className="text-gray-600">opcional</span></label>
                <input
                  type="date"
                  value={form.fecha_fin}
                  onChange={e => f('fecha_fin', e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.10)', colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Activo toggle */}
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-gray-300">Activo</span>
              <button
                type="button"
                onClick={() => f('activo', !form.activo)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={
                  form.activo
                    ? { backgroundColor: 'rgba(52,199,118,0.12)', color: '#34C776' }
                    : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#6b7280' }
                }
              >
                <span className={`w-1.5 h-1.5 rounded-full ${form.activo ? 'bg-[#34C776]' : 'bg-gray-500'}`} />
                {form.activo ? 'Sí' : 'No'}
              </button>
            </div>

            {formError && (
              <p
                className="text-red-400 text-sm px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'rgba(220,38,38,0.10)' }}
              >
                {formError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Cancelar
              </button>
              <button
                onClick={saveCode}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-900 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#ffffff' }}
              >
                {saving ? 'Guardando...' : modal === 'new' ? 'Crear código' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
