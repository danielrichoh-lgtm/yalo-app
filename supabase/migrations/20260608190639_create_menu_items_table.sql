CREATE TABLE menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES "Restaurants"(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text DEFAULT '',
  precio numeric NOT NULL DEFAULT 0,
  foto text,
  disponible boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_menu_items" ON menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_menu_items" ON menu_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_menu_items" ON menu_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_menu_items" ON menu_items FOR DELETE TO anon, authenticated USING (true);
