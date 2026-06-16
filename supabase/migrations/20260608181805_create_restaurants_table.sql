CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cuisine text,
  address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_restaurants" ON restaurants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_restaurants" ON restaurants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_restaurants" ON restaurants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_restaurants" ON restaurants FOR DELETE TO authenticated USING (true);
