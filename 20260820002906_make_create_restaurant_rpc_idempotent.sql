-- Make create_restaurant_with_owner idempotent: if the user already has
-- a restaurant, return the existing one instead of erroring on a duplicate.
-- This fixes the race condition where SignupPage and RestaurantBootstrap
-- both call the RPC concurrently after signUp().

CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner(
  p_user_id uuid,
  p_nombre_restaurante text,
  p_email text,
  p_telefono text DEFAULT ''
)
RETURNS TABLE (restaurant_id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_restaurant_id uuid;
  v_existing_restaurant_id uuid;
BEGIN
  -- Verificar que el caller esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Verificar que el user_id coincida con el caller
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'No autorizado: user_id no coincide con la sesión';
  END IF;

  -- Idempotencia: si el usuario ya tiene restaurante, retornarlo
  SELECT restaurant_id INTO v_existing_restaurant_id
  FROM restaurant_users
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_existing_restaurant_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_restaurant_id, (
      SELECT slug FROM "Restaurants" WHERE id = v_existing_restaurant_id
    );
    RETURN;
  END IF;

  -- Generar slug base: lowercase, sin acentos, espacios → guiones
  v_base_slug := lower(
    regexp_replace(
      unaccent(p_nombre_restaurante),
      '[^a-z0-9]+', '-', 'g'
    )
  );
  -- Limpiar guiones al inicio/final
  v_base_slug := trim(both '-' from v_base_slug);
  -- Si quedó vacío, usar fallback
  IF v_base_slug = '' OR v_base_slug IS NULL THEN
    v_base_slug := 'restaurante';
  END IF;

  v_slug := v_base_slug;

  -- Manejar colisiones con sufijo incremental
  WHILE EXISTS (SELECT 1 FROM "Restaurants" WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  -- Insertar restaurante con estado='draft'
  INSERT INTO "Restaurants" (
    nombre,
    slug,
    email,
    password,
    servicio_activo,
    hora_apertura,
    hora_cierre,
    costo_envio,
    costo_envio_por_platillo,
    pickup_activo,
    repartidor_propio,
    repartidor_externo,
    logo,
    pedido_minimo,
    direccion,
    telefono,
    estado,
    onboarding_completed,
    activo
  ) VALUES (
    p_nombre_restaurante,
    v_slug,
    p_email,
    '',
    false,
    '08:00',
    '22:00',
    0,
    0,
    true,
    true,
    false,
    NULL,
    0,
    '',
    p_telefono,
    'draft',
    false,
    true
  )
  RETURNING id INTO v_restaurant_id;

  -- Vincular al usuario como owner (rol='admin')
  INSERT INTO restaurant_users (
    user_id,
    restaurant_id,
    rol,
    email
  ) VALUES (
    p_user_id,
    v_restaurant_id,
    'admin',
    p_email
  );

  -- Retornar resultado
  RETURN QUERY SELECT v_restaurant_id, v_slug;
END;
$$;

-- Re-apply grants
REVOKE ALL ON FUNCTION public.create_restaurant_with_owner(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner(uuid, text, text, text) TO authenticated;
