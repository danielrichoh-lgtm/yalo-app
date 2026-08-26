/*
# Add discount fields to orders + increment_coupon_usage function

## Summary
Adds two columns to the `orders` table to record discount code usage, and creates a
PostgreSQL function to atomically increment the usage counter on a discount code.

## Modified Tables
- `orders`
  - `codigo_descuento` text NULLABLE — the discount code string that was applied (NULL if none)
  - `monto_descuento` numeric NOT NULL DEFAULT 0 — the discount amount subtracted from subtotal

## New Functions
- `increment_coupon_usage(p_coupon_id uuid)` — SECURITY DEFINER, atomically does
  `UPDATE discount_codes SET usos_actuales = usos_actuales + 1 WHERE id = p_coupon_id`.
  Called from the frontend after a successful order insert to avoid race conditions.

## Notes
1. Both column additions are idempotent (IF NOT EXISTS guard).
2. The function is idempotent via CREATE OR REPLACE.
3. monto_descuento defaults to 0 so old orders without a discount read cleanly as 0.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'codigo_descuento'
  ) THEN
    ALTER TABLE orders ADD COLUMN codigo_descuento text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'monto_descuento'
  ) THEN
    ALTER TABLE orders ADD COLUMN monto_descuento numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION increment_coupon_usage(p_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE discount_codes
  SET usos_actuales = usos_actuales + 1
  WHERE id = p_coupon_id;
$$;
