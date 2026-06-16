ALTER TABLE "Restaurants"
  ALTER COLUMN name DROP NOT NULL;

ALTER TABLE "Restaurants"
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS email text UNIQUE,
  ADD COLUMN IF NOT EXISTS password text,
  ADD COLUMN IF NOT EXISTS servicio_activo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS hora_apertura text DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS hora_cierre text DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS costo_envio numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pickup_activo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS repartidor_propio boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS repartidor_externo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo text;

DROP POLICY IF EXISTS "select_restaurants" ON "Restaurants";
DROP POLICY IF EXISTS "insert_restaurants" ON "Restaurants";
DROP POLICY IF EXISTS "update_restaurants" ON "Restaurants";
DROP POLICY IF EXISTS "delete_restaurants" ON "Restaurants";

CREATE POLICY "anon_select_restaurants" ON "Restaurants" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_restaurants" ON "Restaurants" FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_restaurants" ON "Restaurants" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_restaurants" ON "Restaurants" FOR DELETE TO anon, authenticated USING (true);

INSERT INTO "Restaurants" (nombre, slug, email, password, servicio_activo, hora_apertura, hora_cierre, costo_envio, pickup_activo, repartidor_propio, repartidor_externo)
VALUES ('Restaurante Mi Tierra', 'mi-tierra', 'demo@holayalo.mx', 'yalo2026', true, '08:00', '22:00', 50, true, true, false)
ON CONFLICT (slug) DO NOTHING;
