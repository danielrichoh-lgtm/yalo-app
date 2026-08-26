/*
# Create leads_informacion table

1. New Tables
- `leads_informacion`
  - `id` (uuid, primary key, auto-generated)
  - `nombre` (text, not null) — nombre del responsable que pide información
  - `restaurante` (text, not null) — nombre del restaurante
  - `telefono` (text, not null) — teléfono de contacto
  - `numero_sucursales` (text, nullable) — cuántas sucursales tiene ("1", "2-3", "4-5", "Más de 5")
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `leads_informacion`.
- This is a no-auth public form (the landing page has no sign-in), so
  INSERT is allowed for `anon, authenticated` (anyone can submit a lead).
- SELECT/UPDATE/DELETE are NOT granted to anon — only authenticated
  admins can read/manage leads later if needed. For now we only need
  INSERT from the public landing, so we keep it locked down to the
  minimum: anon can INSERT, authenticated can SELECT.
*/

CREATE TABLE IF NOT EXISTS leads_informacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  restaurante text NOT NULL,
  telefono text NOT NULL,
  numero_sucursales text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leads_informacion ENABLE ROW LEVEL SECURITY;

-- Public insert (landing form, no sign-in)
DROP POLICY IF EXISTS "anon_insert_leads_informacion" ON leads_informacion;
CREATE POLICY "anon_insert_leads_informacion"
ON leads_informacion FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- Authenticated read (admin dashboard)
DROP POLICY IF EXISTS "auth_select_leads_informacion" ON leads_informacion;
CREATE POLICY "auth_select_leads_informacion"
ON leads_informacion FOR SELECT
TO authenticated USING (true);
