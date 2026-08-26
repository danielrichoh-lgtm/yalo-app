-- Save customer's last-used address so checkout can pre-fill
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS telefono_guardado  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS calle              text DEFAULT '',
  ADD COLUMN IF NOT EXISTS interior_depto     text DEFAULT '',
  ADD COLUMN IF NOT EXISTS colonia            text DEFAULT '',
  ADD COLUMN IF NOT EXISTS municipio          text DEFAULT '',
  ADD COLUMN IF NOT EXISTS referencias        text DEFAULT '';
