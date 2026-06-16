import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRestaurantRoute } from './components/ProtectedRoute'
import RestaurantLogin from './pages/restaurant/RestaurantLogin'
import RestaurantDashboard from './pages/restaurant/RestaurantDashboard'
import MenuPage from './pages/customer/MenuPage'
import BranchSelectPage from './pages/customer/BranchSelectPage'
import ClienteRegistro from './pages/customer/ClienteRegistro'
import ClienteLogin from './pages/customer/ClienteLogin'
import ClienteRecuperar from './pages/customer/ClienteRecuperar'
import ClientePedidos from './pages/customer/ClientePedidos'
import Checkout from './pages/Checkout'
import Confirmacion from './pages/Confirmacion'
import PedidoTracking from './pages/PedidoTracking'
import ResetPassword from './pages/ResetPassword'
import RestaurantRecuperar from './pages/restaurant/RestaurantRecuperar'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/menu/mi-tierra" replace />} />
            <Route path="/restaurant/login" element={<RestaurantLogin />} />
            <Route
              path="/restaurant/dashboard"
              element={
                <ProtectedRestaurantRoute>
                  <RestaurantDashboard />
                </ProtectedRestaurantRoute>
              }
            />
            <Route path="/menu/:slug/sucursal" element={<BranchSelectPage />} />
            <Route path="/menu/:slug" element={<MenuPage />} />
            <Route path="/cliente/registro" element={<ClienteRegistro />} />
            <Route path="/cliente/login" element={<ClienteLogin />} />
            <Route path="/cliente/recuperar" element={<ClienteRecuperar />} />
            <Route path="/cliente/pedidos" element={<ClientePedidos />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/confirmacion" element={<Confirmacion />} />
            <Route path="/pedido/:numeroOrden" element={<PedidoTracking />} />
            <Route path="/restaurant/recuperar" element={<RestaurantRecuperar />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
