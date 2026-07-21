ALTER TABLE "Restaurants" ADD COLUMN IF NOT EXISTS ultimo_numero_orden int NOT NULL DEFAULT 0;
ALTER TABLE "Restaurants" ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION increment_order_number(p_restaurant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next integer;
BEGIN
  UPDATE "Restaurants"
  SET ultimo_numero_orden = ultimo_numero_orden + 1
  WHERE id = p_restaurant_id
  RETURNING ultimo_numero_orden INTO v_next;
  RETURN v_next;
END;
$$;
