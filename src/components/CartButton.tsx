import { useCart } from '../context/CartContext'

interface Props {
  onOpen: () => void
  disabled?: boolean
}

export default function CartButton({ onOpen, disabled }: Props) {
  const { itemCount, total } = useCart()
  if (itemCount === 0) return null

  return (
    <button
      onClick={disabled ? undefined : onOpen}
      disabled={disabled}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-white px-6 py-3.5 rounded-xl flex items-center gap-4 transition-all z-40 ${disabled ? 'cursor-not-allowed' : 'hover:opacity-90'}`}
      style={disabled ? { background: '#9CA3AF' } : { background: 'var(--ink)' }}
    >
      <span className="text-white font-bold text-sm w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
        {itemCount}
      </span>
      <span className="font-semibold text-sm">Ver carrito</span>
      <span className="font-bold text-sm">${total.toFixed(2)}</span>
    </button>
  )
}
