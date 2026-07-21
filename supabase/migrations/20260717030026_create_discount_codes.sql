/*
# Create discount_codes table

## Summary
Creates the `discount_codes` table to manage promotional discount codes that can apply
to a specific restaurant or globally (restaurant_id = NULL) across all restaurants.

## New Tables
- `discount_codes`
  - `id` uuid primary key
  - `codigo` text NOT NULL — code string, should always be stored uppercase
  - `restaurant_id` uuid NULLABLE — FK to Restaurants with cascade delete; NULL = global code
  - `tipo` text NOT NULL — 'porcentaje' or 'monto_fijo'
  - `valor` numeric NOT NULL — percentage (e.g. 15) or fixed currency amount (e.g. 50)
  - `monto_minimo` numeric NULLABLE — minimum order total required to redeem
  - `usos_maximos` integer NULLABLE — max number of redemptions; NULL = unlimited
  - `usos_actuales` integer NOT NULL DEFAULT 0 — running redemption counter
  - `activo` boolean NOT NULL DEFAULT true — on/off master switch
  - `fecha_inicio` timestamptz NULLABLE — optional start of validity window
  - `fecha_fin` timestamptz NULLABLE — optional expiry
  - `created_at` timestamptz DEFAULT now()

## Uniqueness Rules
Two partial unique indexes enforce the business rule "no duplicate code per scope":
1. Global codes (restaurant_id IS NULL): `codigo` is unique across all global codes
2. Restaurant codes (restaurant_id IS NOT NULL): `(codigo, restaurant_id)` is unique per restaurant

## Security
- RLS enabled on discount_codes
- All operations open to anon + authenticated — matches existing table policy pattern.
  SELECT must allow anon because the checkout validates codes before the customer is logged in.

## Notes
1. Application layer is responsible for uppercasing `codigo` before insert/update.
2. Deleting a restaurant cascades to delete its discount codes.
*/

CREATE TABLE IF NOT EXISTS discount_codes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     text        NOT NULL,
  restaurant_id uuid     REFERENCES "Restaurants"(id) ON DELETE CASCADE,
  tipo       text        NOT NULL,
  valor      numeric     NOT NULL,
  monto_minimo numeric,
  usos_maximos integer,
  usos_actuales integer  NOT NULL DEFAULT 0,
  activo     boolean     NOT NULL DEFAULT true,
  fecha_inicio timestamptz,
  fecha_fin  timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Unique: only one global code per codigo (restaurant_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_global_unique
  ON discount_codes (codigo)
  WHERE restaurant_id IS NULL;

-- Unique: only one code per codigo per restaurant
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_restaurant_unique
  ON discount_codes (codigo, restaurant_id)
  WHERE restaurant_id IS NOT NULL;

-- Supporting indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_restaurant_id ON discount_codes (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_codigo        ON discount_codes (codigo);

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_discount_codes" ON discount_codes;
CREATE POLICY "anon_select_discount_codes" ON discount_codes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_discount_codes" ON discount_codes;
CREATE POLICY "anon_insert_discount_codes" ON discount_codes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_discount_codes" ON discount_codes;
CREATE POLICY "anon_update_discount_codes" ON discount_codes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_discount_codes" ON discount_codes;
CREATE POLICY "anon_delete_discount_codes" ON discount_codes
  FOR DELETE TO anon, authenticated USING (true);
