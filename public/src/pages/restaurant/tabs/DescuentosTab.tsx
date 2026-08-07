import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Restaurant } from '../../../lib/types'

interface DiscountCode {
  id: string
  codigo: string
  restaurant_id: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
  monto_minimo: number | null
  usos_maximos: number | null
  usos_actuales: number
  activo: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  created_at: string
}

const EMPTY_FORM = {
  codigo: '',
  tipo: 'porcentaje' as 'porcentaje' | 'monto_fijo',
  valor: '',
  monto_minimo: '',
  usos_maximos: '',
  activo: true,
  fecha_inicio: '',
  fecha_fin: '',
}

type FormState = typeof EMPTY_FORM

function vigenciaLabel(code: DiscountCode) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  if (code.fecha_inicio && code.fecha_fin) return `${fmt(code.fecha_inicio)} → ${fmt(code.fecha_fin)}`
  if (code.fecha_inicio) return `Desde ${fmt(code.fecha_inicio)}`
  if (code.fecha_fin) return `Hasta ${fmt(code.fecha_fin)}`
  return null
}

interface Props { restaurant: Restaurant }

export default function DescuentosTab({ restaurant }: Props) {
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
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
    if (data) setCodes(data as DiscountCode[])
    setLoading(false)
  }, [restaurant.id])

  useEffect(() => { loadCodes() }, [loadCodes])

  const toggleActivo = async (code: DiscountCode) => {
    setToggling(code.id)
    await supabase.from('discount_codes').update({ activo: !code.activo }).eq('id', code.id)
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

  const closeModal = () => { setModal(null); setEditTarget(null); setFormError('') }

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

    setSaving(true)
    setFormError('')

    const payload = {
      codigo,
      restaurant_id: restaurant.id,
      tipo: form.tipo,
      valor,
      monto_minimo: form.monto_minimo ? parseFloat(form.monto_minimo) : null,
      usos_maximos: form.usos_maximos ? parseInt(form.usos_maximos) : null,
      activo: form.activo,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
    }

    if (editTarget) {
      const { error } = await supabase.from('discount_codes').update(payload).eq('id', editTarget.id)
      if (error) {
        setSaving(false)
        setFormError(error.code === '23505' ? 'Ya tienes un código con ese nombre' : error.message)
        return
      }
    } else {
      const { error } = await supabase.from('discount_codes').insert(payload)
      if (error) {
        setSaving(false)
        setFormError(error.code === '23505' ? 'Ya tienes un código con ese nombre' : error.message)
        return
      }
    }

    setSaving(false)
    closeModal()
    loadCodes()
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900 text-lg">Descuentos ({codes.length})</h2>
        <button
          onClick={openNew}
          className="px-4 py-2 rounded-xl bg-[#1A6B3C] text-white text-sm font-bold transition-opacity hover:opacity-90"
        >
          + Nuevo código
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🏷</p>
          <p className="text-gray-500 font-medium">Aún no tienes códigos de descuento</p>
          <p className="text-gray-400 text-sm mt-1">Crea uno para atraer más pedidos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map(code => {
            const vigencia = vigenciaLabel(code)
            const usosLabel = code.usos_maximos != null
              ? `${code.usos_actuales}/${code.usos_maximos} usos`
              : `${code.usos_actuales} usos`
            const isDeleteConfirm = deleteConfirm === code.id

            return (
              <div
                key={code.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm tracking-wider bg-gray-100 text-gray-900 px-2 py-1 rounded-lg">
                      {code.codigo}
                    </span>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ backgroundColor: 'rgba(26,107,60,0.10)', color: '#1A6B3C' }}
                    >
                      {code.tipo === 'porcentaje' ? `${code.valor}%` : `$${code.valor}`}
                      {' '}descuento
                    </span>
                  </div>
                  <button
                    onClick={() => toggleActivo(code)}
                    disabled={toggling === code.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                    style={
                      code.activo
                        ? { backgroundColor: 'rgba(26,107,60,0.10)', color: '#1A6B3C' }
                        : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                    }
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${code.activo ? 'bg-[#1A6B3C]' : 'bg-gray-400'}`} />
                    {toggling === code.id ? '...' : code.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{usosLabel}</span>
                  {code.monto_minimo != null && <span>Mín. ${code.monto_minimo}</span>}
                  {vigencia && <span>{vigencia}</span>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                  {!isDeleteConfirm ? (
                    <>
                      <button
                        onClick={() => openEdit(code)}
                        className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(code.id)}
                        className="text-sm font-semibold text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Eliminar
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">¿Eliminar este código?</span>
                      <button
                        onClick={() => deleteCode(code.id)}
                        disabled={deleting === code.id}
                        className="text-sm font-bold text-white bg-red-500 px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {deleting === code.id ? '...' : 'Sí'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:px-4"
          onClick={closeModal}
        >
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">
                {modal === 'new' ? 'Nuevo código' : 'Editar código'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Código */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                <input
                  type="text"
                  value={form.codigo}
                  onChange={e => f('codigo', e.target.value.toUpperCase())}
                  placeholder="Ej. VERANO15"
                  maxLength={30}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base font-mono uppercase tracking-wider focus:outline-none focus:border-[#1A6B3C]"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={e => f('tipo', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1A6B3C]"
                >
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="monto_fijo">Monto fijo ($)</option>
                </select>
              </div>

              {/* Valor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1A6B3C]"
                />
              </div>

              {/* Monto mínimo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto mínimo ($) <span className="text-gray-400 font-normal">opcional</span>
                </label>
                <input
                  type="number"
                  value={form.monto_minimo}
                  onChange={e => f('monto_minimo', e.target.value)}
                  placeholder="Ej. 150"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1A6B3C]"
                />
              </div>

              {/* Usos máximos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usos máximos <span className="text-gray-400 font-normal">vacío = ilimitado</span>
                </label>
                <input
                  type="number"
                  value={form.usos_maximos}
                  onChange={e => f('usos_maximos', e.target.value)}
                  placeholder="Ilimitado"
                  min="1"
                  step="1"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1A6B3C]"
                />
              </div>

              {/* Fecha inicio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha inicio <span className="text-gray-400 font-normal">opcional</span>
                </label>
                <input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={e => f('fecha_inicio', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1A6B3C]"
                />
              </div>

              {/* Fecha fin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha fin <span className="text-gray-400 font-normal">opcional</span>
                </label>
                <input
                  type="date"
                  value={form.fecha_fin}
                  onChange={e => f('fecha_fin', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1A6B3C]"
                />
              </div>
            </div>

            {/* Activo toggle */}
            <div className="flex items-center justify-between py-1 border-t border-gray-100 pt-3">
              <span className="text-sm font-medium text-gray-700">Activo al crear</span>
              <button
                type="button"
                onClick={() => f('activo', !form.activo)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                style={
                  form.activo
                    ? { backgroundColor: 'rgba(26,107,60,0.10)', color: '#1A6B3C' }
                    : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                }
              >
                <span className={`w-2 h-2 rounded-full ${form.activo ? 'bg-[#1A6B3C]' : 'bg-gray-400'}`} />
                {form.activo ? 'Sí' : 'No'}
              </button>
            </div>

            {formError && (
              <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{formError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveCode}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-[#1A6B3C] hover:bg-[#155a32] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : modal === 'new' ? 'Crear código' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
