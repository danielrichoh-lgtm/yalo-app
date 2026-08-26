/*
# Add canal column to orders

1. Changes
- Adds `canal` column to the `orders` table.
- Default value is 'online' to preserve existing behavior for all current orders.
- Used to distinguish orders placed by the customer online ('online')
  from orders captured manually by a restaurant operator over the phone ('telefono').

2. Security
- No RLS policy changes. The column is readable/writable under existing
  order policies. No new tables.

3. Notes
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ so re-running is safe.
- No data loss: existing rows get the default 'online' value.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'canal'
  ) THEN
    ALTER TABLE orders ADD COLUMN canal text NOT NULL DEFAULT 'online';
  END IF;
END $$;
