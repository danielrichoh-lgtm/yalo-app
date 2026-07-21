import { useState, useEffect, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Restaurant, MenuItem, VarianteGrupo, VarianteOpcion, DishExtra, MenuCategoria } from '../../../lib/types'
import { MENU_CATEGORIAS } from '../../../lib/types'

interface Props { restaurant: Restaurant; onUpdate: (r: Restaurant) => void }

function parseVariantes(raw: string | null | undefined): VarianteGrupo[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function parseExtras(raw: string | null | undefined): DishExtra[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export default function MiMenuTab({ restaurant, onUpdate }: Props) {
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState({ ...restaurant })
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null)
  const [isNewItem, setIsNewItem] = useState(false)
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({})
  const [variantGroups, setVariantGroups] = useState<VarianteGrupo[]>([])
  const [extraItems, setExtraItems] = useState<DishExtra[]>([])
  const logoRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const fetchDishes = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at')
    if (data) setMenuItems(data as MenuItem[])
  }

  useEffect(() => {
    fetchDishes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveConfig = async (updates: Partial<Restaurant>) => {
    setSaving(true)
    const merged = { ...config, ...updates }
    setConfig(merged)
    const { data } = await supabase
      .from('Restaurants')
      .update(updates)
      .eq('id', restaurant.id)
      .select()
      .single()
    setSaving(false)
    if (data) onUpdate(data as Restaurant)
  }

  const saveField = async (field: keyof Restaurant, value: Restaurant[keyof Restaurant]) => {
    setSaving(true)
    const updates = { [field]: value } as Partial<Restaurant>
    setConfig(prev => ({ ...prev, ...updates }))
    const { data } = await supabase
      .from('Restaurants')
      .update(updates)
      .eq('id', restaurant.id)
      .select()
      .single()
    setSaving(false)
    if (data) {
      onUpdate(data as Restaurant)
      setSavedFields(prev => ({ ...prev, [field]: true }))
      setTimeout(() => setSavedFields(prev => ({ ...prev, [field]: false })), 2500)
    }
  }

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      const reader = new FileReader()
      reader.onload = (e) => { img.src = e.target!.result as string }
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const maxSize = 800
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      reader.readAsDataURL(file)
    })
  }

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    saveConfig({ logo: compressed })
  }

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setEditingItem(prev => prev ? { ...prev, foto: compressed } : prev)
  }

  const openEditItem = (item: MenuItem) => {
    setEditingItem({ ...item })
    setVariantGroups(parseVariantes(item.variantes))
    setExtraItems(parseExtras(item.extras))
    setIsNewItem(false)
  }

  const openNewItem = () => {
    setEditingItem({ disponible: true, categoria: 'Comidas' })
    setVariantGroups([])
    setExtraItems([])
    setIsNewItem(true)
  }

  const addVariantGroup = () => {
    setVariantGroups(prev => [...prev, { nombre: '', opciones: [], min: 0, max: 1 }])
  }

  const removeVariantGroup = (idx: number) => {
    setVariantGroups(prev => prev.filter((_, i) => i !== idx))
  }

  const updateVariantGroupName = (idx: number, nombre: string) => {
    setVariantGroups(prev => prev.map((g, i) => i === idx ? { ...g, nombre } : g))
  }

  const addVariantOpcion = (groupIdx: number) => {
    setVariantGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, opciones: [...g.opciones, { nombre: '', precio: 0 }] } : g
    ))
  }

  const updateVariantOpcionNombre = (groupIdx: number, opIdx: number, nombre: string) => {
    setVariantGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) return g
      const opciones = g.opciones.map((op, oi) => {
        if (oi !== opIdx) return op
        const current: VarianteOpcion = typeof op === 'string' ? { nombre: op, precio: 0 } : op
        return { ...current, nombre }
      })
      return { ...g, opciones }
    }))
  }

  const updateVariantOpcionPrecio = (groupIdx: number, opIdx: number, precio: number) => {
    setVariantGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) return g
      const opciones = g.opciones.map((op, oi) => {
        if (oi !== opIdx) return op
        const current: VarianteOpcion = typeof op === 'string' ? { nombre: op, precio: 0 } : op
        return { ...current, precio }
      })
      return { ...g, opciones }
    }))
  }

  const removeVariantOpcion = (groupIdx: number, opIdx: number) => {
    setVariantGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, opciones: g.opciones.filter((_, oi) => oi !== opIdx) } : g
    ))
  }

  const updateVariantGroupTipo = (idx: number, tipo: 'contador' | undefined) => {
    setVariantGroups(prev => prev.map((g, i) => {
      if (i !== idx) return g
      if (tipo === 'contador') {
        return { ...g, tipo, min: g.min ?? g.total ?? 0, max: g.max ?? g.total ?? 1, total: undefined }
      }
      return { ...g, tipo: undefined, total: undefined }
    }))
  }

  const updateVariantGroupMin = (idx: number, min: number) => {
    setVariantGroups(prev => prev.map((g, i) => i === idx ? { ...g, min } : g))
  }

  const updateVariantGroupMax = (idx: number, max: number) => {
    setVariantGroups(prev => prev.map((g, i) => i === idx ? { ...g, max } : g))
  }

  const saveItem = async () => {
    if (!editingItem?.nombre) return
    setSaving(true)
    const variantesJson = variantGroups.length > 0
      ? JSON.stringify(variantGroups.filter(g => g.nombre && g.opciones.length > 0).map(g => ({
          ...g,
          opciones: g.opciones
            .map(op => typeof op === 'string' ? { nombre: op, precio: 0 } : op)
            .filter(op => op.nombre)
            .map(op => op.precio > 0 ? op : op.nombre),
        })))
      : null
    const extrasJson = extraItems.length > 0
      ? JSON.stringify(extraItems.filter(e => e.nombre))
      : null
    if (isNewItem) {
      const { data: inserted, error } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: restaurant.id,
          nombre: editingItem.nombre,
          descripcion: editingItem.descripcion ?? '',
          precio: editingItem.precio ?? 0,
          foto: editingItem.foto ?? null,
          disponible: true,
          variantes: variantesJson,
          extras: extrasJson,
          categoria: editingItem.categoria ?? 'Comidas',
        })
        .select()
        .single()
      if (error) console.error('Insert error:', error)
      if (inserted) setMenuItems(prev => [...prev, inserted as MenuItem])
    } else if (editingItem.id) {
      await supabase.from('menu_items')
        .update({
          nombre: editingItem.nombre,
          descripcion: editingItem.descripcion,
          precio: editingItem.precio,
          foto: editingItem.foto,
          disponible: editingItem.disponible,
          variantes: variantesJson,
          extras: extrasJson,
          categoria: editingItem.categoria ?? 'Comidas',
        })
        .eq('id', editingItem.id)
    }
    await fetchDishes()
    setSaving(false)
    setEditingItem(null)
  }

  const deleteItem = async (id: string) => {
    await supabase.from('menu_items').delete().eq('id', id)
    await fetchDishes()
  }

  const toggleDisponible = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ disponible: !item.disponible }).eq('id', item.id)
    await fetchDishes()
  }

  return (
    <div className="space-y-6">
      {/* Estado del servicio */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="font-bold text-gray-900 mb-4">Estado del servicio</h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-gray-800">Servicio activo</p>
            <p className="text-xs text-gray-500">Los clientes pueden hacer pedidos</p>
          </div>
          <button
            onClick={() => saveConfig({ servicio_activo: !config.servicio_activo })}
            className={`w-12 h-6 rounded-full transition-colors ${config.servicio_activo ? 'bg-[#34C776]' : 'bg-gray-200'}`}
          >
            <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${config.servicio_activo ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Apertura</label>
            <input type="time" value={config.hora_apertura} onChange={e => setConfig(c => ({ ...c, hora_apertura: e.target.value }))} onBlur={() => saveConfig({ hora_apertura: config.hora_apertura })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A6B3C]" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Cierre</label>
            <input type="time" value={config.hora_cierre} onChange={e => setConfig(c => ({ ...c, hora_cierre: e.target.value }))} onBlur={() => saveConfig({ hora_cierre: config.hora_cierre })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A6B3C]" />
          </div>
        </div>
      </section>

      {/* Delivery config */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="font-bold text-gray-900 mb-4">Configuración de entrega</h3>
        {([['pickup_activo', 'Recoger en local'], ['repartidor_propio', 'Repartidor propio'], ['repartidor_externo', 'Repartidor externo']] as [keyof Restaurant, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between py-2">
            <p className="text-sm text-gray-800">{label}</p>
            <button
              onClick={() => saveConfig({ [key]: !config[key] } as Partial<Restaurant>)}
              className={`w-11 h-6 rounded-full transition-colors ${config[key] ? 'bg-[#34C776]' : 'bg-gray-200'}`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${config[key] ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}

        <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Costo de envío por platillo (MXN)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={config.costo_envio_por_platillo ?? 0}
                min={0}
                step={1}
                onChange={e => setConfig(c => ({ ...c, costo_envio_por_platillo: parseInt(e.target.value) || 0 }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A6B3C]"
              />
              <button
                onClick={() => saveField('costo_envio_por_platillo', config.costo_envio_por_platillo ?? 0)}
                disabled={saving}
                className="px-4 py-2 bg-[#1A6B3C] text-white text-sm rounded-lg hover:bg-[#155a32] disabled:opacity-60 whitespace-nowrap"
              >
                {savedFields.costo_envio_por_platillo ? 'Guardado ✓' : 'Guardar'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Ej. $5 por platillo — se multiplica por el número de platillos del pedido</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pedido mínimo (MXN)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={config.pedido_minimo ?? 0}
                min={0}
                step={1}
                onChange={e => setConfig(c => ({ ...c, pedido_minimo: parseInt(e.target.value) || 0 }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A6B3C]"
              />
              <button
                onClick={() => saveField('pedido_minimo', config.pedido_minimo ?? 0)}
                disabled={saving}
                className="px-4 py-2 bg-[#1A6B3C] text-white text-sm rounded-lg hover:bg-[#155a32] disabled:opacity-60 whitespace-nowrap"
              >
                {savedFields.pedido_minimo ? 'Guardado ✓' : 'Guardar'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">0 = sin mínimo</p>
          </div>
        </div>
      </section>

      {/* Logo */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="font-bold text-gray-900 mb-4">Logo del restaurante</h3>
        <div className="flex items-center gap-4">
          {config.logo ? (
            <img src={config.logo} alt="Logo" className="w-20 h-20 rounded-xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Sin logo</div>
          )}
          <div className="flex flex-col gap-2">
            <button onClick={() => logoRef.current?.click()} className="text-sm text-[#1A6B3C] font-medium border border-[#1A6B3C] px-4 py-2 rounded-lg hover:bg-green-50">
              {config.logo ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {config.logo && (
              <button
                onClick={() => saveConfig({ logo: null })}
                className="text-sm text-red-500 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50"
              >
                🗑 Eliminar logo
              </button>
            )}
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
      </section>

      {/* Platillos */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Platillos ({menuItems.length})</h3>
          <button
            onClick={openNewItem}
            className="text-sm bg-[#1A6B3C] text-white px-3 py-1.5 rounded-lg hover:bg-[#155a32]"
          >
            + Agregar
          </button>
        </div>
        <div className="space-y-4">
          {MENU_CATEGORIAS.map(cat => {
            const catItems = menuItems.filter(i => (i.categoria ?? 'Comidas') === cat)
            if (catItems.length === 0) return null
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat}</p>
                <div className="space-y-2">
                  {catItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                      {item.foto ? (
                        <img src={item.foto} alt={item.nombre} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{item.nombre}</p>
                        <p className="text-xs text-gray-500 truncate">{item.descripcion}</p>
                        <p className="text-sm font-semibold text-[#1A6B3C]">${item.precio.toFixed(2)}</p>
                        {item.variantes && parseVariantes(item.variantes).length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {parseVariantes(item.variantes).map(g => g.nombre).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleDisponible(item)}
                          className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${item.disponible ? 'bg-[#34C776]' : 'bg-gray-200'}`}
                        >
                          <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${item.disponible ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <button onClick={() => openEditItem(item)} className="text-gray-400 hover:text-gray-600 text-sm px-2">✏</button>
                        <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-400 text-sm px-1">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {menuItems.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Sin platillos — agrega uno arriba</p>
          )}
        </div>
      </section>

      {saving && <p className="text-center text-sm text-gray-400">Guardando...</p>}

      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setEditingItem(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">{isNewItem ? 'Nuevo platillo' : 'Editar platillo'}</h3>
            <input
              value={editingItem.nombre ?? ''}
              onChange={e => setEditingItem(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Nombre"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
            />
            <textarea
              value={editingItem.descripcion ?? ''}
              onChange={e => setEditingItem(p => ({ ...p, descripcion: e.target.value }))}
              placeholder="Descripción"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none h-16 focus:outline-none focus:border-[#1A6B3C]"
            />
            <input
              type="number"
              value={editingItem.precio ?? ''}
              onChange={e => setEditingItem(p => ({ ...p, precio: parseFloat(e.target.value) || 0 }))}
              placeholder="Precio"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
            />
            <select
              value={editingItem.categoria ?? 'Comidas'}
              onChange={e => setEditingItem(p => ({ ...p, categoria: e.target.value as MenuCategoria }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A6B3C] bg-white"
            >
              {MENU_CATEGORIAS.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {editingItem.foto ? (
                  <img src={editingItem.foto} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">Sin foto</div>
                )}
                <button onClick={() => photoRef.current?.click()} className="text-sm text-[#1A6B3C] border border-[#1A6B3C] px-3 py-1.5 rounded-lg">
                  {editingItem.foto ? 'Cambiar foto' : 'Agregar foto'}
                </button>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
              {editingItem.foto && (
                <button
                  onClick={async () => {
                    setEditingItem(prev => prev ? { ...prev, foto: null } : prev)
                    if (editingItem.id) {
                      await supabase.from('menu_items').update({ foto: null }).eq('id', editingItem.id)
                      await fetchDishes()
                    }
                  }}
                  className="text-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
                >
                  🗑 Eliminar foto
                </button>
              )}
            </div>

            {/* Variantes */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-800">Variantes (obligatorias)</p>
                <button
                  onClick={addVariantGroup}
                  className="text-xs text-[#1A6B3C] border border-[#1A6B3C] px-2.5 py-1 rounded-lg hover:bg-green-50"
                >
                  + Agregar grupo
                </button>
              </div>
              {variantGroups.length === 0 && (
                <p className="text-xs text-gray-400">Sin variantes — el cliente solo elige cantidad</p>
              )}
              <div className="space-y-3">
                {variantGroups.map((group, idx) => (
                  <div key={idx} className="border border-gray-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={group.nombre}
                        onChange={e => updateVariantGroupName(idx, e.target.value)}
                        placeholder="Nombre del grupo (ej. Salsa)"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                      />
                      <button
                        onClick={() => removeVariantGroup(idx)}
                        className="text-gray-300 hover:text-red-400 text-lg leading-none px-1"
                      >×</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={group.tipo === 'contador' ? 'contador' : 'radio'}
                        onChange={e => updateVariantGroupTipo(idx, e.target.value === 'contador' ? 'contador' : undefined)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C] bg-white"
                      >
                        <option value="radio">Elección única</option>
                        <option value="contador">Repartir cantidad</option>
                      </select>
                      {group.tipo === 'contador' ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Min</span>
                          <input
                            type="number"
                            value={group.min ?? 0}
                            min={0}
                            onChange={e => updateVariantGroupMin(idx, parseInt(e.target.value) || 0)}
                            className="w-12 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                          />
                          <span className="text-xs text-gray-500">Max</span>
                          <input
                            type="number"
                            value={group.max ?? 1}
                            min={1}
                            onChange={e => updateVariantGroupMax(idx, parseInt(e.target.value) || 1)}
                            className="w-12 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Min</span>
                          <input
                            type="number"
                            value={group.min ?? 0}
                            min={0}
                            onChange={e => updateVariantGroupMin(idx, parseInt(e.target.value) || 0)}
                            className="w-12 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                          />
                          <span className="text-xs text-gray-500">Max</span>
                          <input
                            type="number"
                            value={group.max ?? 1}
                            min={1}
                            onChange={e => updateVariantGroupMax(idx, parseInt(e.target.value) || 1)}
                            className="w-12 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {group.opciones.map((raw, opIdx) => {
                        const op: VarianteOpcion = typeof raw === 'string' ? { nombre: raw, precio: 0 } : raw
                        const disponible = op.disponible !== false
                        return (
                          <div key={opIdx} className="flex items-center gap-2">
                            <input
                              value={op.nombre}
                              onChange={e => updateVariantOpcionNombre(idx, opIdx, e.target.value)}
                              placeholder="Nombre de la opción"
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">$</span>
                              <input
                                type="number"
                                value={op.precio}
                                min={0}
                                onChange={e => updateVariantOpcionPrecio(idx, opIdx, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                              />
                            </div>
                            <button
                              type="button"
                              title={disponible ? 'Disponible' : 'Agotado'}
                              onClick={() => setVariantGroups(prev => prev.map((g, gi) => {
                                if (gi !== idx) return g
                                const opciones = g.opciones.map((o, oi) => {
                                  if (oi !== opIdx) return o
                                  const cur: VarianteOpcion = typeof o === 'string' ? { nombre: o, precio: 0 } : o
                                  return { ...cur, disponible: !disponible }
                                })
                                return { ...g, opciones }
                              }))}
                              className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${disponible ? 'bg-[#34C776]' : 'bg-gray-200'}`}
                            >
                              <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${disponible ? 'translate-x-3' : 'translate-x-0'}`} />
                            </button>
                            <button
                              onClick={() => removeVariantOpcion(idx, opIdx)}
                              className="text-gray-300 hover:text-red-400 text-lg leading-none px-1"
                            >×</button>
                          </div>
                        )
                      })}
                      <button
                        onClick={() => addVariantOpcion(idx)}
                        className="text-xs text-[#1A6B3C] border border-[#1A6B3C] px-2.5 py-1 rounded-lg hover:bg-green-50 mt-1"
                      >+ Agregar opción</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Extras */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-800">Extras (opcionales con costo)</p>
                <button
                  onClick={() => setExtraItems(prev => [...prev, { nombre: '', precio: 0, max: 10 }])}
                  className="text-xs text-[#1A6B3C] border border-[#1A6B3C] px-2.5 py-1 rounded-lg hover:bg-green-50"
                >
                  + Agregar extra
                </button>
              </div>
              {extraItems.length === 0 && (
                <p className="text-xs text-gray-400">Sin extras opcionales</p>
              )}
              <div className="space-y-2">
                {extraItems.map((extra, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={extra.nombre}
                      onChange={e => setExtraItems(prev => prev.map((ex, i) => i === idx ? { ...ex, nombre: e.target.value } : ex))}
                      placeholder="Nombre del extra (ej. Caldo de res)"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">$</span>
                      <input
                        type="number"
                        value={extra.precio}
                        min={0}
                        onChange={e => setExtraItems(prev => prev.map((ex, i) => i === idx ? { ...ex, precio: parseFloat(e.target.value) || 0 } : ex))}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">Máx</span>
                      <input
                        type="number"
                        value={extra.max ?? 10}
                        min={1}
                        onChange={e => setExtraItems(prev => prev.map((ex, i) => i === idx ? { ...ex, max: parseInt(e.target.value) || 1 } : ex))}
                        className="w-12 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#1A6B3C]"
                      />
                    </div>
                    <button
                      type="button"
                      title={extra.disponible !== false ? 'Disponible' : 'Agotado'}
                      onClick={() => setExtraItems(prev => prev.map((ex, i) => i === idx ? { ...ex, disponible: ex.disponible === false ? true : false } : ex))}
                      className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${extra.disponible !== false ? 'bg-[#34C776]' : 'bg-gray-200'}`}
                    >
                      <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${extra.disponible !== false ? 'translate-x-3' : 'translate-x-0'}`} />
                    </button>
                    <button
                      onClick={() => setExtraItems(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none px-1"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingItem(null)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={saveItem} disabled={saving} className="flex-1 bg-[#1A6B3C] text-white py-2.5 rounded-xl text-sm hover:bg-[#155a32] disabled:opacity-60">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
