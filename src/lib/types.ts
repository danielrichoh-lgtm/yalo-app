export interface VarianteOpcion {
  nombre: string
  precio: number
  disponible?: boolean
}

export interface VarianteGrupo {
  nombre: string
  opciones: (string | VarianteOpcion)[]
  tipo?: 'contador'
  total?: number
  min?: number
  max?: number
}

export interface DishExtra {
  nombre: string
  precio: number
  max?: number
  disponible?: boolean
}

export interface DishExtraSelected extends DishExtra {
  cantidad: number
}

export interface Restaurant {
  id: string
  nombre: string
  slug: string
  email: string
  password: string
  servicio_activo: boolean
  hora_apertura: string
  hora_cierre: string
  costo_envio: number
  costo_envio_por_platillo: number
  pickup_activo: boolean
  repartidor_propio: boolean
  repartidor_externo: boolean
  logo: string | null
  pedido_minimo: number
  created_at: string
}

export interface Customer {
  id: string
  nombre: string
  telefono: string
  email: string
  password: string
  created_at: string
}

export type MenuCategoria = 'Desayunos' | 'Comidas' | 'Antojitos mexicanos'
export const MENU_CATEGORIAS: MenuCategoria[] = ['Desayunos', 'Comidas', 'Antojitos mexicanos']

export interface MenuItem {
  id: string
  restaurant_id: string
  nombre: string
  descripcion: string
  precio: number
  foto: string | null
  disponible: boolean
  variantes: string | null
  extras: string | null
  categoria: MenuCategoria
  created_at: string
}

export interface OrderTopping {
  nombre: string
  precio: number
  quantity: number
}

export interface OrderItem {
  dish_id: string
  nombre: string
  precio: number
  quantity: number
  toppings: OrderTopping[]
  nota: string
  variantes_seleccionadas?: string[]
  extras_seleccionados?: DishExtraSelected[]
  variantes_precio?: number
}

export type OrderStatus = 'Nuevo' | 'Preparando' | 'Listo' | 'En camino' | 'Entregado' | 'Cancelado'
export type DeliveryType = 'pickup' | 'domicilio'

export interface Order {
  id: string
  numero_orden: string
  restaurant_id: string
  customer_email: string
  customer_nombre: string
  customer_telefono: string
  delivery_type: DeliveryType
  direccion: string
  establecimiento: string
  piso: string
  despacho: string
  indicaciones: string
  items: OrderItem[]
  subtotal: number
  costo_envio: number
  total: number
  monto_pago: number
  cambio: number
  status: OrderStatus
  created_at: string
}

export interface CartItem {
  dish: MenuItem
  quantity: number
  toppings: OrderTopping[]
  nota: string
  variantes_seleccionadas?: string[]
  extras_seleccionados?: DishExtraSelected[]
  variantes_precio?: number
}
