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
  tiempo_estimado: number | null
  created_at: string
}

export interface Customer {
  id: string
  nombre: string
  telefono: string
  email: string
  password: string
  // saved address fields for pre-filling checkout
  telefono_guardado?: string
  calle?: string
  interior_depto?: string
  colonia?: string
  municipio?: string
  referencias?: string
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
  es_destacado: boolean | null
  es_upsell: boolean | null
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

export type OrderStatus = 'Nuevo' | 'En proceso' | 'Entregado' | 'Cancelado'
export type DeliveryType = 'pickup' | 'domicilio'

export interface Order {
  id: string
  numero_orden: string
  restaurant_id: string
  customer_email: string
  customer_nombre: string
  customer_telefono: string
  delivery_type: DeliveryType
  // structured address fields (new orders)
  calle?: string
  interior_depto?: string
  piso_despacho?: string
  identificador_lugar?: string
  colonia?: string
  municipio?: string
  referencias?: string
  indicaciones: string
  // legacy address fields (kept for backward compat with old orders)
  direccion: string
  establecimiento: string
  piso: string
  despacho: string
  items: OrderItem[]
  subtotal: number
  costo_envio: number
  total: number
  monto_pago: number
  cambio: number
  status: OrderStatus
  archivado: boolean
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
