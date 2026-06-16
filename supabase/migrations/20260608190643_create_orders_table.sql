CREATE TYPE order_status AS ENUM ('Nuevo', 'Preparando', 'Listo', 'En camino', 'Entregado', 'Cancelado');
CREATE TYPE delivery_type AS ENUM ('pickup', 'domicilio');

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_orden text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES "Restaurants"(id) ON DELETE CASCADE,
  customer_email text NOT NULL DEFAULT '',
  customer_nombre text NOT NULL,
  customer_telefono text NOT NULL,
  delivery_type delivery_type NOT NULL DEFAULT 'pickup',
  direccion text DEFAULT '',
  establecimiento text DEFAULT '',
  piso text DEFAULT 'No aplica',
  despacho text DEFAULT '',
  indicaciones text DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric NOT NULL DEFAULT 0,
  costo_envio numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  monto_pago numeric NOT NULL DEFAULT 0,
  cambio numeric NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'Nuevo',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_orders" ON orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
