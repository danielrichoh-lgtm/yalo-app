-- New structured address fields on orders (old fields kept for backward compat)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS calle        text DEFAULT '',
  ADD COLUMN IF NOT EXISTS interior_depto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS colonia      text DEFAULT '',
  ADD COLUMN IF NOT EXISTS municipio    text DEFAULT '',
  ADD COLUMN IF NOT EXISTS referencias  text DEFAULT '';
