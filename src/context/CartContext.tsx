import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { CartItem, Restaurant } from '../lib/types'

interface CartContextType {
  items: CartItem[]
  restaurant: Restaurant | null
  setRestaurant: (r: Restaurant) => void
  addItem: (item: CartItem) => void
  updateQuantity: (index: number, qty: number) => void
  removeItem: (index: number) => void
  clearCart: () => void
  total: number
  itemCount: number
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [restaurant, setRestaurantState] = useState<Restaurant | null>(null)

  const setRestaurant = useCallback((r: Restaurant) => setRestaurantState(r), [])

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => [...prev, item])
  }, [])

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateQuantity = useCallback((index: number, qty: number) => {
    if (qty < 1) {
      setItems(prev => prev.filter((_, i) => i !== index))
      return
    }
    setItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: qty } : it))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setRestaurantState(null)
  }, [])

  const itemCount = items.reduce((sum, it) => sum + it.quantity, 0)

  const total = items.reduce((sum, it) => {
    const extrasCost = (it.extras_seleccionados ?? []).reduce((es, e) => es + e.precio * e.cantidad, 0)
    return sum + (it.dish.precio + (it.variantes_precio ?? 0)) * it.quantity + extrasCost
  }, 0)

  return (
    <CartContext.Provider value={{ items, restaurant, setRestaurant, addItem, updateQuantity, removeItem, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
