import { useCart } from '../context/CartContext'

interface Props {
  onOpen: () => void
}

export default function CartButton({ onOpen }: Props) {
  const { itemCount, total } = useCart()
  if (itemCount === 0) return null

  return (
    <button
      onClick={onOpen}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A6B3C] text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 hover:bg-[#155a32] transition-all z-40"
    >
      <span className="bg-white text-[#1A6B3C] font-bold text-sm w-6 h-6 rounded-full flex items-center justify-center">
        {itemCount}
      </span>
      <span className="font-semibold">Ver carrito</span>
      <span className="font-bold">${total.toFixed(2)}</span>
    </button>
  )
}
