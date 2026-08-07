ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'En proceso';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tiempo_estimado text;
