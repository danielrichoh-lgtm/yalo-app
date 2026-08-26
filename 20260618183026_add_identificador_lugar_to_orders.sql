ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS identificador_lugar text DEFAULT '';
