import { useState } from 'react'
import type { MenuItem, CartItem, DishExtra, DishExtraSelected, VarianteGrupo, VarianteOpcion } from '../lib/types'
import { useCart } from '../context/CartContext'

interface Props {
  dish: MenuItem
  onClose: () => void
}

function parseVariantes(raw: string | null | undefined): VarianteGrupo[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function parseExtras(raw: string | null | undefined): DishExtra[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function normalizeOpcion(op: string | VarianteOpcion): VarianteOpcion {
  if (typeof op === 'string') return { nombre: op, precio: 0 }
  return op
}

function groupRuleLabel(g: VarianteGrupo): string {
  const min = g.min ?? 1
  const max = g.max ?? 1
  if (min === max && min === 1) return 'Elige 1'
  if (min === max) return `Elige ${min}`
  if (min === 0) return `Elige hasta ${max}`
  return `Elige de ${min} a ${max}`
}

// Groups whose name matches these patterns are treated as optional (min=0)
// regardless of what's stored in the DB.
const OPTIONAL_NAME_PATTERNS = [/consom[eé]/i, /caldo/i]

function effectiveMin(g: VarianteGrupo): number {
  if (OPTIONAL_NAME_PATTERNS.some(p => p.test(g.nombre))) return 0
  return g.min ?? 1
}

export default function DishModal({ dish, onClose }: Props) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [nota, setNota] = useState('')

  const variantGroups = parseVariantes(dish.variantes)

  // Checkbox selections: { [groupName]: string[] } — stores opcion nombres
  const [checkboxSelections, setCheckboxSelections] = useState<Record<string, string[]>>({})

  // Stepper counts for tipo=contador groups: { [groupName]: { [opcionNombre]: count } }
  const [contadorCounts, setContadorCounts] = useState<Record<string, Record<string, number>>>({})

  const standardGroups = variantGroups.filter(g => g.tipo !== 'contador')
  const contadorGroups = variantGroups.filter(g => g.tipo === 'contador')

  const toggleCheckbox = (groupNombre: string, opcionNombre: string, max: number) => {
    setCheckboxSelections(prev => {
      const current = prev[groupNombre] ?? []
      if (current.includes(opcionNombre)) {
        return { ...prev, [groupNombre]: current.filter(o => o !== opcionNombre) }
      }
      if (max === 1) {
        return { ...prev, [groupNombre]: [opcionNombre] }
      }
      if (current.length >= max) return prev
      return { ...prev, [groupNombre]: [...current, opcionNombre] }
    })
  }

  const groupsBelowMin = standardGroups.filter(g => {
    const min = effectiveMin(g)
    return (checkboxSelections[g.nombre] ?? []).length < min
  })

  const contadorValid = contadorGroups.every(g => {
    const min = g.min ?? g.total ?? 0
    const max = g.max ?? g.total ?? 0
    const counts = contadorCounts[g.nombre] ?? {}
    const sum = Object.values(counts).reduce((a, b) => a + b, 0)
    return sum >= min && sum <= max
  })

  const allVariantsSelected = groupsBelowMin.length === 0 && contadorValid

  const getContadorSum = (groupNombre: string) => {
    const counts = contadorCounts[groupNombre] ?? {}
    return Object.values(counts).reduce((a, b) => a + b, 0)
  }

  const updateContador = (groupNombre: string, opcionNombre: string, delta: number) => {
    setContadorCounts(prev => {
      const group = prev[groupNombre] ?? {}
      const g = contadorGroups.find(g => g.nombre === groupNombre)
      const max = g?.max ?? g?.total ?? Infinity
      const currentSum = Object.values(group).reduce((a, b) => a + b, 0)
      if (delta > 0 && currentSum >= max) return prev
      const next = Math.max(0, (group[opcionNombre] ?? 0) + delta)
      return { ...prev, [groupNombre]: { ...group, [opcionNombre]: next } }
    })
  }

  // Price from selected standard options
  const selectedOptionsCost = standardGroups.reduce((total, g) => {
    const selected = checkboxSelections[g.nombre] ?? []
    return total + g.opciones
      .map(normalizeOpcion)
      .filter(op => selected.includes(op.nombre))
      .reduce((sum, op) => sum + op.precio, 0)
  }, 0)

  // Extras — independent quantity steppers
  const dishExtras = parseExtras(dish.extras)
  const [extraCounts, setExtraCounts] = useState<Record<string, number>>({})

  const updateExtra = (nombre: string, delta: number, max: number) => {
    setExtraCounts(prev => {
      const next = Math.max(0, (prev[nombre] ?? 0) + delta)
      if (delta > 0 && next > max) return prev
      return { ...prev, [nombre]: next }
    })
  }

  const extrasCost = dishExtras.reduce((sum, e) => sum + (extraCounts[e.nombre] ?? 0) * e.precio, 0)
  const lineTotal = (dish.precio + selectedOptionsCost) * quantity + extrasCost

  const buildVariantesSeleccionadas = (): string[] => {
    const parts: string[] = []
    standardGroups.forEach(g => {
      const sel = checkboxSelections[g.nombre] ?? []
      if (sel.length > 0) parts.push(...sel)
    })
    contadorGroups.forEach(g => {
      const counts = contadorCounts[g.nombre] ?? {}
      const breakdown = g.opciones
        .map(normalizeOpcion)
        .filter(op => (counts[op.nombre] ?? 0) > 0)
        .map(op => `${counts[op.nombre]} ${op.nombre}`)
        .join(', ')
      if (breakdown) parts.push(`${g.nombre}: ${breakdown}`)
    })
    return parts
  }

  const variantLabel = (() => {
    const parts: string[] = []
    standardGroups.forEach(g => {
      const sel = checkboxSelections[g.nombre] ?? []
      if (sel.length > 0) parts.push(sel.join(', '))
    })
    contadorGroups.forEach(g => {
      const counts = contadorCounts[g.nombre] ?? {}
      const breakdown = g.opciones
        .map(normalizeOpcion)
        .filter(op => (counts[op.nombre] ?? 0) > 0)
        .map(op => `${counts[op.nombre]} ${op.nombre}`)
        .join(', ')
      if (breakdown) parts.push(`${g.nombre}: ${breakdown}`)
    })
    return parts.join(', ')
  })()

  const handleAdd = () => {
    if (!allVariantsSelected) return
    const selectedExtraList: DishExtraSelected[] = dishExtras
      .filter(e => (extraCounts[e.nombre] ?? 0) > 0)
      .map(e => ({ ...e, cantidad: extraCounts[e.nombre] }))

    const variantesSeleccionadas = buildVariantesSeleccionadas()

    const item: CartItem = {
      dish,
      quantity,
      toppings: [],
      nota,
      variantes_seleccionadas: variantesSeleccionadas.length > 0 ? variantesSeleccionadas : undefined,
      extras_seleccionados: selectedExtraList.length > 0 ? selectedExtraList : undefined,
      variantes_precio: selectedOptionsCost > 0 ? selectedOptionsCost : undefined,
    }
    addItem(item)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {dish.foto && (
          <img src={dish.foto} alt={dish.nombre} className="w-full h-48 object-cover rounded-t-2xl sm:rounded-t-2xl" />
        )}
        <div className="p-5">
          <h2 className="text-xl font-bold text-gray-900">{dish.nombre}</h2>
          {dish.descripcion && <p className="text-gray-500 mt-1 text-base leading-relaxed">{dish.descripcion}</p>}
          <p className="text-[#1A6B3C] font-bold text-xl mt-2">${dish.precio.toFixed(2)}</p>

          {/* Standard groups — checkbox with min/max */}
          {standardGroups.map(group => {
            const min = effectiveMin(group)
            const max = group.max ?? 1
            const selected = checkboxSelections[group.nombre] ?? []
            const atMax = selected.length >= max
            return (
              <div key={group.nombre} className="mt-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    {group.nombre}
                    {min > 0
                      ? <span className="text-xs font-normal text-red-500">Requerido</span>
                      : <span className="text-xs font-normal text-gray-400">Opcional</span>
                    }
                  </h3>
                  <span className="text-xs text-gray-400">{groupRuleLabel({ ...group, min })}</span>
                </div>
                {atMax && max > 1 && (
                  <p className="text-xs text-amber-600 mb-1">Máximo {max} opciones</p>
                )}
                <div className="space-y-2">
                  {group.opciones.map(raw => {
                    const op = normalizeOpcion(raw)
                    const isSelected = selected.includes(op.nombre)
                    const isUnavailable = op.disponible === false
                    const isDisabled = isUnavailable || (!isSelected && atMax)
                    return (
                      <label
                        key={op.nombre}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          isUnavailable
                            ? 'border-gray-100 opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'border-[#1A6B3C] bg-green-50'
                              : isDisabled
                                ? 'border-gray-100 opacity-50 cursor-not-allowed'
                                : 'border-gray-100 hover:border-gray-200 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => !isDisabled && toggleCheckbox(group.nombre, op.nombre, max)}
                          className="accent-[#1A6B3C] w-4 h-4"
                        />
                        <span className="flex-1 text-base text-gray-800">{op.nombre}</span>
                        {isUnavailable ? (
                          <span className="text-sm text-gray-400 font-medium">Agotado</span>
                        ) : op.precio > 0 ? (
                          <span className="text-sm text-[#1A6B3C] font-medium">+${op.precio.toFixed(2)}</span>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Contador groups — stepper with min/max */}
          {contadorGroups.map(group => {
            const min = group.min ?? group.total ?? 0
            const max = group.max ?? group.total ?? 0
            const sum = getContadorSum(group.nombre)
            const atMax = sum >= max
            const valid = sum >= min && sum <= max
            const sameMinMax = min === max
            return (
              <div key={group.nombre} className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    {group.nombre}
                    <span className="text-xs font-normal text-red-500">Requerido</span>
                  </h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    valid ? 'bg-green-50 text-green-700' :
                    sum > max ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {valid
                      ? `${sum}${sameMinMax ? ` de ${max}` : ''} ✓`
                      : sum > max
                        ? `Máximo ${max}`
                        : sameMinMax
                          ? `${sum} de ${max} — faltan ${max - sum}`
                          : sum < min
                            ? `${sum} elegidas — faltan ${min - sum}`
                            : `${sum} elegidas`}
                  </span>
                </div>
                {!sameMinMax && (
                  <p className="text-xs text-gray-400 mb-2">
                    {min === 0 ? `Elige hasta ${max}` : `Elige de ${min} a ${max}`}
                  </p>
                )}
                {sameMinMax && (
                  <p className="text-xs text-gray-400 mb-2">Elige {max} piezas</p>
                )}
                <div className="space-y-2">
                  {group.opciones.map(raw => {
                    const op = normalizeOpcion(raw)
                    const count = (contadorCounts[group.nombre] ?? {})[op.nombre] ?? 0
                    const isUnavailable = op.disponible === false
                    const incDisabled = atMax || isUnavailable
                    return (
                      <div key={op.nombre} className={`flex items-center justify-between p-3 rounded-xl border border-gray-100 ${isUnavailable ? 'opacity-50' : ''}`}>
                        <div>
                          <span className="text-base text-gray-800">{op.nombre}</span>
                          {isUnavailable ? (
                            <span className="text-sm text-gray-400 font-medium ml-2">Agotado</span>
                          ) : op.precio > 0 ? (
                            <span className="text-sm text-[#1A6B3C] font-medium ml-2">+${op.precio.toFixed(2)}</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => !isUnavailable && updateContador(group.nombre, op.nombre, -1)}
                            disabled={isUnavailable}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200 text-base disabled:cursor-not-allowed"
                          >−</button>
                          <span className="text-base font-semibold w-5 text-center">{count}</span>
                          <button
                            onClick={() => !incDisabled && updateContador(group.nombre, op.nombre, 1)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${
                              incDisabled
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                : 'bg-[#1A6B3C] text-white hover:bg-[#155a32]'
                            }`}
                          >+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Extras — independent qty steppers */}
          {dishExtras.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold text-gray-800 mb-2">Extras</h3>
              <div className="space-y-2">
                {dishExtras.map(extra => {
                  const count = extraCounts[extra.nombre] ?? 0
                  const limit = extra.max ?? 10
                  const atMax = count >= limit
                  const isUnavailable = extra.disponible === false
                  return (
                    <div
                      key={extra.nombre}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        isUnavailable
                          ? 'border-gray-100 opacity-50'
                          : count > 0 ? 'border-[#1A6B3C] bg-green-50' : 'border-gray-100'
                      }`}
                    >
                      <div>
                        <p className="text-base text-gray-800">{extra.nombre}</p>
                        <p className="text-sm font-medium mt-0.5">
                          {isUnavailable ? (
                            <span className="text-gray-400">Agotado</span>
                          ) : (
                            <span className="text-[#1A6B3C]">
                              +${extra.precio.toFixed(2)}
                              {atMax && <span className="text-amber-600 ml-1">· Máximo {limit}</span>}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => !isUnavailable && updateExtra(extra.nombre, -1, limit)}
                          disabled={isUnavailable}
                          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200 text-base disabled:cursor-not-allowed"
                        >−</button>
                        <span className="text-base font-semibold w-4 text-center">{count}</span>
                        <button
                          onClick={() => !atMax && !isUnavailable && updateExtra(extra.nombre, 1, limit)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${
                            atMax || isUnavailable
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              : 'bg-[#1A6B3C] text-white hover:bg-[#155a32]'
                          }`}
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-4">
            <span className="text-base font-medium text-gray-700">Cantidad</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold hover:bg-gray-200 text-lg"
              >−</button>
              <span className="font-semibold text-lg w-5 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-9 h-9 rounded-full bg-[#1A6B3C] flex items-center justify-center text-white font-bold hover:bg-[#155a32] text-lg"
              >+</button>
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-base font-medium text-gray-700 mb-1">Nota especial</label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Sin cebolla, extra picante..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base resize-none h-20 focus:outline-none focus:border-[#1A6B3C]"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={!allVariantsSelected}
            className={`mt-5 w-full py-3 rounded-xl font-semibold text-base transition-colors flex items-center justify-between px-4 ${
              allVariantsSelected
                ? 'bg-[#1A6B3C] text-white hover:bg-[#155a32]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span className="text-left">
              Agregar al carrito
              {variantLabel && <span className="font-normal text-sm"> ({variantLabel})</span>}
            </span>
            <span className="shrink-0">${lineTotal.toFixed(2)}</span>
          </button>

          {(groupsBelowMin.length > 0 || !contadorValid) && (
            <div className="mt-2 space-y-1">
              {groupsBelowMin.length > 0 && (
                <p className="text-xs text-red-500 text-center">
                  Selecciona: {groupsBelowMin.map(g => g.nombre).join(', ')}
                </p>
              )}
              {!contadorValid && contadorGroups.map(g => {
                const min = g.min ?? g.total ?? 0
                const max = g.max ?? g.total ?? 0
                const sum = getContadorSum(g.nombre)
                if (sum >= min && sum <= max) return null
                return (
                  <p key={g.nombre} className="text-xs text-red-500 text-center">
                    {g.nombre}: {sum > max ? `máximo ${max}` : `te faltan ${min - sum} por elegir`}
                  </p>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
